"use client";

import { use, useState } from "react";
import { apiFetch } from "@/lib/apiHelper";
import { offerSignByTokenApi } from "@/lib/routes";
import { CheckCircle2, PenLine, Loader2, AlertTriangle } from "lucide-react";
import { getClientLocale, t } from "@/lib/i18n";
import SignaturePad from "@/components/SignaturePad";

export default function OfferSignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const locale = getClientLocale();
  const [status, setStatus] = useState<"idle" | "signing" | "signed" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signerName, setSignerName] = useState("");

  const handleSign = async () => {
    if (!signatureData) return;
    setStatus("signing");
    setErrorMsg(null);
    try {
      await apiFetch(offerSignByTokenApi(token), "none", {
        method: "POST",
        body: JSON.stringify({ signatureData, signerName: signerName.trim() || undefined }),
      });
      setStatus("signed");
    } catch (e: any) {
      setErrorMsg(e?.message || t(locale, "common.error", "Erreur"));
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-8 space-y-6">

        {status === "signed" ? (
          <div className="text-center space-y-4">
            <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto" />
            <h1 className="text-xl font-bold text-[var(--text-primary)]">{t(locale, "offers.sign.successTitle", "Offre signée !")}</h1>
            <p className="text-[var(--text-muted)] text-sm">{t(locale, "offers.sign.successDesc", "Votre signature a été enregistrée. L'équipe RH a été notifiée.")}</p>
          </div>

        ) : status === "error" ? (
          <div className="text-center space-y-4">
            <AlertTriangle className="w-14 h-14 text-amber-400 mx-auto" />
            <h1 className="text-xl font-bold text-[var(--text-primary)]">{t(locale, "offers.sign.errorTitle", "Erreur")}</h1>
            <p className="text-[var(--text-muted)] text-sm">{errorMsg}</p>
            <button
              onClick={() => setStatus("idle")}
              className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-primary)] hover:bg-[var(--bg-raised)] transition-colors"
            >
              {t(locale, "offers.sign.retry", "Réessayer")}
            </button>
          </div>

        ) : (
          <>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center flex-shrink-0">
                <PenLine className="w-5 h-5 text-[var(--accent)]" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-[var(--text-primary)]">{t(locale, "offers.sign.title", "Signer l'offre")}</h1>
                <p className="text-xs text-[var(--text-muted)]">{t(locale, "offers.sign.subtitle", "Dessinez votre signature pour accepter les termes de cette offre.")}</p>
              </div>
            </div>

            {/* Signer name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                {t(locale, "offers.sign.yourName", "Votre nom complet")}
              </label>
              <input
                type="text"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder={t(locale, "signing.namePlaceholder", "Full name")}
                className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-raised)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]/40"
              />
            </div>

            {/* Signature pad */}
            <SignaturePad
              label={t(locale, "offers.sign.signatureLabel", "Votre signature")}
              onSigned={setSignatureData}
              onClear={() => setSignatureData(null)}
              disabled={status === "signing"}
            />

            <button
              onClick={handleSign}
              disabled={!signatureData || status === "signing"}
              className="w-full py-3 rounded-xl bg-[var(--accent)] text-white font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
            >
              {status === "signing" ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> {t(locale, "offers.sign.signing", "Signature en cours...")}</>
              ) : (
                <><PenLine className="w-4 h-4" /> {t(locale, "offers.sign.signButton", "Confirmer et signer l'offre")}</>
              )}
            </button>

            <p className="text-xs text-[var(--text-muted)] text-center">
              {t(locale, "offers.sign.disclaimer", "Ce lien est à usage unique et personnel. Votre signature a valeur légale.")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
