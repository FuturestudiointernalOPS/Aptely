"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, RefreshCw, Webhook, Copy, Check, Eye, EyeOff, ToggleLeft, ToggleRight } from "lucide-react";
import { apiFetch } from "@/lib/apiHelper";
import { useRequireInstitution } from "@/lib/auth";
import { getClientLocale, t } from "@/lib/i18n";
import { API, webhookApi, webhookRotateSecretApi } from "@/lib/routes";

const WEBHOOK_EVENTS = [
  "OFFER_ACCEPTED", "OFFER_REJECTED", "OFFER_SIGNED",
  "INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED",
  "DECISION_ACCEPTED", "DECISION_REJECTED",
  "EMPLOYEE_HIRED", "ONBOARDING_TASK_COMPLETED",
] as const;

type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

interface WebhookItem {
  id: string;
  url: string;
  events: WebhookEvent[];
  description: string | null;
  is_active: boolean;
  created_at: string;
}

function SecretDisplay({ secret }: { secret: string }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="mt-3 p-3 rounded-lg border border-amber-400/30 bg-amber-400/5 space-y-2">
      <p className="text-xs font-semibold text-amber-400">
        {t(getClientLocale(), "webhooks.secretWarning", "Secret affiché une seule fois — copiez-le maintenant")}
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs font-mono text-[var(--text-primary)] break-all">
          {visible ? secret : "•".repeat(40)}
        </code>
        <button type="button" onClick={() => setVisible((v) => !v)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          {visible ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
        <button type="button" onClick={handle} className="text-[var(--text-muted)] hover:text-[var(--accent)]">
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
}

export default function WebhooksPage() {
  useRequireInstitution();
  const locale = getClientLocale();
  const tr = (key: string, fb: string) => t(locale, key, fb);

  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<Set<WebhookEvent>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [newSecret, setNewSecret] = useState<{ id: string; secret: string } | null>(null);
  const [rotatedSecret, setRotatedSecret] = useState<{ id: string; secret: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch(API.webhooks, "HR");
    setWebhooks(res?.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleCreate = async () => {
    if (!newUrl.trim() || selectedEvents.size === 0) return;
    setSubmitting(true);
    const res = await apiFetch(API.webhooks, "HR", {
      method: "POST",
      body: JSON.stringify({ url: newUrl.trim(), events: Array.from(selectedEvents), description: newDesc.trim() || undefined }),
    });
    setSubmitting(false);
    if (res?.data) {
      setNewSecret({ id: res.data.id as string, secret: res.data.secret as string });
      setShowForm(false);
      setNewUrl(""); setNewDesc(""); setSelectedEvents(new Set());
      await load();
    }
  };

  const handleToggle = async (wh: WebhookItem) => {
    await apiFetch(webhookApi(wh.id), "HR", {
      method: "PATCH",
      body: JSON.stringify({ is_active: !wh.is_active }),
    });
    await load();
  };

  const handleDelete = async (id: string) => {
    await apiFetch(webhookApi(id), "HR", { method: "DELETE" });
    setDeleteConfirm(null);
    await load();
  };

  const handleRotate = async (id: string) => {
    const res = await apiFetch(webhookRotateSecretApi(id), "HR", { method: "POST" });
    if (res?.secret) setRotatedSecret({ id, secret: res.secret as string });
  };

  const toggleEvent = (ev: WebhookEvent) => {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      next.has(ev) ? next.delete(ev) : next.add(ev);
      return next;
    });
  };

  return (
    <div className="py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
              {tr("webhooks.section", "Administration")}
            </p>
            <h1 className="text-xl font-bold text-[var(--text-primary)] mt-1">{tr("webhooks.title", "Webhooks")}</h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              {tr("webhooks.subtitle", "Recevez des notifications HTTP quand des événements se produisent sur Aptely.")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            <Plus size={14} />
            {tr("webhooks.add", "Ajouter")}
          </button>
        </div>

        {/* Create form */}
        {showForm && (
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-[var(--text-primary)]">{tr("webhooks.newWebhook", "Nouveau webhook")}</h2>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">URL *</label>
              <input
                type="url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://your-server.com/webhook"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-raised)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                {tr("webhooks.description", "Description")} ({tr("webhooks.optional", "optionnel")})
              </label>
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder={tr("webhooks.descPlaceholder", "ex : Slack #hiring")}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-raised)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                {tr("webhooks.events", "Événements")} *
              </label>
              <div className="flex flex-wrap gap-2">
                {WEBHOOK_EVENTS.map((ev) => (
                  <button
                    key={ev}
                    type="button"
                    onClick={() => toggleEvent(ev)}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-colors ${
                      selectedEvents.has(ev)
                        ? "bg-[var(--accent-dim)] border-[var(--accent)]/30 text-[var(--accent)]"
                        : "bg-[var(--bg-raised)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]/30"
                    }`}
                  >
                    {ev}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                {tr("webhooks.cancel", "Annuler")}
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={submitting || !newUrl.trim() || selectedEvents.size === 0}
                className="px-4 py-2 rounded-xl bg-[var(--accent)] text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? tr("webhooks.creating", "Création…") : tr("webhooks.create", "Créer")}
              </button>
            </div>
          </div>
        )}

        {/* New secret display */}
        {newSecret && (
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5">
            <SecretDisplay secret={newSecret.secret} />
            <button type="button" onClick={() => setNewSecret(null)}
              className="mt-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
              {tr("webhooks.dismissSecret", "J'ai copié le secret ✓")}
            </button>
          </div>
        )}

        {/* Rotated secret */}
        {rotatedSecret && (
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5">
            <SecretDisplay secret={rotatedSecret.secret} />
            <button type="button" onClick={() => setRotatedSecret(null)}
              className="mt-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
              {tr("webhooks.dismissSecret", "J'ai copié le secret ✓")}
            </button>
          </div>
        )}

        {/* Webhook list */}
        <div className="space-y-3">
          {loading ? (
            Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] animate-pulse" />
            ))
          ) : webhooks.length === 0 ? (
            <div className="text-center py-12">
              <Webhook className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-3" />
              <p className="text-sm font-semibold text-[var(--text-secondary)]">{tr("webhooks.empty", "Aucun webhook configuré")}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">{tr("webhooks.emptyHint", "Cliquez Ajouter pour créer votre premier webhook.")}</p>
            </div>
          ) : (
            webhooks.map((wh) => (
              <div key={wh.id} className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${wh.is_active ? "bg-emerald-400" : "bg-[var(--text-muted)]"}`} />
                      <code className="text-xs font-mono text-[var(--text-primary)] truncate">{wh.url}</code>
                    </div>
                    {wh.description && (
                      <p className="text-xs text-[var(--text-muted)] mt-0.5 ml-3.5">{wh.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" onClick={() => handleToggle(wh)}
                      className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
                      title={wh.is_active ? tr("webhooks.disable", "Désactiver") : tr("webhooks.enable", "Activer")}>
                      {wh.is_active ? <ToggleRight size={16} className="text-emerald-400" /> : <ToggleLeft size={16} />}
                    </button>
                    <button type="button" onClick={() => handleRotate(wh.id)}
                      className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-amber-400 transition-colors"
                      title={tr("webhooks.rotateSecret", "Rotation du secret")}>
                      <RefreshCw size={14} />
                    </button>
                    {deleteConfirm === wh.id ? (
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => handleDelete(wh.id)}
                          className="text-[10px] font-bold px-2 py-1 rounded-lg bg-red-400/10 border border-red-400/20 text-red-400 hover:bg-red-400/20">
                          {tr("webhooks.confirmDelete", "Supprimer ?")}
                        </button>
                        <button type="button" onClick={() => setDeleteConfirm(null)}
                          className="text-[10px] text-[var(--text-muted)] px-1">✕</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setDeleteConfirm(wh.id)}
                        className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 ml-3.5">
                  {wh.events.map((ev) => (
                    <span key={ev} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--bg-raised)] border border-[var(--border)] text-[var(--text-muted)]">
                      {ev}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Signature verification doc */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-bold text-[var(--text-primary)]">{tr("webhooks.verifyTitle", "Vérifier la signature")}</h2>
          <p className="text-xs text-[var(--text-muted)]">
            {tr("webhooks.verifyDesc", "Chaque requête contient le header X-Aptely-Signature. Vérifiez avec HMAC-SHA256 :")}
          </p>
          <pre className="text-xs bg-[var(--bg-raised)] border border-[var(--border)] rounded-lg p-3 overflow-x-auto text-[var(--text-secondary)] font-mono leading-relaxed">
{`const sig = req.headers['x-aptely-signature'];
const expected = crypto
  .createHmac('sha256', YOUR_SECRET)
  .update(JSON.stringify(req.body))
  .digest('hex');
if (sig !== expected) return res.status(401).send('Invalid signature');`}
          </pre>
        </div>

      </div>
    </div>
  );
}
