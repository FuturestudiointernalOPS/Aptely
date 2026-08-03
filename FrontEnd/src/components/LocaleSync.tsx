"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getLocaleFromPathname, getLocaleFromCookie, setLocaleCookie } from "@/lib/i18n";

/**
 * Keeps the NEXT_LOCALE cookie in sync with the locale in the URL.
 *
 * Why this exists: on Vercel the next.config static rewrite `/[locale]/:path* → /:path*`
 * strips the locale prefix at the edge BEFORE middleware/server code runs, so the server
 * cannot read the locale from the path and falls back to the (possibly stale) cookie.
 * Server components (dashboard, metadata, <html lang>) would then render the wrong language
 * on a cold direct load of an `/en` URL while the cookie still says `fr` (or vice-versa).
 *
 * The client always sees the real path (`/en/...`). When the cookie disagrees with the URL
 * locale, we update the cookie and trigger a single `router.refresh()` so the server re-renders
 * with the correct locale. When they already match (the common case) this is a no-op.
 */
export function LocaleSync() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const urlLocale = getLocaleFromPathname(pathname);
    if (!urlLocale) return; // no locale prefix in URL → nothing to enforce

    const cookieLocale = getLocaleFromCookie(document.cookie);
    if (cookieLocale === urlLocale) return; // already in sync

    setLocaleCookie(urlLocale);
    router.refresh(); // re-render server components with the corrected cookie
  }, [pathname, router]);

  return null;
}
