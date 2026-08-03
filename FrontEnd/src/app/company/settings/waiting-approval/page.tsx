"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth, useRequirePending } from "@/lib/auth";
import { Clock, CheckCircle2, AlertCircle, RefreshCw, X, Check, Info } from "lucide-react";
import { apiCall } from "@/lib/apiHelper";
import { withTimeout } from "@/lib/retryApi";
import { getClientLocale, t } from "@/lib/i18n";
import { ROUTES, institutionJoinRequestApi, authMeApi } from "@/lib/routes";


type PendingStatus = "pending" | "approved" | "declined" | "error" | "loading";

interface RequestStatus {
  status: string;
  institutionId: string;
  institutionName: string;
  requestedAt: string;
  updatedAt: string;
}

export default function WaitingApprovalPage() {
  const router = useRouter();
  const { setInstitutionId } = useAuth();
  const { pendingJoinRequest } = useRequirePending();
  const locale = getClientLocale();
  const tr = (key: string, fallback: string, params?: Record<string, string | number>) =>
    t(locale, key, fallback, params);

  const [status, setStatus] = useState<PendingStatus>("loading");
  const [data, setData] = useState<RequestStatus | null>(null);
  const [error, setError] = useState("");
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [canceling, setCanceling] = useState(false);

  const handleCancelRequest = async () => {
    if (!pendingJoinRequest?.institutionId) {
      setError(tr("waiting.error.noInstitution", "No institution found to cancel"));
      return;
    }

    setCanceling(true);
    setError("");

    try {
      await apiCall(
        institutionJoinRequestApi(pendingJoinRequest.institutionId),
        { method: "DELETE" },
        { requireAuth: true }
      );

      router.push(ROUTES.company.settings.onboarding);
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("waiting.error.cancelFailed", "Failed to cancel request"));
      setCanceling(false);
    }
  };

  const checkStatus = async (showLoading = true) => {
    try {
      if (showLoading) {
        setStatus("loading");
      }
      const userResponse = await withTimeout(
        apiCall(
          authMeApi,
          { method: "GET" },
          { requireAuth: true }
        ),
        10000,
        "Status check timed out. Please retry."
      );

      if (userResponse.institutionId) {
        setStatus("approved");
        setInstitutionId(userResponse.institutionId);

        setData({
          status: "ACTIVE",
          institutionId: userResponse.institutionId,
          institutionName: userResponse.institutionName || "",
          requestedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        setAutoRefreshEnabled(false);
      } else {
        setStatus("pending");
      }
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to check status");
    }
  };

  useEffect(() => {
    checkStatus(true);
  }, []);

  useEffect(() => {
    if (!autoRefreshEnabled || status !== "pending") return;
    const interval = setInterval(() => checkStatus(false), 10000);
    return () => clearInterval(interval);
  }, [autoRefreshEnabled, status]);

  // Auto-redirect if approved
  useEffect(() => {
    if (status === "approved") {
      const timer = setTimeout(() => {
        router.push(ROUTES.company.calendar);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[var(--bg-deep)] flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-12 shadow-lg text-center">
            <div className="flex justify-center mb-8">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 bg-gradient-to-r from-[var(--accent)] to-[var(--accent)/80] rounded-full animate-spin" style={{animationDuration: '3s'}} />
                <div className="absolute inset-2 bg-[var(--bg-surface)] border border-[var(--border)] rounded-full flex items-center justify-center">
                  <Clock className="w-8 h-8 text-white/800" />
                </div>
              </div>
            </div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
              {tr("waiting.loading.title", "Loading")}
            </h2>
            <p className="text-[var(--text-muted)] text-sm">
              {tr("waiting.loading.subtitle", "Checking your request status...")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status === "approved") {
    return (
      <div className="min-h-screen bg-[var(--bg-deep)] flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-4 sm:p-6 md:p-8 shadow-2xl text-center">
            <div className="flex justify-center mb-6">
              <CheckCircle2 className="w-16 h-16 text-emerald-400" />
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-2">
              {tr("waiting.approved.title", "Approved!")}
            </h1>
            <p className="text-[var(--text-secondary)] mb-8">
              {tr("waiting.approved.subtitle", "Your request has been approved. Welcome to {{institutionName}}!", {
                institutionName: data?.institutionName || "",
              })}
            </p>

            <div className="text-sm text-[var(--text-muted)] mb-8">
              {tr("waiting.approved.redirecting", "Redirecting in 3 seconds...")}
            </div>

            <button
              onClick={() => router.push(ROUTES.company.calendar)}
              className="w-full px-6 py-3 bg-emerald-500 text-white font-semibold rounded-lg hover:bg-emerald-400 transition-colors"
            >
              {tr("waiting.approved.cta", "Continue to setup")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen bg-[var(--bg-deep)] flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-4 sm:p-6 md:p-8 shadow-2xl">
            <div className="flex justify-center mb-6">
              <AlertCircle className="w-16 h-16 text-red-400" />
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-2">
              {tr("waiting.error.title", "Error Checking Status")}
            </h1>
            <p className="text-[var(--text-secondary)] mb-4">{error}</p>

            <button
              onClick={() => checkStatus(true)}
              className="w-full px-6 py-3 bg-[var(--accent)] text-white font-semibold rounded-lg hover:bg-[var(--accent)]-soft transition-colors mb-3 flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-5 h-5" />
              {tr("waiting.error.tryAgain", "Try Again")}
            </button>

            <Link
              href={ROUTES.company.settings.onboarding}
              className="block w-full px-6 py-3 bg-[var(--bg-surface)] text-[var(--text-primary)] font-semibold rounded-lg hover:bg-[var(--bg-surface)] transition-colors text-center"
            >
              {tr("waiting.error.goOnboarding", "Go to Onboarding")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Pending state
  return (
    <div className="min-h-screen bg-[var(--bg-deep)] flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] shadow-xl overflow-hidden">
          {/* Header with gradient */}
          <div className="bg-gradient-to-r from-[var(--accent)] to-[var(--accent)/80] px-8 py-12 text-center">
            <div className="flex justify-center mb-6">
              <div className="relative w-24 h-24">
                <div className="absolute inset-0 bg-white/20 rounded-full animate-pulse" />
                <div className="absolute inset-3 flex items-center justify-center">
                  <Clock className="w-12 h-12 text-white animate-spin" style={{animationDuration: '2s'}} />
                </div>
              </div>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
              {tr("waiting.pending.title", "Request pending")}
            </h1>
            <p className="text-white/80 text-lg">
              {pendingJoinRequest?.institutionName && tr(
                "waiting.pending.subtitle",
                "Your request to join {{institutionName}} is being processed",
                { institutionName: pendingJoinRequest.institutionName }
              )}
            </p>
          </div>

          {/* Main content */}
          <div className="px-8 py-12">
            {/* Status info box */}
            <div className="bg-gradient-to-br from-[var(--accent)]/10 to-[var(--accent)]/5 border border-[var(--accent)]/20 rounded-xl p-4 sm:p-6 md:p-8 mb-8">
              <div className="space-y-6">
                <div className="space-y-3">
                  <p className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-white/800" /> {tr("waiting.pending.currentStatus", "Current status")}
                  </p>
                  <p className="text-[var(--text-secondary)]">
                    {tr("waiting.pending.statusDetail", "Your membership request has been received and is awaiting approval from the institution manager.")}
                  </p>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                    {tr("waiting.pending.nextSteps", "Next steps")}
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--accent)] text-white flex items-center justify-center text-sm font-bold">
                        <Check className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-[var(--text-primary)]">{tr("waiting.pending.step1.title", "Request submitted")}</p>
                        <p className="text-sm text-[var(--text-secondary)]">{tr("waiting.pending.step1.desc", "We have received your request")}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--accent)]/50 text-white flex items-center justify-center text-sm font-bold">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-[var(--text-primary)]">{tr("waiting.pending.step2.title", "Awaiting approval")}</p>
                        <p className="text-sm text-[var(--text-secondary)]">{tr("waiting.pending.step2.desc", "The manager will review your request")}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-t-muted text-white flex items-center justify-center text-sm font-bold">
                        <Check className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-[var(--text-primary)]">{tr("waiting.pending.step3.title", "Access granted")}</p>
                        <p className="text-sm text-[var(--text-secondary)]">{tr("waiting.pending.step3.desc", "You will be redirected automatically")}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-4">
              <button
                onClick={() => checkStatus(true)}
                className="w-full px-6 py-4 bg-gradient-to-r from-[var(--accent)] to-[var(--accent)/80] text-white font-semibold rounded-lg hover:from-[var(--accent)]-soft hover:to-[var(--accent)] transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-5 h-5" />
                {tr("waiting.pending.checkNow", "Check status now")}
              </button>

              {error && (
                <div className="bg-red-400/10 border border-red-400/20 rounded-lg p-4 flex gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <button
                onClick={handleCancelRequest}
                disabled={canceling}
                className="w-full px-6 py-3 border-2 border-red-500 text-red-400 font-semibold rounded-lg hover:bg-red-400/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <X className="w-5 h-5" />
                {canceling
                  ? tr("waiting.pending.canceling", "Canceling...")
                  : tr("waiting.pending.cancel", "Cancel request")}
              </button>

              <p className="flex justify-center items-center gap-2 text-[var(--text-muted)] text-xs pt-4">
                <Info className="w-4 h-4" /> {tr("waiting.pending.autoRefresh", "Page updates automatically every 10 seconds")}
              </p>
            </div>
          </div>
        </div>

        {/* Help text */}
        <div className="mt-8 p-4 sm:p-6 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow text-center">
          <p className="text-[var(--text-secondary)]">
            {tr("waiting.help", "Questions? Contact your institution manager or the support team.")}
          </p>
        </div>
      </div>
    </div>
  );
}
