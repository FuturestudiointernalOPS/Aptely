"use client";

import { AlertCircle } from "lucide-react";
import { getClientLocale, t } from "@/lib/i18n";

export function ErrorState({
    title,
    description,
    onRetry,
    retryLabel,
    className = "",
}: {
    title?: string;
    description?: string;
    onRetry?: () => void;
    retryLabel?: string;
    className?: string;
}) {
    const locale = getClientLocale();
    const resolvedTitle = title ?? t(locale, "common.errorOccurred", "An error occurred");
    const resolvedRetry = retryLabel ?? t(locale, "common.retry", "Retry");
    return (
        <div className={`flex flex-col items-center justify-center text-center py-14 px-6 ${className}`}>
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-400/20 flex items-center justify-center text-red-400 mb-4">
                <AlertCircle className="w-6 h-6" />
            </div>
            <p className="text-card-title text-[var(--text-primary)]">{resolvedTitle}</p>
            {description && (
                <p className="text-sm text-[var(--text-muted)] mt-1 max-w-sm">{description}</p>
            )}
            {onRetry && (
                <button
                    type="button"
                    onClick={onRetry}
                    className="mt-5 px-5 py-2.5 rounded-xl bg-[var(--bg-raised)] border border-[var(--border)] text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--accent)]/40 transition-colors"
                >
                    {resolvedRetry}
                </button>
            )}
        </div>
    );
}
