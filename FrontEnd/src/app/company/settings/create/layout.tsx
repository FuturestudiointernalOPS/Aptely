import type { Metadata } from "next";
import { getServerLocale, t } from "@/lib/i18n";
import React from "react";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  return { title: t(locale, "meta.createInstitution", "Create institution") };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
