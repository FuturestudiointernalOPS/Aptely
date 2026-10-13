import crypto from "crypto";
import { Request, Response } from "express";
import { Resend } from "resend";
import { supabaseAdmin, createUserClient } from "@/config/supabase";
import { STORAGE_BUCKETS, buildAvatarPath } from "@/services/storage.service";
import { env } from "@/config/env";
import { AppError } from "@/middleware/error.middleware";
import { asyncHandler } from "@/utils/helpers";
import { retryWithBackoff } from "@/utils/retry";
import type {
  RegisterInput,
  RequestOtpInput,
  LoginInput,
  RefreshInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  DeleteMyAccountInput,
} from "./auth.schema";
import { type AuthenticatedRequest } from "@/middleware/auth.middleware";

const resend = new Resend(env.RESEND_API_KEY);

function hashOtp(code: string, salt: string): string {
  return crypto.createHash("sha256").update(`${salt}:${code}`).digest("hex");
}

// Maximum wrong-code tries before a signup code is burned and must be re-requested.
const MAX_OTP_ATTEMPTS = 3;

// Anti-abuse throttling for repeated code requests, per email address.
// Durable: based on the stored request history, so it survives restarts.
const OTP_REQUEST_COOLDOWN_SECONDS = 60;
const OTP_MAX_REQUESTS_PER_HOUR = 5;

// Source of truth for platform-owner status. JWT claims can drift (e.g. a stale
// `is_super_admin: false`), so we always confirm against the table.
async function isSuperAdminUser(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("super_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return data !== null;
}

async function syncUserClaims(
  userId: string,
  claims: {
    institutionId?: string | null;
    activeInstitutionId?: string | null;
    isSuperAdmin?: boolean;
  }
): Promise<void> {
  const appMetadata: Record<string, unknown> = {
    institution_id: claims.institutionId ?? null,
    active_institution_id: claims.activeInstitutionId ?? claims.institutionId ?? null,
    is_super_admin: claims.isSuperAdmin ?? false,
  };

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    app_metadata: appMetadata,
  });

  if (error) {
    console.warn(`[AUTH] Failed to sync custom claims for ${userId}: ${error.message}`);
  }
}

// ─── POST /auth/register/request-otp ─────────────────────────────────────────

