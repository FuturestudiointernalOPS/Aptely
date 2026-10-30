import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { WorkspaceProvider } from "@/lib/workspace";
import { ThemeProvider } from "@/lib/theme";
import AppShell from "@/components/AppShell";
import { SupabaseAuthHandler } from "@/components/SupabaseAuthHandler";
import { ToastProvider } from "@/components/ui/Toast";
import { LocaleSync } from "@/components/LocaleSync";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import { getServerLocale } from "@/lib/i18n";

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://aptely.com");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    template: "%s | Aptely",
    default: "Aptely",
  },
  description: "Aptely : intelligence RH augmentée pour des décisions de recrutement plus rapides et plus justes.",
  openGraph: {
    title: "Aptely",
    description: "Aptely : intelligence RH augmentée pour des décisions de recrutement plus rapides et plus justes.",
    url: siteUrl,
    siteName: "Aptely",
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Aptely",
    description: "Aptely : intelligence RH augmentée pour des décisions de recrutement plus rapides et plus justes.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const htmlLang = await getServerLocale();

  return (
    <html lang={htmlLang} suppressHydrationWarning data-scroll-behavior="smooth">
      <body className="bg-[var(--bg-deep)] text-[var(--text-primary)] antialiased transition-colors duration-300" suppressHydrationWarning>
        <LocaleSync />
        <SupabaseAuthHandler />
        <ThemeProvider>
          <AuthProvider>
            <WorkspaceProvider>
              <ToastProvider>
                <AppShell>
                  {children}
                </AppShell>
                <CookieConsentBanner />
              </ToastProvider>
            </WorkspaceProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
