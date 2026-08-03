"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { ArrowLeft, Loader2, AlertCircle, Clock, Link2 } from "lucide-react";
import { apiSend } from "@/lib/apiHelper";
import { getClientLocale, t } from "@/lib/i18n";
import { ROUTES, institutionJoinRequestApi } from "@/lib/routes";

type JoinStep = "form" | "loading" | "pending";

export default function JoinInstitutionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setInstitutionId } = useAuth();
  const locale = getClientLocale();
  const tr = (key: string, fallback: string) => t(locale, key, fallback);

  const [step, setStep] = useState<JoinStep>("form");
  const [code, setCode] = useState(searchParams.get("code") ?? "");
  const [error, setError] = useState("");
  const [pendingData, setPendingData] = useState<{
    institutionId: string;
    institutionName: string;
  } | null>(null);

  useEffect(() => {
    if (step === "pending") {
      const timer = setTimeout(() => {
        router.push(ROUTES.company.settings.waitingApproval);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [step, router]);

  const handleJoin = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      setError(
        tr("institution.join.error.emptyCode", "Entrez un code d'invitation."),
      );
      return;
    }

    setError("");
    setStep("loading");

    try {
      const response = (await apiSend(
        institutionJoinRequestApi(trimmed),
        { method: "POST", body: JSON.stringify({}) },
      )) as { institutionId: string; institutionName: string };

      if (response.institutionId) {
        setInstitutionId(response.institutionId);
      }

      setPendingData({
        institutionId: response.institutionId,
        institutionName: response.institutionName,
      });
      setStep("pending");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("Authentication required") || msg.includes("no token")) {
        router.push(ROUTES.login);
        return;
      }
      setError(
        msg ||
          tr(
            "institution.join.error.sendRequest",
            "Impossible d'envoyer la demande d'accès",
          ),
      );
      setStep("form");
    }
  };

  if (step === "pending" && pendingData) {
    return (
      <div className="min-h-screen bg-[var(--bg-deep)] flex items-center justify-center p-4">
        <div className="max-w-2xl w-full animate-fade-in-up">
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-4 sm:p-6 md:p-8 shadow-2xl">
            <div className="text-center mb-8">
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 bg-amber-400/10 rounded-full flex items-center justify-center animate-pulse">
                  <Clock className="w-8 h-8 text-amber-400" />
                </div>
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-display font-bold text-[var(--text-primary)] mb-2">
                {tr("institution.join.requestSentTitle", "Demande envoyée !")}
              </h1>
              <p className="text-[var(--text-secondary)]">
                {tr(
                  "institution.join.requestSentSubtitle",
                  "Votre demande d'accès est en attente d'approbation du propriétaire de l'institution.",
                )}
              </p>
            </div>

            <div className="bg-amber-400/10 border border-amber-400/20 rounded-lg p-4 sm:p-6 mb-8">
              <p className="text-sm text-amber-400 mb-2">
                <strong>
                  {tr("institution.join.institutionLabel", "Institution")}:
                </strong>
              </p>
              <p className="text-xl font-bold text-amber-400 mb-6">
                {pendingData.institutionName}
              </p>
              <div className="space-y-3 text-sm text-amber-400">
                <p className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  {tr(
                    "institution.join.pendingPoint1",
                    "Votre demande a été envoyée au propriétaire de l'institution",
                  )}
                </p>
                <p className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  {tr(
                    "institution.join.pendingPoint2",
                    "Vous recevrez une notification e-mail une fois approuvée",
                  )}
                </p>
                <p className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  {tr(
                    "institution.join.pendingPoint3",
                    "Revenez ici pour suivre les mises à jour de statut",
                  )}
                </p>
              </div>
            </div>

            <div className="bg-blue-400/10 border border-blue-400/20 rounded-lg p-4 mb-8">
              <p className="text-sm text-blue-400 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-blue-400 shrink-0" />
                <span>
                  <strong>
                    {tr("institution.join.whatsNext", "Et ensuite ?")}
                  </strong>{" "}
                  {tr(
                    "institution.join.whatsNextDescription",
                    "Le propriétaire de l'institution examinera votre demande et l'approuvera ou la refusera. Vous serez notifié par e-mail.",
                  )}
                </span>
              </p>
            </div>

            <div className="text-center text-[var(--text-muted)] text-sm mb-6">
              {tr(
                "institution.join.redirecting",
                "Redirection vers la page de statut dans 3 secondes...",
              )}
            </div>

            <button
              onClick={() =>
                router.push(ROUTES.company.settings.waitingApproval)
              }
              className="w-full px-6 py-3 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-400 transition-colors"
            >
              {tr(
                "institution.join.goStatusNow",
                "Aller au statut de la demande maintenant",
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <Link
          href={ROUTES.company.settings.onboarding}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm mb-4 inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          {tr("common.back", "Retour")}
        </Link>

        <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-6 md:p-8 shadow-2xl rounded-2xl">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--accent-dim)] mb-6 mx-auto">
            <Link2 className="w-7 h-7 text-[var(--accent)]" />
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] mb-2 text-center">
            {tr("institution.join.title", "Rejoindre une institution")}
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mb-8 text-center">
            {tr(
              "institution.join.subtitle",
              "Entrez le code d'invitation partagé par l'administrateur de l'institution.",
            )}
          </p>

          {error && (
            <div className="bg-red-400/10 border border-red-400/20 rounded-lg p-4 mb-6 flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-1.5">
                {tr("institution.join.codeLabel", "Code d'invitation")}
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                placeholder={tr(
                  "institution.join.codePlaceholder",
                  "Collez votre code d'invitation",
                )}
                className="w-full px-4 py-3 bg-[var(--bg-deep)] border-2 border-[var(--border)] rounded-xl focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 transition text-[var(--text-primary)] font-mono text-sm"
              />
              <p className="mt-1.5 text-xs text-[var(--text-muted)]">
                {tr(
                  "institution.join.codeHint",
                  "Ce code est fourni par l'administrateur via Paramètres → Workspace → Lien d'invitation.",
                )}
              </p>
            </div>

            <button
              onClick={handleJoin}
              disabled={step === "loading" || !code.trim()}
              className="w-full px-6 py-3 bg-[var(--accent)] text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
            >
              {step === "loading" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {tr("institution.join.sending", "Envoi en cours...")}
                </>
              ) : (
                tr("institution.join.join", "Envoyer la demande")
              )}
            </button>
          </div>

          <p className="text-center text-[var(--text-muted)] text-xs mt-6">
            {tr(
              "institution.join.noJoinQuestion",
              "Vous ne souhaitez pas rejoindre ?",
            )}{" "}
            <Link
              href={ROUTES.company.settings.onboarding}
              className="text-[var(--accent)] font-semibold hover:underline"
            >
              {tr(
                "institution.join.createInstead",
                "Créez plutôt votre propre institution",
              )}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