export const requestSignupOtp = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body as RequestOtpInput;

  // Opportunistic cleanup of stale codes (best-effort; never blocks the request).
  const { error: purgeError } = await supabaseAdmin.rpc("purge_email_otps");
  if (purgeError) {
    console.warn(`[AUTH] OTP purge skipped: ${purgeError.message}`);
  }

  // Whether an account already exists is decided here but never revealed in the
  // response: both cases take the same path and return the same message, so the
  // endpoint cannot be used to enumerate registered addresses.
  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  const accountExists = Boolean(existing);

  // Throttle repeated requests for the same address. Uses the stored request
  // history, so the cooldown and hourly cap hold across restarts and instances.
  const { data: recentOtps, error: recentError } = await supabaseAdmin
    .from("email_otps")
    .select("created_at")
    .eq("email", email)
    .eq("purpose", "REGISTER")
    .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(OTP_MAX_REQUESTS_PER_HOUR);

  if (recentError) {
    console.error(`[AUTH] Failed to read recent OTPs for ${email}: ${recentError.message}`);
    throw new AppError(500, "Failed to create OTP");
  }

  const recent = recentOtps ?? [];
  const lastRequestAt = recent[0]?.created_at;
  if (
    lastRequestAt &&
    Date.now() - new Date(lastRequestAt).getTime() < OTP_REQUEST_COOLDOWN_SECONDS * 1000
  ) {
    throw new AppError(429, "Please wait a moment before requesting a new verification code.");
  }
  if (recent.length >= OTP_MAX_REQUESTS_PER_HOUR) {
    throw new AppError(429, "Too many verification codes requested. Please try again later.");
  }

  // Invalidate any prior unused OTPs for this email
  const { error: invalidationError } = await supabaseAdmin
    .from("email_otps")
    .update({ used_at: new Date().toISOString() })
    .eq("email", email)
    .eq("purpose", "REGISTER")
    .is("used_at", null);

  if (invalidationError) {
    console.error(
      `[AUTH] Failed to invalidate old OTPs for ${email}: ${invalidationError.message}`
    );
  }

  // Cryptographically secure draw (not Math.random) — see point 2 of hardening.
  const code = String(crypto.randomInt(100000, 1000000));
  // Per-code salt: stored hash is SHA-256 of "<salt>:<code>".
  const codeSalt = crypto.randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

  const { error } = await supabaseAdmin.from("email_otps").insert({
    email,
    code_hash: hashOtp(code, codeSalt),
    code_salt: codeSalt,
    purpose: "REGISTER",
    expires_at: expiresAt,
  });

  if (error) {
    console.error(`[AUTH] Failed to insert OTP for ${email}: ${error.message}`);
    throw new AppError(500, "Failed to create OTP");
  }

  console.log(`[AUTH] OTP generated for ${email}, accountExists=${accountExists}, expires=${expiresAt}`);

  // The email body differs (code vs. "you already have an account"), but the
  // HTTP response below is identical in both cases. The difference is only
  // visible to the owner of the mailbox, never to the caller.
  const subject = accountExists ? "Your Aptely account" : "Your Aptely verification code";
  const html = accountExists
    ? `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
        <h2 style="color:#f97316;margin-bottom:8px">You already have an Aptely account</h2>
        <p style="color:#6b7280;margin-bottom:24px">Someone tried to sign up with this email address. If that was you, simply sign in — or reset your password if you've forgotten it.</p>
        <p style="color:#9ca3af;font-size:12px;margin-top:24px">If this wasn't you, you can safely ignore this email.</p>
      </div>
    `
    : `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
        <h2 style="color:#f97316;margin-bottom:8px">Verify your email</h2>
        <p style="color:#6b7280;margin-bottom:24px">Enter this code to complete your Aptely signup. It expires in 10 minutes.</p>
        <div style="background:#f3f4f6;border-radius:12px;padding:24px;text-align:center;letter-spacing:0.3em;font-size:32px;font-weight:700;color:#111827">${code}</div>
        <p style="color:#9ca3af;font-size:12px;margin-top:24px">If you didn't request this, ignore this email.</p>
      </div>
    `;
  const text = accountExists
    ? `Someone tried to sign up with this email address. You already have an Aptely account — sign in, or reset your password if you've forgotten it.`
    : `Your Aptely verification code: ${code}\n\nExpires in 10 minutes.`;

  const { error: resendError } = await resend.emails.send({
    from: `${env.RESEND_FROM_NAME} <${env.RESEND_FROM_EMAIL}>`,
    to: email,
    subject,
    html,
    text,
  });

  if (resendError) {
    console.error("[AUTH] Failed to send OTP email via Resend:", resendError);
    throw new AppError(500, `Failed to send verification email: ${resendError.message}`);
  }

  // Uniform response — reveals nothing about whether the address is registered.
  res.status(200).json({ message: "If this address can be used, a verification code has been sent." });
});

// ─── POST /auth/register ──────────────────────────────────────────────────────

/**
 * Creates a new Supabase Auth user.
 * Supabase automatically fires the `handle_new_user` trigger which inserts a
 * row into `profiles` with the provided role.
 *
 * Flow:
 *  1. supabaseAdmin.auth.admin.createUser → creates auth.users row
 *  2. trigger auto-inserts profile with full_name + role from metadata
 *  3. Return access_token + user info
 */
