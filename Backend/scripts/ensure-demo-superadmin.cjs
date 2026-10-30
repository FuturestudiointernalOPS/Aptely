/**
 * Ensure a replayable demo Super Admin exists for local/QA.
 *
 * Email:    superadmin@aptely.demo
 * Password: AptelyDemo123!  (same as other demo accounts)
 *
 * Idempotent: creates auth user + profile if missing, upserts super_admins,
 * syncs app_metadata.is_super_admin = true, resets password to the demo one.
 *
 * Usage (from Backend/):
 *   node scripts/ensure-demo-superadmin.cjs
 *
 * Requires Backend/.env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
 */

const path = require("path");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const EMAIL = "superadmin@aptely.demo";
const PASSWORD = "AptelyDemo123!";
const FULL_NAME = "Aptely Super Admin";

async function main() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !serviceKey || !anonKey) {
    console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY in Backend/.env");
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anon = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1) Resolve or create auth user
  let userId = null;
  const { data: listed, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listErr) {
    console.error("listUsers failed:", listErr.message);
    process.exit(1);
  }
  const existing = (listed?.users ?? []).find(
    (u) => (u.email || "").toLowerCase() === EMAIL.toLowerCase(),
  );

  if (existing) {
    userId = existing.id;
    console.log(`[ok] Auth user exists: ${EMAIL} (${userId})`);
    const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: FULL_NAME },
      app_metadata: {
        institution_id: null,
        active_institution_id: null,
        is_super_admin: true,
      },
    });
    if (updErr) {
      console.error("updateUserById failed:", updErr.message);
      process.exit(1);
    }
    console.log("[ok] Password + is_super_admin claim refreshed");
  } else {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: FULL_NAME },
      app_metadata: {
        institution_id: null,
        active_institution_id: null,
        is_super_admin: true,
      },
    });
    if (createErr || !created?.user) {
      console.error("createUser failed:", createErr?.message ?? "no user");
      process.exit(1);
    }
    userId = created.user.id;
    console.log(`[ok] Auth user created: ${EMAIL} (${userId})`);
  }

  // 2) Ensure profiles row
  const { data: profile } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (!profile) {
    const { error: insertProfileErr } = await admin.from("profiles").insert({
      id: userId,
      email: EMAIL,
      full_name: FULL_NAME,
    });
    if (insertProfileErr) {
      console.error("profiles insert failed:", insertProfileErr.message);
      process.exit(1);
    }
    console.log("[ok] profiles row created");
  } else {
    await admin.from("profiles").update({ full_name: FULL_NAME, email: EMAIL }).eq("id", userId);
    console.log("[ok] profiles row present");
  }

  // 3) Upsert super_admins
  const { error: saErr } = await admin.from("super_admins").upsert(
    { user_id: userId },
    { onConflict: "user_id" },
  );
  if (saErr) {
    console.error("super_admins upsert failed:", saErr.message);
    process.exit(1);
  }
  console.log("[ok] super_admins row upserted");

  // 4) Smoke login
  const { data: session, error: loginErr } = await anon.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  if (loginErr || !session?.session) {
    console.error("login smoke failed:", loginErr?.message ?? "no session");
    process.exit(1);
  }
  console.log("[ok] Login smoke OK — access token received");

  // 5) Confirm claim + table
  const { data: saRow } = await admin
    .from("super_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!saRow) {
    console.error("super_admins row missing after upsert");
    process.exit(1);
  }

  console.log("");
  console.log("Demo Super Admin ready:");
  console.log(`  email:    ${EMAIL}`);
  console.log(`  password: ${PASSWORD}`);
  console.log("  routes:   /admin  /admin/metrics  /admin/users  /admin/institutions");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
