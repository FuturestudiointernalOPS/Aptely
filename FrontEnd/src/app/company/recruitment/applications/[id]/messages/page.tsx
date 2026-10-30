"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Send, Loader2, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/apiHelper";
import { getClientLocale, t } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { ROUTES, applicationApiPath, messagesThreadApi, messagesReadApi, appPath } from "@/lib/routes";

interface Message {
  id: string;
  sender_id: string;
  content: string;
  sent_at: string;
  profiles?: { full_name: string } | null;
}

export default function HRMessagesPage() {
  const locale = getClientLocale();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading } = useAuth();

  const userId = user?.userId ?? null;

  const [messages, setMessages] = useState<Message[]>([]);
  const [fetching, setFetching] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const loadMessages = useCallback(async () => {
    const res = await apiFetch(messagesThreadApi(id), "HR", { method: "GET", cache: "no-store" });
    const rows: Message[] = Array.isArray(res) ? res : [];
    setMessages(rows);
  }, [id]);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace(ROUTES.login); return; }
    const init = async () => {
      setFetching(true);
      // Load candidate name from application
      const app = await apiFetch(applicationApiPath(id), "HR", { method: "GET", cache: "no-store" });
      setCandidateName(app?.candidateName ?? app?.candidate_name ?? "Candidate");
      await loadMessages();
      await apiFetch(messagesReadApi(id), "HR", { method: "PATCH" });
      setFetching(false);
    };
    void init();
  }, [loading, user, id, router, loadMessages]);

  // Realtime with REST poll fallback (avoids Next overlay when WebSocket is unavailable)
  useEffect(() => {
    if (!user?.token) return;

    let pollId: ReturnType<typeof setInterval> | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const startPoll = () => {
      if (pollId) return;
      pollId = setInterval(() => {
        void loadMessages();
      }, 8_000);
    };

    const cleanup = () => {
      if (channel) {
        void supabase.removeChannel(channel);
        channel = null;
      }
      if (pollId) {
        clearInterval(pollId);
        pollId = null;
      }
    };

    if (typeof WebSocket === "undefined") {
      console.warn("[hr-messages] WebSocket unavailable — polling");
      startPoll();
      return cleanup;
    }

    try {
      void supabase.auth
        .setSession({ access_token: user.token, refresh_token: "" })
        .catch(() => {});
      channel = supabase
        .channel(`hr-messages:${id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          () => {
            void loadMessages();
          },
        );
      channel.subscribe((status, err) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn("[hr-messages] Realtime failed — polling", err ?? status);
          startPoll();
        }
      });
    } catch (err) {
      console.warn("[hr-messages] Realtime subscribe failed — polling", err);
      startPoll();
    }

    return cleanup;
  }, [id, user?.token, loadMessages]);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const handleSend = async () => {
    if (!draft.trim() || sending) return;
    setSending(true);
    const content = draft.trim();
    setDraft("");
    const res = await apiFetch(messagesThreadApi(id), "HR", {
      method: "POST",
      body: JSON.stringify({ content }),
    });
    if (res?.id) setMessages((prev) => [...prev, res as Message]);
    else setDraft(content);
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); }
  };

  if (loading || fetching) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  return (
    <div className="py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Link href={appPath(id)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide">{t(locale, "individual.hrMessages.messages", "Messages")}</p>
            <h1 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[var(--accent)]" />
              {candidateName ?? t(locale, "individual.hrMessages.candidateFallback", "Candidate")}
            </h1>
          </div>
        </div>

        <div className="bg-[var(--bg-surface)] border border-[var(--border)] overflow-hidden" style={{ height: "calc(100vh - 220px)", minHeight: "400px" }}>
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-xs text-[var(--text-muted)]">{t(locale, "individual.hrMessages.noMessages", "No messages yet. Start the conversation.")}</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.sender_id === userId;
                  return (
                    <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 space-y-1 ${
                        isMine
                          ? "bg-[var(--accent)] text-white rounded-br-sm"
                          : "bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] rounded-bl-sm"
                      }`}>
                        {!isMine && (
                          <p className="text-[10px] font-bold opacity-70">
                            {(msg.profiles as unknown as { full_name: string } | null)?.full_name ?? candidateName ?? t(locale, "individual.hrMessages.candidateFallback", "Candidate")}
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

            <div className="p-4 border-t border-[var(--border)] flex gap-2 items-end">
              <textarea
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t(locale, "individual.hrMessages.placeholder", "Type a message… (Enter to send, Shift+Enter for new line)")}
                className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg-deep)] px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] resize-none placeholder:text-[var(--text-muted)]/50"
              />
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={sending || !draft.trim()}
                className="rounded-xl bg-[var(--accent)] p-3 text-white hover:bg-[var(--accent)]/90 disabled:opacity-50 transition-colors flex-shrink-0"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
