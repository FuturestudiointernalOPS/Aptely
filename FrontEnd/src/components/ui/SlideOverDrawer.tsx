"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface SlideOverDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

export function SlideOverDrawer({ isOpen, onClose, title, children }: SlideOverDrawerProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [isOpen, onClose]);

    useEffect(() => {
        document.body.style.overflow = isOpen ? "hidden" : "";
        return () => { document.body.style.overflow = ""; };
    }, [isOpen]);

    if (!isOpen || !mounted) return null;

    return createPortal(
        <div className="fixed inset-0 z-[1100] flex justify-end">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div
                className="relative w-full max-w-xl h-full bg-[var(--bg-surface)] border-l border-[var(--border)] flex flex-col shadow-2xl"
                style={{ animation: "drawerSlideIn 0.25s ease-out" }}
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] flex-shrink-0">
                    <h2 className="font-bold text-[var(--text-primary)]">{title}</h2>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg bg-[var(--bg-raised)] border border-[var(--border)] flex items-center justify-center hover:border-[var(--accent)] transition-colors"
                    >
                        <X className="w-4 h-4 text-[var(--text-muted)]" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-4">{children}</div>
            </div>
        </div>,
        document.body
    );
}