export const register = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email, password, fullName, otp } = req.body as RegisterInput;

  // Verify OTP in production — skip in test environment
  if (process.env.NODE_ENV !== "test") {
    if (!otp) throw new AppError(400, "Verification code is required");

    const { data: otpRecord, error: otpLookupError } = await supabaseAdmin
      .from("email_otps")
      .select("id, code_hash, code_salt, expires_at, used_at, attempts")
      .eq("email", email)
      .eq("purpose", "REGISTER")
      .is("used_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpLookupError) {
      console.error(
        `[AUTH] OTP lookup error for ${email}: ${otpLookupError.message} (code: ${otpLookupError.code})`
      );
      throw new AppError(500, "Failed to verify code. Please try again.");
    }

    if (!otpRecord) {
      console.warn(`[AUTH] No valid OTP record found for ${email}`);
      throw new AppError(400, "Invalid or expired verification code");
    }
    if (new Date(otpRecord.expires_at) < new Date()) {
      console.warn(`[AUTH] OTP expired for ${email} (expired at ${otpRecord.expires_at})`);
      throw new AppError(400, "Verification code has expired");
    }

    // Too many wrong tries already: the code is dead, force a new request.
    if ((otpRecord.attempts ?? 0) >= MAX_OTP_ATTEMPTS) {
      await supabaseAdmin
        .from("email_otps")
        .update({ used_at: new Date().toISOString() })
        .eq("id", otpRecord.id)
        .is("used_at", null);
      console.warn(`[AUTH] OTP attempt limit reached for ${email}`);
      throw new AppError(429, "Too many incorrect attempts. Please request a new verification code.");
    }

    // Legacy codes predate per-code salts and can no longer be verified.
    if (!otpRecord.code_salt) {
      console.warn(`[AUTH] OTP record without salt for ${email}`);
      throw new AppError(400, "Invalid or expired verification code");
    }

    // Constant-time comparison so response timing can't be used to guess the code.
    const providedHash = hashOtp(otp, otpRecord.code_salt);
    const storedHash = otpRecord.code_hash;
    const codeMatches =
      storedHash.length === providedHash.length &&
      crypto.timingSafeEqual(Buffer.from(storedHash, "utf8"), Buffer.from(providedHash, "utf8"));

    if (!codeMatches) {
      // Atomic increment + lock in the database: a single statement serialized by
      // the row lock, so concurrent wrong guesses cannot lose an attempt.
      const { data: newAttempts, error: attemptError } = await supabaseAdmin.rpc(
        "record_otp_failed_attempt",
        { p_otp_id: otpRecord.id, p_max_attempts: MAX_OTP_ATTEMPTS }
      );

      if (attemptError) {
        console.error(
          `[AUTH] Failed to record OTP attempt for ${email}: ${attemptError.message}`
        );
        throw new AppError(500, "Failed to verify code. Please try again.");
      }

      // No row updated means the code was already consumed/locked concurrently.
      const attempts = typeof newAttempts === "number" ? newAttempts : MAX_OTP_ATTEMPTS;
      const remaining = MAX_OTP_ATTEMPTS - attempts;

      console.warn(
        `[AUTH] OTP hash mismatch for ${email} (attempt ${attempts}/${MAX_OTP_ATTEMPTS})`
      );

      if (remaining <= 0) {
        throw new AppError(429, "Too many incorrect attempts. Please request a new verification code.");
      }
      throw new AppError(
        400,
        `Incorrect verification code. ${remaining} attempt${remaining > 1 ? "s" : ""} remaining.`
      );
    }

    // Consume the code atomically: only one request can win, so a consumed code
    // can never be replayed (a second concurrent submit is rejected).
    const { data: consumed, error: consumeError } = await supabaseAdmin
      .from("email_otps")
      .update({ used_at: new Date().toISOString() })
      .eq("id", otpRecord.id)
      .is("used_at", null)
      .select("id");

    if (consumeError || !consumed || consumed.length === 0) {
      console.warn(`[AUTH] OTP already consumed for ${email}`);
      throw new AppError(400, "Invalid or expired verification code");
    }
  }

  // 1. Create auth user (trigger auto-creates profile row).
  // Post-refactor: no role at signup. Users land in their personal workspace and
  // can create or join an Institution afterwards.
  const { data: authData, error: authError } = await retryWithBackoff(
    async () =>
      supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
        app_metadata: { active_institution_id: null, institution_id: null, is_super_admin: false },
      }),
    { maxRetries: 3, operation: "Create Auth User" }
  );

  if (authError) {
    if (authError.message.toLowerCase().includes("already registered")) {
      throw new AppError(409, "An account with this email already exists");
    }
    throw new AppError(400, authError.message);
  }

  const userId = authData.user.id;

  await supabaseAdmin.from("profiles").update({ full_name: fullName }).eq("id", userId);

  await syncUserClaims(userId, { institutionId: null, isSuperAdmin: false });

  // 2. Sign in to get tokens
  // WITH RETRY: This is critical for user experience
  const { data: sessionData, error: sessionError } = await retryWithBackoff(
    async () => createUserClient().auth.signInWithPassword({ email, password }),
    { maxRetries: 3, operation: "Sign In After Register" }
  );

  if (sessionError || !sessionData.session) {
    console.warn(`[AUTH] Signin failed for ${userId} (${email}): ${sessionError?.message}`);
    res.status(201).json({
      message: "Account created successfully. Please log in.",
      user: {
        id: userId,
        email,
        institutionId: null,
        activeInstitutionId: null,
      },
    });
    return;
  }

  res.status(201).json({
    message: "Account created successfully",
    user: {
      id: userId,
      email,
      institutionId: null,
      activeInstitutionId: null,
    },
    session: {
      accessToken: sessionData.session.access_token,
      refreshToken: sessionData.session.refresh_token,
      expiresAt: sessionData.session.expires_at,
    },
  });
});

