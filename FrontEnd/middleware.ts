import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_LOCALE,
  getLocaleFromCookie,
  getLocaleFromPathname,
  resolveLocaleFromRequest,
  SUPPORTED_LOCALES,
} from "./src/lib/i18n";

type Locale = (typeof SUPPORTED_LOCALES)[number];

// Public marketing pages (landing Navbar/Footer) default to English for first-time
// visitors regardless of browser language — a visitor picks French explicitly via the
// locale toggle, which sets the NEXT_LOCALE cookie and is respected from then on.
const MARKETING_PATHS = new Set(["/", "/tarifs", "/demo"]);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // On Vercel the next.config static rewrite `/[locale]/:path* → /:path*` can strip the
  // locale prefix from `request.nextUrl` before middleware reads it, so the cookie/header
  // never get the right locale. The original request URL still carries the `/en` (or `/fr`)
  // prefix — fall back to it so the locale is always detected from the path the user visited.
  let originalPathname = pathname;
  try {
    originalPathname = new URL(request.url).pathname;
  } catch {
    // keep nextUrl pathname
  }

  const localeFromPath = getLocaleFromPathname(pathname) ?? getLocaleFromPathname(originalPathname);

  if (!localeFromPath) {
    const cookieValue = request.cookies.get("NEXT_LOCALE")?.value;
    const hasExplicitLocaleCookie = !!getLocaleFromCookie(
      cookieValue ? `NEXT_LOCALE=${cookieValue}` : null,
    );
    const locale: Locale =
      MARKETING_PATHS.has(pathname) && !hasExplicitLocaleCookie
        ? "en"
        : (resolveLocaleFromRequest(cookieValue, request.headers.get("accept-language")) as Locale);

    // Prevent redirecting Next.js RSC requests, which causes 404s in production.
    const isRSC = request.headers.get("RSC") === "1" || request.nextUrl.searchParams.has("_rsc");
    if (isRSC) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-locale", locale);
      return NextResponse.next({
        request: { headers: requestHeaders },
      });
    }

    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = `/${locale}${pathname}`;

    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set("NEXT_LOCALE", locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    return response;
  }

  const locale = localeFromPath;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-locale", locale || DEFAULT_LOCALE);

  // No rewrite needed: next.config.mjs static rewrite maps /[locale]/:path* → /:path*
  // Static rewrites work correctly with RSC; middleware rewrites do not on Vercel.
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.cookies.set("NEXT_LOCALE", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return response;
}

export const config = {
  matcher: ["/((?!api|_next|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)"],
};
