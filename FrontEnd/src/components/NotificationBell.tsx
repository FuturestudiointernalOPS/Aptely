"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/apiHelper";
import { API, notificationsReadAllApi, notificationReadApi } from "@/lib/routes";
import { getClientLocale, t } from "@/lib/i18n";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

function timeAgo(date: string, locale: ReturnType<typeof getClientLocale>): string {
  const diffMs = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 2) return t(locale, "notifications.justNow", "À l'instant");
  if (mins < 60) return t(locale, "notifications.minutesAgo", `${mins} min`, { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t(locale, "notifications.hoursAgo", `${hours} h`, { count: hours });
  const days = Math.floor(hours / 24);
  return t(locale, "notifications.daysAgo", `${days} j`, { count: days });
}

export default function NotificationBell() {
  const router = useRouter();
  const locale = getClientLocale();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      // apiFetch unwraps the backend's { data, unread_count } envelope down to the
      // notifications array, so unread_count must be recomputed client-side.
      const res = await apiFetch(API.notifications, "HR");
      const list: Notification[] = Array.isArray(res)
        ? res
        : ((res as { data?: Notification[] } | null)?.data ?? []);
      setNotifications(list);
      setUnreadCount(list.filter((n) => !n.is_read).length);
    } catch { /* silent */ }
  };

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 30_000);
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleMarkAllRead = async () => {
    try {
      await apiFetch(notificationsReadAllApi, "HR", { method: "PATCH" });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch { /* silent */ }
  };

  const handleNotifClick = async (notif: Notification) => {
    if (!notif.is_read) {
      try {
        await apiFetch(notificationReadApi(notif.id), "HR", { method: "PATCH" });
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch { /* silent */ }
    }
    setOpen(false);
    if (notif.link) router.push(notif.link);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent-dim)] transition-colors"
        title={t(locale, "notifications.title", "Notifications")}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[var(--accent)] text-white text-[8px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-lg z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              {t(locale, "notifications.title", "Notifications")}
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                {t(locale, "notifications.markAllRead", "Tout marquer lu")}
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-[var(--border)]">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm font-medium text-[var(--text-secondary)]">
                  {t(locale, "notifications.empty", "Aucune notification")}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  {t(locale, "notifications.emptyDesc", "Vous n'avez pas encore de notifications.")}
                </p>
              </div>
            ) : (
              notifications.map((notif) => (
                <button
                  key={notif.id}
                  type="button"
                  onClick={() => void handleNotifClick(notif)}
                  className={`w-full text-left px-4 py-3 hover:bg-[var(--bg-raised)] transition-colors flex items-start gap-3 ${
                    !notif.is_read ? "bg-[var(--accent-dim)]" : ""
                  }`}
                >
                  {!notif.is_read && (
                    <span className="mt-1.5 flex-shrink-0 w-2 h-2 rounded-full bg-[var(--accent)]" />
                  )}
                  {notif.is_read && <span className="mt-1.5 flex-shrink-0 w-2 h-2" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                      {t(locale, notif.title, notif.title)}
                    </p>
                    {notif.body && (
                      <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{notif.body}</p>
                    )}
                    <p className="text-[10px] text-[var(--text-muted)] mt-1">
                      {timeAgo(notif.created_at, locale)}
                    </p>
                  </div>
                  {notif.link && <ExternalLink className="w-3 h-3 text-[var(--text-muted)] flex-shrink-0 mt-1" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