// ─── POST /auth/register ──────────────────────────────────────────────────────

export const googleAuthUrl = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const { data, error } = await supabaseAdmin.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${env.FRONTEND_URL}/auth/callback`,
    },
  });

  if (error || !data.url) {
    throw new AppError(500, "Failed to initialize Google Auth");
  }

  res.status(200).json({ url: data.url });
});

// ─── POST /auth/login ─────────────────────────────────────────────────────────

/**
 * Authenticates a user with email + password.
 * Returns access_token, refresh_token, and basic user profile.
 */
export const login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as LoginInput;

  // WITH RETRY: Login can timeout
  const { data, error } = await retryWithBackoff(
    async () => createUserClient().auth.signInWithPassword({ email, password }),
    { maxRetries: 3, operation: "Login" }
  );

  if (error || !data.session) {
    throw new AppError(401, "Invalid email or password");
  }

  if (!data.user.email) {
    throw new AppError(500, "User email not found");
  }

  // Fetch profile for institution info
  // WITH RETRY: Profile fetch can timeout
  const { data: profile, error: profileError } = await retryWithBackoff(
    async () =>
      supabaseAdmin
        .from("profiles")
        .select("full_name, institution_id, last_active_institution_id, avatar_url, role")
        .eq("id", data.user.id)
        .single(),
    { maxRetries: 3, operation: `Fetch Profile for ${data.user.id}` }
  );

  // If profile doesn't exist (race condition or trigger failed), create it
  if (profileError || !profile) {
    console.warn(`[AUTH] Profile missing for user ${data.user.id}, creating fallback...`);
    console.warn(`[AUTH] profileError: ${profileError?.message}`);
    const { error: createError } = await supabaseAdmin.from("profiles").insert({
      id: data.user.id,
      email: data.user.email,
      full_name: data.user.user_metadata?.full_name ?? data.user.email.split("@")[0],
    });

    if (createError) {
      console.error(`[AUTH] Failed to create fallback profile: ${createError.message}`);
      console.error(`[AUTH] Full error:`, createError);
      throw new AppError(500, "Failed to load user profile");
    }

    // Fetch the newly created profile
    const { data: newProfile, error: newProfileError } = await supabaseAdmin
      .from("profiles")
      .select("full_name, institution_id, avatar_url")
      .eq("id", data.user.id)
      .single();

    if (newProfileError || !newProfile) {
      console.error(`[AUTH] Failed to verify fallback profile: ${newProfileError?.message}`);
      throw new AppError(500, "Failed to load user profile");
    }

    const superAdmin = await isSuperAdminUser(data.user.id);
    await syncUserClaims(data.user.id, {
      institutionId: newProfile.institution_id,
      isSuperAdmin: superAdmin,
    });

    const { data: refreshedSessionData } = await createUserClient().auth.refreshSession({
      refresh_token: data.session.refresh_token,
    });

    const accessToken = refreshedSessionData.session?.access_token ?? data.session.access_token;
    const refreshToken = refreshedSessionData.session?.refresh_token ?? data.session.refresh_token;
    const expiresAt = refreshedSessionData.session?.expires_at ?? data.session.expires_at;

    res.status(200).json({
      user: {
        id: data.user.id,
        email: data.user.email,
        fullName: newProfile.full_name,
        institutionId: newProfile.institution_id ?? null,
        avatarUrl: newProfile.avatar_url ?? null,
        isSuperAdmin: superAdmin,
      },
      session: {
        accessToken,
        refreshToken,
        expiresAt,
      },
    });
    return;
  }

  // Resolve active workspace: explicit last_active wins; otherwise fall back to most-recent active membership; otherwise null (personal).
  let activeInstitutionId: string | null = profile.last_active_institution_id ?? null;
  if (!activeInstitutionId) {
    const { data: memberships } = await supabaseAdmin
      .from("institution_members")
      .select("institution_id, status, joined_at")
      .eq("user_id", data.user.id)
      .in("status", ["OWNER", "ADMIN", "ACTIVE"])
      .order("joined_at", { ascending: false })
      .limit(1);
    activeInstitutionId = memberships?.[0]?.institution_id ?? null;
  }

  const superAdmin = await isSuperAdminUser(data.user.id);
  await syncUserClaims(data.user.id, {
    institutionId: profile.institution_id,
    activeInstitutionId,
    isSuperAdmin: superAdmin,
  });

  const { data: refreshedSessionData } = await createUserClient().auth.refreshSession({
    refresh_token: data.session.refresh_token,
  });

  const accessToken = refreshedSessionData.session?.access_token ?? data.session.access_token;
  const refreshToken = refreshedSessionData.session?.refresh_token ?? data.session.refresh_token;
  const expiresAt = refreshedSessionData.session?.expires_at ?? data.session.expires_at;

  res.status(200).json({
    user: {
      id: data.user.id,
      email: data.user.email,
      fullName: profile.full_name,
      institutionId: profile.institution_id ?? null,
      activeInstitutionId,
      avatarUrl: profile.avatar_url ?? null,
      profileRole: (profile as { role?: string | null }).role ?? null,
      isSuperAdmin: superAdmin,
    },
    session: {
      accessToken,
      refreshToken,
      expiresAt,
    },
  });
});

// ─── POST /auth/refresh ───────────────────────────────────────────────────────

/**
 * Exchanges a refresh_token for a new access_token.
 * The old refresh_token is invalidated (rotation is enabled by default in Supabase).
 */
export const refresh = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body as RefreshInput;

  // WITH RETRY: Token refresh can timeout
  const { data, error } = await retryWithBackoff(
    async () => createUserClient().auth.refreshSession({ refresh_token: refreshToken }),
    { maxRetries: 3, operation: "Refresh Session" }
  );

  if (error || !data.session) {
    throw new AppError(401, "Invalid or expired refresh token");
  }

  res.status(200).json({
    session: {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at,
    },
  });
});

// ─── POST /auth/logout ────────────────────────────────────────────────────────

/**
 * Revokes the user's current session on the Supabase side.
 * Requires a valid Bearer token in the Authorization header (authGuard).
 *
 * What "logout" means server-side with Supabase:
 * - We call auth.admin.signOut(userId) to invalidate ALL sessions for the user.
 * - The client must also clear its local token storage.
 */
export const logout = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    // auth.admin.signOut prend le JWT token, pas le user ID
    const token = req.headers.authorization!.replace("Bearer ", "");

    const { error } = await supabaseAdmin.auth.admin.signOut(token);

    if (error) {
      throw new AppError(500, "Failed to invalidate session");
    }

    res.status(200).json({ message: "Logged out successfully" });
  }
);

// Ajoute après la fonction logout() :

export const forgotPassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body as ForgotPasswordInput;

  // Generate reset link via Supabase Admin (bypasses Supabase email delivery)
  // Then send via Resend which supports all email domains (@gmail, @custom-domain, etc.)
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${env.FRONTEND_URL}/reset-password` },
  });

  if (linkError || !linkData?.properties?.action_link) {
    // Don't reveal whether the email exists — always return 200
    res.status(200).json({ message: "Password reset email sent" });
    return;
  }

  const resetLink = linkData.properties.action_link;
  const userName = linkData.user?.user_metadata?.full_name || email.split("@")[0];

  // Send via Resend — works with all domains (@custom-domain, @gmail, etc.)
  const resend = new Resend(env.RESEND_API_KEY);

  const { error: emailError } = await resend.emails.send({
    from: `${env.RESEND_FROM_NAME} <${env.RESEND_FROM_EMAIL}>`,
    to: email,
    subject: "Réinitialisation de votre mot de passe Aptely",
    html: `
      <div style="background:#0f1117;padding:32px 0;font-family:sans-serif;">
        <div style="max-width:520px;margin:0 auto;background:#1a1d2e;border-radius:12px;padding:40px;color:#f0f0f0;">
          <div style="text-align:center;margin-bottom:28px;">
            <span style="font-size:28px;font-weight:900;letter-spacing:-1px;color:#FF6B00;">Aptely</span>
          </div>
          <h2 style="font-size:20px;font-weight:700;margin:0 0 12px;color:#ffffff;">Réinitialisation du mot de passe</h2>
          <p style="color:#9ca3af;font-size:14px;line-height:1.6;margin:0 0 24px;">
            Bonjour ${userName},<br/><br/>
            Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe.
          </p>
          <div style="text-align:center;margin:28px 0;">
            <a href="${resetLink}" style="display:inline-block;background:#FF6B00;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">
              Réinitialiser mon mot de passe
            </a>
          </div>
          <p style="color:#6b7280;font-size:12px;margin:24px 0 0;">
            Ce lien expire dans 24 heures. Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
          </p>
          <hr style="border:0;border-top:1px solid #2d3148;margin:24px 0;">
          <p style="color:#4b5563;font-size:11px;text-align:center;margin:0;">
            Aptely — Precision HR Software
          </p>
        </div>
      </div>
    `,
    text: `Réinitialisation du mot de passe Aptely\n\nBonjour ${userName},\n\nCliquez sur ce lien pour réinitialiser votre mot de passe :\n${resetLink}\n\nCe lien expire dans 24 heures.\n\nSi vous n'avez pas demandé cette réinitialisation, ignorez cet email.`,
  });

  if (emailError) {
    console.error("[AUTH][forgotPassword] Resend error:", emailError.message);
    // Still return 200 — don't leak whether email exists
  }

  res.status(200).json({ message: "Password reset email sent" });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { token_hash, password, access_token } = req.body as ResetPasswordInput & {
    access_token?: string;
  };

  const tokenLooksLikeJwt = token_hash?.split(".").length === 3;
  const accessToken = access_token ?? (tokenLooksLikeJwt ? token_hash : undefined);

  let userId: string | null = null;

  if (accessToken) {
    const { data: userData, error: userError } = await retryWithBackoff(
      async () => supabaseAdmin.auth.getUser(accessToken),
      { maxRetries: 3, operation: "Verify Reset Access Token" }
    );

    if (userError || !userData.user) {
      throw new AppError(400, "Invalid or expired reset token");
    }

    userId = userData.user.id;
  } else {
    if (!token_hash) {
      throw new AppError(400, "Invalid or expired reset token");
    }

    // WITH RETRY: OTP verification can timeout
    const { data: verifyData, error: verifyError } = await retryWithBackoff(
      async () => supabaseAdmin.auth.verifyOtp({ token_hash, type: "recovery" }),
      { maxRetries: 3, operation: "Verify Reset Token" }
    );

    if (verifyError || !verifyData.user) {
      throw new AppError(400, "Invalid or expired reset token");
    }

    userId = verifyData.user.id;
  }

  // WITH RETRY: Password update can timeout
  const { error } = await retryWithBackoff(
    async () =>
      supabaseAdmin.auth.admin.updateUserById(userId, {
        password,
      }),
    { maxRetries: 3, operation: `Update Password for ${userId}` }
  );

  if (error) {
    throw new AppError(400, "Failed to reset password");
  }

  res.status(200).json({ message: "Password reset successfully" });
});

