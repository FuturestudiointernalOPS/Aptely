/**
 * APTELY — Next.js Proxy
 *
 * Runs on the Edge before every request. Enforces:
 * 1. Authentication guard — redirects unauthenticated users to /login
 * 2. Role-based access control
 * 3. Basic path-level input sanitation
 */

import { NextRequest, NextResponse } from "next/server";
import { ROUTES } from "@/lib/routes";

/** Routes that require HR authentication */
const HR_ROUTES = [ROUTES.company.dashboard, "/roles", "/applications", "/institution"];

/** Routes that are always public (no auth required) */
const PUBLIC_ROUTES = [
  ROUTES.login,
  ROUTES.register,
  "/join",
  "/apply",
  "/_next",
  "/favicon.ico",
];

const SUSPICIOUS_PATTERNS = [
  /\.\.\//,
  /<script/i,
  /javascript:/i,
  /\x00/,
  /\.php$/i,
  /\.env/i,
  /\/etc\/passwd/i,
  /union.*select/i,
];

function isSuspiciousPath(pathname: string): boolean {
  return SUSPICIOUS_PATTERNS.some((pattern) => pattern.test(pathname));
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isSuspiciousPath(pathname)) {
    return new NextResponse("Bad Request", { status: 400 });
  }

  if (PUBLIC_ROUTES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const hrToken = req.cookies.get("hr_access_token")?.value;

  const isHRRoute = HR_ROUTES.some((r) => pathname.startsWith(r));

  if (isHRRoute && !hrToken) {
    const loginUrl = new URL(ROUTES.login, req.url);
    loginUrl.searchParams.set("from", pathname);
    loginUrl.searchParams.set("role", "hr");
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
