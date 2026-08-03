"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { getClientLocale, t as translate } from "@/lib/i18n";

type ToastVariant = "success" | "error" | "info";

interface ToastItem {
    id: number;
    message: string;
    variant: ToastVariant;
}

interface ToastApi {
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
    return ctx;
}

const VARIANT: Record<
    ToastVariant,
    { icon: typeof Info; tint: string; ring: string }
> = {
    success: { icon: CheckCircle2, tint: "text-emerald-400", ring: "border-emerald-400/30" },
    error: { icon: AlertCircle, tint: "text-red-400", ring: "border-red-400/30" },
    info: { icon: Info, tint: "text-[var(--accent)]", ring: "border-[var(--accent)]/30" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
    const locale = getClientLocale();
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const seq = useRef(0);

    const remove = useCallback((id: number) => {
        setToasts((list) => list.filter((t) => t.id !== id));
    }, []);

    const push = useCallback(
        (message: string, variant: ToastVariant) => {
            const id = ++seq.current;
            setToasts((list) => [...list, { id, message, variant }]);
            setTimeout(() => remove(id), 4000);
        },
        [remove],
    );

    // Listen for global permission-denied events from apiFetch
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail as { error?: string } | undefined;
            push(detail?.error || "You do not have permission to perform this action.", "error");
        };
        window.addEventListener("aptely:permission-denied", handler);
        return () => window.removeEventListener("aptely:permission-denied", handler);
    }, [push]);

    const api = useMemo<ToastApi>(
        () => ({
            success: (m) => push(m, "success"),
            error: (m) => push(m, "error"),
            info: (m) => push(m, "info"),
        }),
        [push],
    );

    return (
        <ToastContext.Provider value={api}>
            {children}
            <div
                aria-live="polite"
                aria-atomic="false"
                className="pointer-events-none fixed inset-x-0 bottom-4 z-[200] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end"
            >
                {toasts.map((toast) => {
                    const { icon: Icon, tint, ring } = VARIANT[toast.variant];
                    return (
                        <div
                            key={toast.id}
                            role={toast.variant === "error" ? "alert" : "status"}
                            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border ${ring} bg-[var(--bg-surface)] px-4 py-3 shadow-e2 animate-[toastIn_0.2s_ease-out]`}
                        >
                            <Icon size={18} className={`mt-0.5 flex-shrink-0 ${tint}`} />
                            <p className="flex-1 text-sm text-[var(--text-primary)]">{toast.message}</p>
                            <button
                                type="button"
                                onClick={() => remove(toast.id)}
                                aria-label={translate(locale, "common.close", "Close")}
                                className="tap -mr-1 rounded-md p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                            >
                                <X size={15} />
                            </button>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
}