// ─── GET /auth/me ────────────────────────────────────────────────────────────

/**
 * Returns the current authenticated user's profile info.
 * Used by frontend to check if user has been approved for an institution.
 * Also returns pending join request if user is waiting for approval.
 * Requires a valid Bearer token in the Authorization header (authGuard).
 */
export const getMe = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError(401, "Unauthorized");
    }


    // Fetch the user's profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("full_name, institution_id, avatar_url")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      throw new AppError(404, "User profile not found");
    }

    // Check if user has a pending join request
    let pendingJoinRequest = null;
    if (!profile.institution_id) {
      const { data: joinReq } = await supabaseAdmin
        .from("institution_members")
        .select("institution_id, institutions(name)")
        .eq("user_id", userId)
        .eq("status", "PENDING")
        .single();

      if (joinReq) {
        pendingJoinRequest = {
          institutionId: joinReq.institution_id,
          institutionName: (joinReq.institutions as any)?.name || "Unknown",
        };
      }
    }

    // Only sync claims when they differ from the JWT to avoid write on every request
    const superAdmin = await isSuperAdminUser(userId);
    const claimsMatch =
      (req.user?.institutionId ?? null) === (profile.institution_id ?? null) &&
      superAdmin === (req.user?.isSuperAdmin ?? false);

    if (!claimsMatch) {
      await syncUserClaims(userId, {
        institutionId: profile.institution_id,
        isSuperAdmin: superAdmin,
      });
    }

    const effectiveInstitutionId = req.user?.activeInstitutionId ?? profile.institution_id ?? null;

    res.status(200).json({
      id: userId,
      email: req.user?.email,
      fullName: profile.full_name,
      institutionId: effectiveInstitutionId,
      avatarUrl: profile.avatar_url ?? null,
      pendingJoinRequest,
      isSuperAdmin: superAdmin,
    });
  }
);

