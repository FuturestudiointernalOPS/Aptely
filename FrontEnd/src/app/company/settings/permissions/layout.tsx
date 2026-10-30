import type { Metadata } from "next";
import { getServerLocale, t } from "@/lib/i18n";
import React from "react";
import { RequireCompanyAccess } from "@/components/RequireCompanyAccess";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  return { title: t(locale, "meta.permissions", "Permissions") };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <RequireCompanyAccess page="permissions">{children}</RequireCompanyAccess>;
}
