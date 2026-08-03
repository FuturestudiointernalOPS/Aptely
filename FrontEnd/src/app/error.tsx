"use client";

import { useEffect } from "react";
import { getClientLocale, t } from "@/lib/i18n";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = getClientLocale();
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-deep)] px-6">
      <div className="max-w-md w-full text-center space-y-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">{t(locale, "error.code", "Error 500")}</p>
        <h1 className="text-3xl font-bold text-[var(--text-primary)]">{t(locale, "common.errorOccurred", "An error occurred")}</h1>
        <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
          {error.message || t(locale, "error.generic", "Something went wrong. Please try again.")}
        </p>
        {error.digest && (
          <p className="text-[var(--text-muted)] text-xs font-mono bg-[var(--bg-raised)] border border-[var(--border)] rounded-lg px-3 py-2">
            ID: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="inline-flex items-center px-5 py-2.5 rounded-xl bg-[var(--accent)] hover:opacity-90 transition-opacity text-white font-semibold text-sm"
        >
          {t(locale, "common.retry", "Retry")}
        </button>
      </div>
    </div>
  );
}