// ─── Avatar upload ──────────────────────────────────────────────────────────

const AVATAR_EXTS = ["jpg", "jpeg", "png", "webp"];

export const presignAvatarUpload = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) throw new AppError(401, "Unauthorized");

    const { fileName } = req.body as { fileName?: string };
    if (!fileName || typeof fileName !== "string") {
      throw new AppError(400, "fileName is required");
    }
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
    if (!AVATAR_EXTS.includes(ext)) {
      throw new AppError(415, "Only JPG, PNG or WEBP images are allowed");
    }

    const path = buildAvatarPath(userId, fileName);
    const { data, error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKETS.AVATARS)
      .createSignedUploadUrl(path);

    if (error || !data) throw new AppError(500, "Failed to create upload URL");
    res.status(200).json({ signedUrl: data.signedUrl, token: data.token, path });
  }
);

export const setAvatar = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) throw new AppError(401, "Unauthorized");

    const { path } = req.body as { path?: string };
    if (!path || typeof path !== "string") throw new AppError(400, "path is required");
    // The avatar path is prefixed with the user's id — reject paths that aren't theirs.
    if (!path.includes(userId)) throw new AppError(403, "Invalid avatar path");

    const { data: pub } = supabaseAdmin.storage.from(STORAGE_BUCKETS.AVATARS).getPublicUrl(path);
    const avatarUrl = `${pub.publicUrl}?v=${Date.now()}`;

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", userId);

    if (error) throw new AppError(500, "Failed to save avatar");
    res.status(200).json({ avatarUrl });
  }
);

