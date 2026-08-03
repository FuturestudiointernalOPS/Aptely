"use client";

import { ReactNode, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { getClientLocale, t } from "@/lib/i18n";

interface ModalProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    description?: string;
    /** Centered: sm=max-w-md, md=max-w-lg, lg=max-w-2xl. Slide-over: sm=max-w-md, md=max-w-xl, lg=max-w-3xl. */
    size?: "sm" | "md" | "lg";
    /** Slide-over panel anchored to the right edge (drawer) instead of centered. */
    slideOver?: boolean;
    /** Hide the default close (X) button in the header. */
    hideClose?: boolean;
    /** Extra controls rendered in the header, left of the close button. */
    headerActions?: ReactNode;
    footer?: ReactNode;
    children: ReactNode;
    /** Extra classes for the panel. */
    className?: string;
}

const SIZE: Record<NonNullable<ModalProps["size"]>, string> = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
};

const SLIDE_SIZE: Record<NonNullable<ModalProps["size"]>, string> = {
    sm: "max-w-md",
    md: "max-w-xl",
    lg: "max-w-3xl",
};

const FOCUSABLE =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({
    open,
    onClose,
    title,
    description,
    size = "md",
    slideOver = false,
    hideClose = false,
    headerActions,
    footer,
    children,
    className = "",
}: ModalProps) {
    const locale = getClientLocale();
    const titleId = useId();
    const descId = useId();
    const panelRef = useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = useState(false);
    const onCloseRef = useRef(onClose);

    useEffect(() => setMounted(true), []);

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if (!open) return;

        const previouslyFocused = document.activeElement as HTMLElement | null;
        const panel = panelRef.current;

        const focusables = () =>
            panel ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)) : [];

        // Move focus into the dialog on open.
        const first = focusables()[0];
        (first ?? panel)?.focus();

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.stopPropagation();
                onCloseRef.current();
                return;
            }
            if (e.key === "Tab") {
                const items = focusables();
                if (items.length === 0) {
                    e.preventDefault();
                    panel?.focus();
                    return;
                }
                const firstEl = items[0];
                const lastEl = items[items.length - 1];
                if (e.shiftKey && document.activeElement === firstEl) {
                    e.preventDefault();
                    lastEl.focus();
                } else if (!e.shiftKey && document.activeElement === lastEl) {
                    e.preventDefault();
                    firstEl.focus();
                }
            }
        };

        document.addEventListener("keydown", onKeyDown, true);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.removeEventListener("keydown", onKeyDown, true);
            document.body.style.overflow = prevOverflow;
            previouslyFocused?.focus?.();
        };
    }, [open]);

    if (!mounted || !open) return null;

    const panelMotion = slideOver
        ? "animate-[slideInRight_0.22s_ease-out]"
        : "animate-[modalPop_0.18s_ease-out]";

    const positioning = slideOver
        ? "items-stretch justify-end"
        : "items-center justify-center p-4";

    const panelShape = slideOver
        ? `h-full w-full ${SLIDE_SIZE[size]} rounded-l-2xl`
        : `w-full ${SIZE[size]} max-h-[90vh] rounded-2xl`;

    return createPortal(
        <div
            className={`fixed inset-0 z-[100] flex ${positioning} bg-[var(--bg-deep)]/70 animate-[overlayFade_0.15s_ease-out]`}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? titleId : undefined}
                aria-describedby={description ? descId : undefined}
                tabIndex={-1}
                className={`relative flex flex-col border border-[var(--border)] bg-[var(--bg-surface)] shadow-e3 outline-none ${panelShape} ${panelMotion} ${className}`}
            >
                {(title || headerActions || !hideClose) && (
                    <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
                        <div className="min-w-0">
                            {title && (
                                <h2 id={titleId} className="text-section-title text-[var(--text-primary)]">
                                    {title}
                                </h2>
                            )}
                            {description && (
                                <p id={descId} className="mt-1 text-sm text-[var(--text-muted)]">
                                    {description}
                                </p>
                            )}
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-2">
                            {headerActions}
                            {!hideClose && (
                                <button
                                    type="button"
                                    onClick={onClose}
                                    aria-label={t(locale, "common.close", "Close")}
                                    className="tap rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--bg-raised)] hover:text-[var(--text-primary)]"
                                >
                                    <X size={18} />
                                </button>
                            )}
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

                {footer && (
                    <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] px-5 py-4">
                        {footer}
                    </div>
                )}
            </div>
        </div>,
        document.body,
    );
}
