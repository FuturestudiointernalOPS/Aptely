"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Send, X, Loader, CheckCircle2, Mail } from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/apiHelper";
import { getClientLocale, t } from "@/lib/i18n";
import { useParams } from "next/navigation";
import { ROUTES, appEmailPreviewApi, appSendEmailsApi, appSortingPath } from "@/lib/routes";

interface EmailPreviewData {
    approvedCount: number;
    rejectedCount: number;
    approvalTemplate: string;
    rejectionTemplate: string;
}

export default function EmailPreviewPage() {
    const routeParams = useParams<{ id: string }>();
    const id = Array.isArray(routeParams.id) ? routeParams.id[0] : routeParams.id;
    const locale = getClientLocale();
    const tr = (key: string, fallback: string) => t(locale, key, fallback);
    const [data, setData] = useState<EmailPreviewData | null>(null);
    const [personalNote, setPersonalNote] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [sendError, setSendError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) {
            setLoading(false);
            return;
        }
        apiFetch(appEmailPreviewApi(id), "HR").then((res) => {
            if (res) setData(res);
            setLoading(false);
        });
    }, [id]);

    const handleSend = async () => {
        setSending(true);
        setSendError(null);
        const res = await apiFetch(appSendEmailsApi(id), "HR", {
            method: "POST",
            body: JSON.stringify({ personalNote }),
        });
        setSending(false);
        if (res !== null) {
            setSent(true);
        } else {
            setSendError(tr("application.emailPreview.sendError", "Failed to send emails. Please try again."));
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader className="w-8 h-8 text-[var(--accent)] animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3 animate-fade-in-up">
                <Link href={appSortingPath(id)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                    <div className="flex items-center gap-2 text-[var(--text-muted)] text-xs mb-1">
                        <span>{tr("application.emailPreview.finalizeSelection", "Finalize selection")}</span>
                        <span className="text-[var(--accent)] font-bold">{tr("application.emailPreview.step", "Step 3/3")}</span>
                    </div>
                    <h1 className="text-[var(--text-primary)] font-bold text-xl">{tr("application.emailPreview.title", "Review & dispatch emails")}</h1>
                    <p className="text-[var(--text-muted)] text-sm">
                        {tr("application.emailPreview.subtitle", "Review generated emails for your selection. Once confirmed, Aptely will notify all candidates.")}
                    </p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 animate-fade-in-up delay-100">
                <div className="bg-elevated border border-[var(--border)] rounded-2xl p-4 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <div>
                        <p className="text-[var(--text-muted)] text-xs uppercase tracking-wide">{tr("application.emailPreview.approved", "Approved")}</p>
                        <p className="text-[var(--text-primary)] font-bold text-2xl">{data?.approvedCount ?? 0} {tr("application.emailPreview.talents", "talents")}</p>
                    </div>
                </div>
                <div className="bg-elevated border border-[var(--border)] rounded-2xl p-4 flex items-center gap-3">
                    <span className="text-red-400 text-xl"><X className="w-5 h-5" /></span>
                    <div>
                        <p className="text-[var(--text-muted)] text-xs uppercase tracking-wide">{tr("application.emailPreview.rejected", "Rejected")}</p>
                        <p className="text-[var(--text-primary)] font-bold text-2xl">{data?.rejectedCount ?? 0} {tr("application.emailPreview.talents", "talents")}</p>
                    </div>
                </div>
            </div>

            {/* Approval Email */}
            {data?.approvalTemplate && (
                <div className="bg-elevated border border-[var(--border)] rounded-2xl p-6 animate-fade-in-up delay-200">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Mail className="w-5 h-5 text-[var(--accent)]" />
                            <h3 className="text-[var(--text-primary)] font-bold">{tr("application.emailPreview.approvalPreview", "Approval email preview")}</h3>
                        </div>
                    </div>
                    <div className="bg-[var(--bg-deep)] rounded-xl p-4 text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">
                        {data.approvalTemplate}
                    </div>
                </div>
            )}

            {/* Rejection Email */}
            {data?.rejectionTemplate && (
                <div className="bg-elevated border border-[var(--border)] rounded-2xl p-6 animate-fade-in-up delay-300">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Mail className="w-5 h-5 text-[var(--accent)]" />
                            <h3 className="text-[var(--text-primary)] font-bold">{tr("application.emailPreview.rejectionPreview", "Rejection email preview")}</h3>
                        </div>
                    </div>
                    <div className="bg-[var(--bg-deep)] rounded-xl p-4 text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">
                        {data.rejectionTemplate}
                    </div>
                </div>
            )}

            {/* Personal Note */}
            <div className="bg-[var(--bg-deep)] rounded-2xl p-6 animate-fade-in-up delay-400">
                <p className="text-[var(--text-muted)] text-xs font-bold uppercase tracking-widest mb-3">
                    {tr("application.emailPreview.personalNote", "Add a personal note (optional)")}
                </p>
                <textarea
                    value={personalNote}
                    onChange={(e) => setPersonalNote(e.target.value)}
                    placeholder={tr("application.emailPreview.personalNotePlaceholder", "Write a custom message that will be appended to approved emails…")}
                    rows={4}
                    className="w-full bg-[var(--bg-surface)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 resize-none border border-[var(--border)]"
                />
            </div>

            {/* Send */}
            <div className="space-y-3 pb-6 animate-fade-in-up" style={{ animationDelay: "500ms" }}>
                {sent ? (
                    <div className="text-center py-6 bg-emerald-400/10 rounded-2xl flex flex-col items-center">
                        <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
                            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                        </div>
                        <p className="text-emerald-400 font-bold mt-2">{tr("application.emailPreview.sentSuccess", "Emails sent successfully!")}</p>
                        <p className="text-emerald-400 text-sm">{tr("application.emailPreview.sentSuccessHint", "All candidates have been notified.")}</p>
                    </div>
                ) : (
                    <>
                    {sendError && (
                        <div className="text-center py-3 px-4 rounded-2xl bg-[var(--accent-dim)] text-[var(--error)] text-sm font-semibold">
                            {sendError}
                        </div>
                    )}
                    <button
                        onClick={handleSend}
                        disabled={sending}
                        className="w-full flex items-center justify-center gap-2 py-4 bg-[var(--accent)] hover:bg-[var(--accent)]-soft disabled:opacity-60 text-white font-bold rounded-2xl transition-all shadow-none uppercase text-sm tracking-wide"
                    >
                        {sending ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                        {sending ? tr("application.emailPreview.sending", "Sending…") : tr("application.emailPreview.sendAll", "Send emails to all candidates")}
                    </button>
                    </>
                )}
                <Link
                    href={ROUTES.company.recruitment.applications}
                    className="block text-center py-3.5 border-2 border-[var(--border)] text-[var(--text-primary)] font-semibold rounded-2xl hover:bg-[var(--bg-surface)] transition-colors"
                >
                    {tr("application.emailPreview.closeArchive", "Close application & archive")}
                </Link>
            </div>
        </div>
    );
}