// ─── DELETE /auth/me ────────────────────────────────────────────────────────

export const deleteMyAccount = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const institutionId = req.user?.institutionId ?? null;
    const input = req.body as DeleteMyAccountInput;

    if (!userId) {
      throw new AppError(401, "Unauthorized");
    }

    if (!input.confirm) {
      throw new AppError(422, "Account deletion must be explicitly confirmed");
    }

    if (institutionId) {
      const { data: membership, error: membershipError } = await supabaseAdmin
        .from("institution_members")
        .select("status")
        .eq("user_id", userId)
        .eq("institution_id", institutionId)
        .maybeSingle();

      if (membershipError) {
        throw new AppError(500, "Failed to verify institution membership");
      }

      if (membership?.status === "OWNER") {
        const { count, error: ownersError } = await supabaseAdmin
          .from("institution_members")
          .select("id", { count: "exact", head: true })
          .eq("institution_id", institutionId)
          .eq("status", "OWNER");

        if (ownersError) {
          throw new AppError(500, "Failed to verify institution ownership");
        }

        if ((count ?? 0) <= 1) {
          throw new AppError(
            409,
            "You are the only OWNER of this institution. Promote another owner before deleting your account."
          );
        }
      }

      await supabaseAdmin
        .from("institution_members")
        .delete()
        .eq("user_id", userId)
        .eq("institution_id", institutionId);

      // Reassign interview-related data to another owner before deleting
      const { data: altOwners } = await supabaseAdmin
        .from("institution_members")
        .select("user_id")
        .eq("institution_id", institutionId)
        .eq("status", "OWNER")
        .neq("user_id", userId)
        .limit(1);

      const altOwnerId = altOwners?.[0]?.user_id;

      if (altOwnerId) {
        await supabaseAdmin
          .from("interviews")
          .update({ created_by: altOwnerId })
          .eq("created_by", userId);
        await supabaseAdmin
          .from("interview_guides")
          .update({ created_by: altOwnerId })
          .eq("created_by", userId);
        await supabaseAdmin
          .from("scorecard_templates")
          .update({ created_by: altOwnerId })
          .eq("created_by", userId);
      }
    }

    // Delete data where the user is a participant or reviewer (blocking NOT NULL references)
    await supabaseAdmin.from("interviewers").delete().eq("user_id", userId);
    await supabaseAdmin.from("interview_participants").delete().eq("user_id", userId);
    await supabaseAdmin.from("interview_scorecards").delete().eq("reviewer_id", userId);
    await supabaseAdmin.from("scorecard_audit_logs").delete().eq("actor_id", userId);

    await supabaseAdmin.from("profiles").update({ institution_id: null }).eq("id", userId);

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) {
      throw new AppError(500, "Failed to delete account");
    }

    res.status(200).json({ message: "Account deleted successfully" });
  }
);
