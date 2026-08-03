import en from "@/i18n/locales/en.json";
import fr from "@/i18n/locales/fr.json";

export const SUPPORTED_LOCALES = ["fr", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fr";

const LOCALE_PATTERN = /^\/(fr|en)(?=\/|$)/;

const DICTIONARIES: Record<Locale, Record<string, string>> = {
  fr,
  en,
};

function isLocale(value: string | null | undefined): value is Locale {
  return value === "fr" || value === "en";
}

export function getLocaleFromPathname(pathname: string | null | undefined): Locale | null {
  if (!pathname) return null;
  const match = pathname.match(LOCALE_PATTERN);
  if (!match) return null;
  return isLocale(match[1]) ? match[1] : null;
}

export function removeLocalePrefix(pathname: string | null | undefined): string {
  if (!pathname) return "/";
  return pathname.replace(LOCALE_PATTERN, "") || "/";
}

export function getLocaleFromCookie(cookieString: string | null | undefined): Locale | null {
  if (!cookieString) return null;
  const match = cookieString.match(/(?:^|; )NEXT_LOCALE=([^;]+)/);
  if (!match) return null;
  const decoded = decodeURIComponent(match[1]).toLowerCase();
  return isLocale(decoded) ? decoded : null;
}

export function setLocaleCookie(locale: Locale) {
  if (typeof document === "undefined") return;
  document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

function parseAcceptLanguage(headerValue: string | null | undefined): Locale {
  if (!headerValue) return DEFAULT_LOCALE;

  const entries = headerValue
    .split(",")
    .map((entry) => {
      const [language, qualityPart] = entry.trim().split(";");
      const qValue = qualityPart?.startsWith("q=") ? Number(qualityPart.slice(2)) : 1;
      return {
        language: language.toLowerCase(),
        quality: Number.isFinite(qValue) ? qValue : 1,
      };
    })
    .sort((a, b) => b.quality - a.quality);

  for (const entry of entries) {
    if (entry.language.startsWith("fr")) return "fr";
    if (entry.language.startsWith("en")) return "en";
  }

  return DEFAULT_LOCALE;
}

export function getClientLocale(pathname?: string | null): Locale {
  const fromPath = getLocaleFromPathname(pathname ?? (typeof window !== "undefined" ? window.location.pathname : null));
  if (fromPath) return fromPath;

  if (typeof document !== "undefined") {
    const fromCookie = getLocaleFromCookie(document.cookie);
    if (fromCookie) return fromCookie;
  }

  if (typeof navigator !== "undefined") {
    return parseAcceptLanguage(navigator.languages?.join(",") || navigator.language || null);
  }

  const envLocale = process.env.NEXT_PUBLIC_UI_LOCALE?.toLowerCase();
  return isLocale(envLocale) ? envLocale : DEFAULT_LOCALE;
}

export function resolveLocaleFromRequest(
  cookieLocale: string | null | undefined,
  acceptLanguage: string | null | undefined,
): Locale {
  if (isLocale(cookieLocale?.toLowerCase())) return cookieLocale.toLowerCase() as Locale;
  return parseAcceptLanguage(acceptLanguage);
}

export function localizePath(path: string, locale: Locale): string {
  const safePath = path || "/";
  const [withoutHash, hash = ""] = safePath.split("#");
  const [pathnamePart, search = ""] = withoutHash.split("?");
  const pathname = removeLocalePrefix(pathnamePart || "/");

  const prefixedPath = pathname === "/" ? `/${locale}` : `/${locale}${pathname}`;

  return `${prefixedPath}${search ? `?${search}` : ""}${hash ? `#${hash}` : ""}`;
}

export function t(locale: Locale, key: string, fallback?: string, params?: Record<string, string | number>): string {
  let resolvedKey = key;
  if (params?.count === 1) {
    const oneKey = `${key}_one`;
    if (DICTIONARIES[locale][oneKey]) resolvedKey = oneKey;
  }
  let value = DICTIONARIES[locale][resolvedKey] || fallback || key;
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      value = value.replace(new RegExp(`{{${k}}}`, "g"), String(v));
    });
  }
  return value;
}

/**
 * Server-side helper to get the current locale. Must be used in Server Components/Actions.
 *
 * Resolution order (most → least reliable across environments):
 *  1. `x-locale` request header — set by middleware from the path. Works locally; can be
 *     dropped on Vercel when the static rewrite `/[locale]/:path*` → `/:path*` re-renders RSC.
 *  2. `referer` header — the requesting page URL still carries the `/en` (or `/fr`) prefix on
 *     RSC sub-requests even when the rewritten render loses `x-locale`. This is the Vercel fix.
 *  3. `NEXT_LOCALE` cookie — set by middleware and the locale toggle; matches the user's choice.
 *  4. `DEFAULT_LOCALE`.
 */
export async function getServerLocale(): Promise<Locale> {
  const { headers, cookies } = await import("next/headers");
  const headersList = await headers();

  const fromHeader = headersList.get("x-locale");
  if (isLocale(fromHeader)) return fromHeader;

  const referer = headersList.get("referer");
  if (referer) {
    try {
      const fromReferer = getLocaleFromPathname(new URL(referer).pathname);
      if (fromReferer) return fromReferer;
    } catch {
      // ignore malformed referer
    }
  }

  const cookieStore = await cookies();
  const fromCookie = cookieStore.get("NEXT_LOCALE")?.value;
  if (isLocale(fromCookie)) return fromCookie;

  return DEFAULT_LOCALE;
}
