"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { refreshHrSessionIfPossible } from "@/lib/apiHelper";
import { createAuthRedirect } from "@/lib/routes";
import { getClientLocale, t } from "@/lib/i18n";
import { ErrorState } from "@/components/ui/ErrorState";

/**
 * Rendered by server pages whose access token is missing/expired while a refresh
 * token still exists. Server Components cannot rotate cookies, so the refresh runs
 * here, then the page is re-rendered with the new access token. Only a refused
 * refresh sends the user to the login page.
 */
export function SessionRecovery({ returnTo }: { returnTo: string }) {
  const router = useRouter();
  const locale = getClientLocale();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;

    void (async () => {
      const token = await refreshHrSessionIfPossible();
      if (cancelled) return;
      if (!token) {
        router.replace(createAuthRedirect(returnTo));
        return;
      }
      router.refresh();
      // If the page still can't load after a refresh (backend down, rate limited),
      // this component stays mounted: show an error instead of spinning forever.
      fallbackTimer = setTimeout(() => {
        if (!cancelled) setFailed(true);
      }, 5000);
    })();

    return () => {
      cancelled = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, [router, returnTo]);

  if (failed) {
    return (
      <ErrorState
        className="min-h-screen"
        title={t(locale, "session.recovery.failedTitle", "Impossible de charger la page")}
        description={t(locale, "session.recovery.failedDesc", "Votre session est active mais le serveur ne répond pas. Réessayez dans un instant.")}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
    </div>
  );
}
