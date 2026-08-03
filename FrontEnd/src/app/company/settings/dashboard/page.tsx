"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ROUTES } from "@/lib/routes";


const LOCALES = ["fr", "en"] as const;
type Locale = (typeof LOCALES)[number];

function getLocaleFromPathname(pathname: string): Locale | null {
  const first = pathname.split("/")[1];
  return (LOCALES as readonly string[]).includes(first) ? (first as Locale) : null;
}

export default function InstitutionDashboardRedirectPage() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const locale = getLocaleFromPathname(pathname);
    router.replace(locale ? `/${locale}/dashboard` : ROUTES.company.dashboard);
  }, [router, pathname]);

  return null;
}
