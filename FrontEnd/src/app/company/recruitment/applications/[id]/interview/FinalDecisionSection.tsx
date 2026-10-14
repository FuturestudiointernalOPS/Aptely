"use client";

import { useState, useEffect, useCallback } from "react";
import { Send, Edit3, Sparkles, CheckCircle2, AlertTriangle, Loader } from "lucide-react";
import { apiFetch } from "@/lib/apiHelper";
import { finalizeSelection, sendSelectionEmails } from "@/lib/api";
import { getClientLocale, t } from "@/lib/i18n";
import { appEmailPreviewApi, appStatusApi, appSendEmailsApi } from "@/lib/routes";

interface FinalDecisionSectionProps {
  applicationId: string;
}

type DecisionAction = "ACCEPT" | "REJECT";

export default function FinalDecisionSection({ applicationId }: FinalDecisionSectionProps) {
  const locale = getClientLocale();
  const tr = (key: string, fallback: string) => t(locale, key, fallback);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [lastSentAction, setLastSentAction] = useState<DecisionAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<DecisionAction>("ACCEPT");
  const [editing, setEditing] = useState(false);
  const [templates, setTemplates] = useState({
    approval: tr(
      "interview.finalDecision.defaultApproved",
      "Bonjour {{name}},\n\nSuite à l'entretien, nous avons le plaisir de vous informer que votre profil a été retenu. Nous vous communiquerons les prochaines étapes très prochainement.\n\nCordialement,\nL'équipe RH"
    ),
    rejection: tr(
      "interview.finalDecision.defaultRejected",
      "Bonjour {{name}},\n\nMerci pour votre temps et votre intérêt pour le poste. Après examen attentif de votre entretien, nous avons décidé de poursuivre avec un autre candidat dont le profil correspond davantage à nos attentes actuelles.\n\nNous vous souhaitons beaucoup de succès dans vos recherches.\n\nCordialement,\nL'équipe RH"
    ),
  });

  const loadExistingTemplates = useCallback(async () => {
    if (!applicationId) return;
    setLoading(true);
    try {
      const res = await apiFetch(appEmailPreviewApi(applicationId), "HR");
      if (res && typeof res === "object") {
        const existing = res as { approvalTemplate?: string; rejectionTemplate?: string };
        if (existing.approvalTemplate || existing.rejectionTemplate) {
          setTemplates({
            approval: existing.approvalTemplate || templates.approval,
            rejection: existing.rejectionTemplate || templates.rejection,
          });
        }
      }
    } catch {
      // No existing templates — use defaults
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    loadExistingTemplates();
  }, [loadExistingTemplates]);

  const currentTemplate = selectedAction === "ACCEPT" ? templates.approval : templates.rejection;

  const handleSend = async () => {
    setSending(true);
    setError(null);
    try {
      const newStatus = selectedAction === "ACCEPT" ? "VALIDATED" : "REJECTED";
      const statusRes = await apiFetch(appStatusApi(applicationId), "HR", {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      if (!statusRes) throw new Error(tr("interview.finalDecision.sendError", "Failed to update application status."));

      const finalized = await finalizeSelection(applicationId, {
        approvalMessage: templates.approval,
        rejectionMessage: templates.rejection,
      });
      if (!finalized) throw new Error(tr("interview.finalDecision.sendError", "Failed to save email templates."));

      const emailResult = await apiFetch(appSendEmailsApi(applicationId), "HR", { method: "POST" });
      if (!emailResult) throw new Error(tr("interview.finalDecision.sendError", "Failed to send the email."));
      if (emailResult.failed > 0 || (emailResult.sent === 0 && emailResult.queued === 0)) {
        throw new Error(emailResult.errors?.[0] || tr("interview.finalDecision.sendError", "The email could not be delivered."));
      }
      setSent(true);
      setLastSentAction(selectedAction);
    } catch (err) {
      const msg = err instanceof Error ? err.message : tr("interview.finalDecision.sendError", "Failed to send decision emails.");
      setError(msg);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6">
        <div className="flex items-center justify-center py-8">
          <Loader className="w-5 h-5 text-[var(--text-muted)] animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center">
            <Send className="w-5 h-5 text-[var(--accent)]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              {tr("interview.finalDecision.title", "Décision finale")}
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              {tr("interview.finalDecision.subtitle", "Sélectionnez le type de message à envoyer au candidat")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-bold text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-1 rounded-lg">
          <Sparkles className="w-3 h-3 fill-current" />
          {tr("interview.finalDecision.aiAssisted", "ASSISTÉ PAR IA")}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-400/10 border border-red-400/20 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Success banner */}
      {sent && (
        <div className="bg-emerald-400/10 border border-emerald-400/20 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-emerald-400">
              {tr("interview.finalDecision.sentSuccess", "Email envoyé avec succès !")}
            </p>
            <p className="text-xs text-emerald-400/70 mt-0.5">
              {lastSentAction === "ACCEPT"
                ? tr("interview.finalDecision.acceptanceSent", "Message d'acceptation envoyé.")
                : tr("interview.finalDecision.rejectionSent", "Message de refus envoyé.")}
              {selectedAction !== lastSentAction && (
                <span className="text-amber-400 ml-1">
                  {tr("interview.finalDecision.decisionChanged", "La décision a changé — vous pouvez renvoyer.")}
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Action selector */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => { setSelectedAction("ACCEPT"); setEditing(false); }}
          className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold transition-all ${
            selectedAction === "ACCEPT"
              ? "bg-emerald-500 text-white shadow-[0_4px_16px_rgba(52,211,153,0.3)]"
              : "bg-[var(--bg-raised)] text-[var(--text-muted)] hover:text-emerald-400 border border-[var(--border)]"
          }`}
        >
          {tr("interview.finalDecision.accept", "Accepter")}
        </button>
        <button
          type="button"
          onClick={() => { setSelectedAction("REJECT"); setEditing(false); }}
          className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold transition-all ${
            selectedAction === "REJECT"
              ? "bg-rose-500 text-white shadow-[0_4px_16px_rgba(244,63,94,0.3)]"
              : "bg-[var(--bg-raised)] text-[var(--text-muted)] hover:text-rose-400 border border-[var(--border)]"
          }`}
        >
          {tr("interview.finalDecision.reject", "Refuser")}
        </button>
      </div>

      {/* Selected template */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${selectedAction === "ACCEPT" ? "bg-emerald-400" : "bg-rose-400"}`} />
            <label className="text-sm font-bold text-[var(--text-primary)]">
              {selectedAction === "ACCEPT"
                ? tr("interview.finalDecision.successMsg", "Message d'acceptation")
                : tr("interview.finalDecision.rejectionMsg", "Message de refus")}
            </label>
          </div>
          <button
            type="button"
            onClick={() => setEditing(!editing)}
            className={`text-xs font-semibold transition-colors ${
              editing ? "text-[var(--accent)]" : "text-[var(--text-muted)] hover:text-[var(--accent)]"
            }`}
          >
            <Edit3 className="w-3.5 h-3.5 inline mr-1" />
            {editing ? tr("interview.finalDecision.done", "Terminé") : tr("interview.finalDecision.edit", "Modifier")}
          </button>
        </div>
        {editing ? (
          <textarea
            rows={8}
            className="w-full p-4 bg-[var(--bg-deep)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 transition-all resize-none"
            value={currentTemplate}
            onChange={(e) => setTemplates(selectedAction === "ACCEPT"
              ? { ...templates, approval: e.target.value }
              : { ...templates, rejection: e.target.value }
            )}
          />
        ) : (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-deep)] p-4 text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-line min-h-[80px]">
            {currentTemplate}
          </div>
        )}
      </div>

      {/* Hint */}
      <div className="p-4 bg-blue-400/10 border border-blue-400/20 rounded-xl flex items-start gap-3">
        <div className="w-5 h-5 rounded-full bg-blue-400/20 text-blue-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">i</div>
        <p className="text-[11px] text-blue-400 leading-relaxed font-medium">
          {tr("interview.finalDecision.hint", "Les tags {{name}} et {{role}} seront automatiquement remplacés avant l'envoi.")}
        </p>
      </div>

      {/* Send Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSend}
          disabled={sending}
          className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            selectedAction === "ACCEPT"
              ? "bg-emerald-500 hover:bg-emerald-600 shadow-[0_4px_16px_rgba(52,211,153,0.3)]"
              : "bg-rose-500 hover:bg-rose-600 shadow-[0_4px_16px_rgba(244,63,94,0.3)]"
          }`}
        >
          {sending ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              {tr("interview.finalDecision.sending", "Envoi en cours...")}
            </>
          ) : sent && selectedAction === lastSentAction ? (
            <>
              <Send className="w-4 h-4" />
              {tr("interview.finalDecision.resend", "Renvoyer")}
            </>
          ) : sent ? (
            <>
              <Send className="w-4 h-4" />
              {tr("interview.finalDecision.sendNewDecision", "Envoyer la nouvelle décision")}
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              {selectedAction === "ACCEPT"
                ? tr("interview.finalDecision.sendAccept", "Envoyer l'acceptation")
                : tr("interview.finalDecision.sendReject", "Envoyer le refus")}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
