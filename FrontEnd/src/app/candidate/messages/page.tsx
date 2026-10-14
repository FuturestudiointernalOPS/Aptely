"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { MessageSquare, Send, Loader2, ArrowLeft, Briefcase, ExternalLink } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { apiFetch } from "@/lib/apiHelper";
import { getClientLocale, t } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { ROUTES, API, createAuthRedirect, messagesThreadApi, messagesReadApi, individualsMyApplicationsApi } from "@/lib/routes";

interface Thread {
  id: string;
  application_id: string;
  role_title: string;
  institution_name: string | null;
  application_status: string | null;
  last_message: { content: string; sent_at: string } | null;
  last_message_at: string | null;
  unread_count: number;
}

interface Message {
  id: string;
  sender_id: string;
  content: string;
  sent_at: string;
  read_at: string | null;
  profiles?: { full_name: string } | null;
}

export default function MessagesPage() {
  const locale = getClientLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const { isPersonal } = useWorkspace();

  const userId = user?.userId ?? null;

  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [pendingAppTitle, setPendingAppTitle] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [fetching, setFetching] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showThreadList, setShowThreadList] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const reloadMessages = useCallback(async (applicationId: string) => {
    const res = await apiFetch(messagesThreadApi(applicationId), "HR", { method: "GET", cache: "no-store" });
    const rows: Message[] = Array.isArray(res) ? res : [];
    setMessages(rows);
  }, []);

  const openThread = async (applicationId: string) => {
    if (selectedApp === applicationId) return;
    setSelectedApp(applicationId);
    setMessages([]);
    setLoadingMsgs(true);
    await reloadMessages(applicationId);
    setLoadingMsgs(false);
    apiFetch(messagesReadApi(applicationId), "HR", { method: "PATCH" });
    setThreads((prev) => prev.map((t) => t.application_id === applicationId ? { ...t, unread_count: 0 } : t));
  };

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace(createAuthRedirect(ROUTES.candidate.messages)); return; }
    if (!isPersonal) { router.replace(ROUTES.company.dashboard); return; }

    apiFetch(API.messages, "HR", { method: "GET", cache: "no-store" }).then((res) => {
      const rows: Thread[] = Array.isArray(res) ? res : [];
      setThreads(rows);
      setFetching(false);
      const appParam = searchParams.get("app");
      if (appParam) {
        const exists = rows.find((t) => t.application_id === appParam);
        if (exists) {
          openThread(appParam);
        } else {
          setSelectedApp(appParam);
          apiFetch(individualsMyApplicationsApi, "HR", { method: "GET", cache: "no-store" }).then((appRes) => {
            const apps: Array<{ id: string; role: { title: string; institution_name: string | null } }> =
              Array.isArray(appRes?.data) ? appRes.data : Array.isArray(appRes) ? appRes : [];
            const found = apps.find((a) => a.id === appParam);
            if (found) setPendingAppTitle(`${found.role.title}${found.role.institution_name ? ` · ${found.role.institution_name}` : ""}`);
          });
        }
      }
    });
  }, [loading, router, user, isPersonal]);

  // Supabase Realtime
  useEffect(() => {
    if (!selectedApp || !user?.token) return;

    supabase.auth.setSession({ access_token: user.token, refresh_token: "" }).catch(() => {});

    const channel = supabase
      .channel(`messages:${selectedApp}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const newMsg = payload.new as Message;
        reloadMessages(selectedApp);
        setThreads((prev) =>
          prev.map((t) =>
            t.application_id === selectedApp
              ? { ...t, last_message: { content: newMsg.content, sent_at: newMsg.sent_at }, last_message_at: newMsg.sent_at }
              : t
          )
        );
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedApp, user?.token, reloadMessages]);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const handleSend = async () => {
    if (!draft.trim() || !selectedApp || sending) return;
    setSending(true);
    setError(null);
    const content = draft.trim();
    setDraft("");
    const res = await apiFetch(messagesThreadApi(selectedApp), "HR", {
      method: "POST",
      body: JSON.stringify({ content }),
    });
    if (res?.id) {
      setMessages((prev) => [...prev, res as Message]);
      setThreads((prev) =>
        prev.map((t) =>
          t.application_id === selectedApp
            ? { ...t, last_message: { content, sent_at: new Date().toISOString() }, last_message_at: new Date().toISOString() }
            : t
        )
      );
    } else {
      setDraft(content);
      setError(t(locale, "messages.sendError", "Échec de l'envoi. Réessayez."));
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  if (loading || fetching) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 sm:p-6 text-sm text-[var(--text-muted)]">{t(locale, "individual.messages.loading", "Loading messages...")}</div>
      </div>
    );
  }

  const selectedThread = threads.find((t) => t.application_id === selectedApp);

  const handleOpenThread = (appId: string) => {
    openThread(appId);
    setShowThreadList(false);
  };

  return (
    <div className="py-4 px-4 sm:py-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl overflow-hidden h-[calc(100vh-220px)] lg:h-[calc(100vh-160px)] min-h-[460px]">
          <div className="flex h-full">
            {/* Thread list */}
            <div className={`${selectedApp && !showThreadList ? "hidden" : "flex"} md:flex w-full md:w-72 flex-shrink-0 border-r border-[var(--border)] flex-col`}>
              <div className="p-4 border-b border-[var(--border)]">
                <h1 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[var(--accent)]" />
                  {t(locale, "individual.messages.title", "Messages")}
                </h1>
                <div className="flex items-center gap-3 mt-2">
                  <Link href={ROUTES.candidate.opportunities}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--accent)] hover:opacity-80 transition-opacity">
                    <Briefcase className="w-3 h-3" />
                    {t(locale, "individual.messages.discoverOffers", "Discover offers")}
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {threads.length === 0 ? (
                  <div className="p-6 flex flex-col items-center gap-3 text-center mt-8">
                    <MessageSquare className="w-10 h-10 text-[var(--text-muted)]/30" />
                    <p className="text-xs text-[var(--text-muted)]">{t(locale, "individual.messages.noConversations", "No conversations yet.")}</p>
                  </div>
                ) : (
                  threads.map((thread) => (
                    <button
                      key={thread.id}
                      type="button"
                      onClick={() => handleOpenThread(thread.application_id)}
                      className={`w-full text-left p-4 border-b border-[var(--border)] transition-colors space-y-1 ${
                        selectedApp === thread.application_id
                          ? "bg-[var(--accent-dim)] text-[var(--accent)]"
                          : "hover:bg-[var(--bg-raised)]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-[var(--text-primary)] truncate">{thread.role_title}</p>
                        {thread.unread_count > 0 && (
                          <span className="flex-shrink-0 w-4 h-4 rounded-full bg-[var(--accent)] text-white text-[9px] font-bold flex items-center justify-center">
                            {thread.unread_count}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[var(--text-muted)] truncate">{thread.institution_name ?? "—"}</p>
                      {thread.last_message && (
                        <p className="text-[10px] text-[var(--text-muted)] truncate">{thread.last_message.content}</p>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Chat area */}
            <div className={`${showThreadList && !selectedApp ? "hidden md:flex" : "flex"} flex-1 flex-col min-w-0`}>
              {!selectedApp ? (
                <div className="flex-1 flex items-center justify-center flex-col gap-3">
                  <MessageSquare className="w-10 h-10 text-[var(--text-muted)]/30" />
                  <p className="text-sm text-[var(--text-muted)]">{t(locale, "individual.messages.selectPrompt", "Select a conversation to start messaging.")}</p>
                </div>
              ) : (
                <>
                  <div className="p-4 border-b border-[var(--border)] flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowThreadList(true)}
                      className="md:hidden p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      aria-label={t(locale, "messages.backToThreads", "Back to threads")}
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[var(--text-primary)] truncate">
                        {selectedThread?.role_title ?? (pendingAppTitle ? pendingAppTitle.split(" · ")[0] : "")}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] truncate">
                        {selectedThread?.institution_name ?? (pendingAppTitle ? pendingAppTitle.split(" · ")[1] ?? "" : "")}
                      </p>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {loadingMsgs ? (
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-5 h-5 animate-spin text-[var(--text-muted)]" />
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-xs text-[var(--text-muted)]">{t(locale, "individual.messages.noMessages", "No messages yet. Start the conversation.")}</p>
                      </div>
                    ) : (
                      messages.map((msg) => {
                        const isMine = msg.sender_id === userId;
                        return (
                          <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 space-y-1 ${
                              isMine
                                ? "bg-[var(--accent)] text-white rounded-br-sm"
                                : "bg-[var(--bg-raised)] border border-[var(--border)] text-[var(--text-primary)] rounded-bl-sm"
                            }`}>
                              {!isMine && (
                                <p className="text-[10px] font-bold opacity-70">
                                  {(msg.profiles as unknown as { full_name: string } | null)?.full_name ?? t(locale, "individual.messages.institution", "Institution")}
                                </p>
                              )}
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                              <p className={`text-[10px] text-right ${isMine ? "opacity-70" : "text-[var(--text-muted)]"}`}>
                                {new Date(msg.sent_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {error && (
                    <div className="px-4 py-2 border-t border-[var(--border)] text-xs text-[var(--error)]">{error}</div>
                  )}
                  <div className="p-4 border-t border-[var(--border)] flex gap-2 items-end">
                    <textarea
                      rows={1}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={t(locale, "individual.messages.placeholder", "Type a message… (Enter to send, Shift+Enter for new line)")}
                      className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg-raised)] px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] resize-none placeholder:text-[var(--text-muted)]/50"
                    />
                    <button
                      type="button"
                      onClick={handleSend}
                      disabled={sending || !draft.trim()}
                      className="rounded-xl bg-[var(--accent)] p-3 text-white hover:opacity-90 disabled:opacity-50 transition-colors flex-shrink-0"
                    >
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
