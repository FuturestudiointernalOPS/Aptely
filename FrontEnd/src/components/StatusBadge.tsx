import { ApplicationStatus } from "@/lib/api";
import { getClientLocale, t } from "@/lib/i18n";

interface Props {
    status: ApplicationStatus;
    size?: "sm" | "md";
}

export default function StatusBadge({ status, size = "md" }: Props) {
    const locale = getClientLocale();
    const tr = (key: string, fallback: string) => t(locale, key, fallback);

    const STATUS_CONFIG: Record<
        ApplicationStatus,
        { label: string; bg: string; text: string; dot: string }
    > = {
        PENDING: {
            label: tr("status.pending", "À traiter"),
            bg: "bg-amber-400/10 border border-amber-400/20",
            text: "text-amber-400",
            dot: "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)]",
        },
        ANALYSING: {
            label: tr("status.analysing", "En cours"),
            bg: "bg-blue-400/10 border border-blue-400/20",
            text: "text-blue-400",
            dot: "bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.5)]",
        },
        FINISHED: {
            label: tr("status.finished", "Traité"),
            bg: "bg-purple-400/10 border border-purple-400/20",
            text: "text-purple-400",
            dot: "bg-purple-400 shadow-[0_0_6px_rgba(167,139,250,0.5)]",
        },
        VALIDATED: {
            label: tr("status.validated", "Validé"),
            bg: "bg-emerald-400/10 border border-emerald-400/20",
            text: "text-emerald-400",
            dot: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]",
        },
        REJECTED: {
            label: tr("status.rejected", "Rejeté"),
            bg: "bg-red-400/10 border border-red-400/20",
            text: "text-red-400",
            dot: "bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.5)]",
        },
        STOPPED: {
            label: tr("status.stopped", "Archivé"),
            bg: "bg-[var(--bg-surface)] border border-[var(--border)]",
            text: "text-[var(--text-muted)]",
            dot: "bg-t-muted",
        },
    };

    const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.STOPPED;
    const px = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs";

    return (
        <span
            className={`inline-flex items-center gap-1.5 font-semibold rounded-full tracking-wide uppercase ${px} ${cfg.bg} ${cfg.text}`}
        >
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
            {cfg.label}
        </span>
    );
}
