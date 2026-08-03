import { Router } from "express";
import { authRateLimiter } from "@/middleware/rateLimiter.middleware";
import { authGuard } from "@/middleware/auth.middleware";
import { validate } from "@/middleware/validate.middleware";
import {
  registerSchema,
  requestOtpSchema,
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  deleteMyAccountSchema,
} from "./auth.schema";
import {
  register,
  requestSignupOtp,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  getMe,
  deleteMyAccount,
  googleAuthUrl,
  presignAvatarUpload,
  setAvatar,
} from "./auth.controller";
const router = Router();

router.get("/google", googleAuthUrl);

/**
 * @route   POST /auth/register
 * @desc    Create a new account
 * @access  Public
 * @rateLimit authRateLimiter (20 req / 15 min)
 *
 * Body: { email, password, fullName }
 * Returns: { user, session }
 */
router.post("/register/request-otp", authRateLimiter, validate(requestOtpSchema), requestSignupOtp);
router.post("/register", authRateLimiter, validate(registerSchema), register);

/**
 * @route   POST /auth/login
 * @desc    Sign in with email + password
 * @access  Public
 * @rateLimit authRateLimiter (20 req / 15 min)
 *
 * Body: { email, password }
 * Returns: { user, session }
 */
router.post("/login", authRateLimiter, validate(loginSchema), login);

/**
 * @route   POST /auth/refresh
 * @desc    Rotate refresh token and get a new access token
 * @access  Public (uses refresh token as credential)
 *
 * Body: { refreshToken }
 * Returns: { session }
 */
router.post("/refresh", authRateLimiter, validate(refreshSchema), refresh);

/**
 * @route   POST /auth/logout
 * @desc    Revoke the authenticated user's session(s)
 * @access  Private — requires valid Bearer access token
 *
 * Headers: Authorization: Bearer <accessToken>
 * Returns: { message }
 */
router.post("/logout", authGuard, logout);
router.post("/forgot-password", authRateLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", authRateLimiter, validate(resetPasswordSchema), resetPassword);

/**
 * @route   GET /auth/me
 * @desc    Get the current authenticated user's profile
 * @access  Private — requires valid Bearer access token
 *
 * Headers: Authorization: Bearer <accessToken>
 * Returns: { id, email, fullName, institutionId, avatarUrl }
 */
router.get("/me", authGuard, getMe);
router.delete("/me", authGuard, validate(deleteMyAccountSchema), deleteMyAccount);
router.post("/avatar/presign", authGuard, presignAvatarUpload);
router.post("/avatar", authGuard, setAvatar);

export { router as authRouter };
