"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Share2,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Globe,
  Shield,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { apiFetch } from "@/lib/apiHelper";
import { getClientLocale, t } from "@/lib/i18n";
import {
  ROUTES,
  createAuthRedirect,
  individualsMyExportApi,
} from "@/lib/routes";

interface ExportData {
  token: string;
  share_url: string;
  expires_at: string;
}

export default function ExportPage() {
  const locale = getClientLocale();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { isPersonal } = useWorkspace();
  const [exportData, setExportData] = useState<ExportData | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    const res = await apiFetch(individualsMyExportApi, "none", {
      method: "POST",
    });
    setGenerating(false);
    if (res?.share_url) {
      setExportData(res as ExportData);
    } else {
      setError(
        t(
          locale,
          "individual.export.generateFailed",
          "Failed to generate share link. Please try again.",
        ),
      );
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(createAuthRedirect(ROUTES.candidate.export));
      return;
    }
    if (!isPersonal) {
      router.replace(ROUTES.company.dashboard);
      return;
    }
    generate();
  }, [loading, user, router, generate, isPersonal]);

  const handleCopy = async () => {
    if (!exportData?.share_url) return;
    try {
      await navigator.clipboard.writeText(exportData.share_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy link:", exportData.share_url);
    }
  };

  if (loading || (!exportData && !error && generating)) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 sm:p-6 text-sm text-[var(--text-muted)]">
          {t(
            locale,
            "individual.export.loading",
            "Generating your share link...",
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            {t(locale, "individual.export.sectionLabel", "Profile portability")}
          </p>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] mt-1">
            {t(locale, "individual.export.title", "Share my profile")}
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {t(
              locale,
              "individual.export.subtitle",
              "Generate a public link to your Capability Record — no login required for viewers.",
            )}
          </p>
        </div>

        {/* Link card */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-4 h-4 text-[var(--accent)]" />
            <span className="text-sm font-bold text-[var(--text-primary)]">
              {t(locale, "individual.export.publicLink", "Public link")}
            </span>
          </div>

          {error ? (
            <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          ) : exportData ? (
            <>
              <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-raised)] px-4 py-3">
                <span className="flex-1 truncate text-sm text-[var(--text-secondary)] font-mono">
                  {exportData.share_url}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />{" "}
                      {t(locale, "individual.export.copied", "Copied")}
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />{" "}
                      {t(locale, "individual.export.copy", "Copy")}
                    </>
                  )}
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
                  <span className="inline-flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5" />
                    {t(locale, "individual.export.readOnly", "Read-only")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={exportData.share_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />{" "}
                    {t(locale, "individual.export.preview", "Preview")}
                  </a>
                  <button
                    type="button"
                    onClick={generate}
                    disabled={generating}
                    className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${generating ? "animate-spin" : ""}`}
                    />
                    {t(locale, "individual.export.refreshLink", "Refresh link")}
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* What's included */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 sm:p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-[var(--accent)]" />
            <span className="text-sm font-bold text-[var(--text-primary)]">
              {t(locale, "individual.export.whatsIncluded", "What's included")}
            </span>
          </div>
          <ul className="space-y-2">
            {[
              t(
                locale,
                "individual.export.included.headline",
                "Professional headline, bio, location & availability",
              ),
              t(locale, "individual.export.included.skills", "Skills list"),
              t(
                locale,
                "individual.export.included.experience",
                "Work experience & education",
              ),
              t(
                locale,
                "individual.export.included.certifications",
                "Certifications & languages",
              ),
              t(
                locale,
                "individual.export.included.proofs",
                "Verified skill proofs (portfolio links, files)",
              ),
              t(
                locale,
                "individual.export.included.evidence",
                "Work evidence with impact scores",
              ),
              t(
                locale,
                "individual.export.included.endorsements",
                "Submitted endorsements with ratings",
              ),
            ].map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 text-xs text-[var(--text-secondary)]"
              >
                <span className="mt-0.5 text-[var(--accent)] font-bold">•</span>
                {item}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-[var(--text-muted)] pt-1 border-t border-[var(--border)]">
            {t(
              locale,
              "individual.export.privacyNote",
              "Contact info, tokens and internal IDs are never exposed.",
            )}
          </p>
        </div>

        {/* Usage tips */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5 space-y-2">
          <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">
            {t(locale, "individual.export.tips", "Tips")}
          </p>
          <div className="space-y-1.5 text-xs text-[var(--text-muted)]">
            <p>
              {t(
                locale,
                "individual.export.tip1",
                "Share the link with recruiters, clients, or collaborators — no Aptely account needed.",
              )}
            </p>
            <p>
              {t(
                locale,
                "individual.export.tip2",
                "Refreshing generates a new token and invalidates the previous link.",
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
