"use client";

import Modal from "@/components/ui/Modal";
import { ApplicationPanel } from "@/components/ApplicationPanel";
import { ChevronLeft, ChevronRight, Share2 } from "lucide-react";
import { getClientLocale, t } from "@/lib/i18n";

interface ApplicationDrawerProps {
    appId: string | null;
    onClose: () => void;
    onNext?: () => void;
    onPrev?: () => void;
    hasNext?: boolean;
    hasPrev?: boolean;
}

export default function ApplicationDrawer({
    appId,
    onClose,
    onNext,
    onPrev,
    hasNext = false,
    hasPrev = false,
}: ApplicationDrawerProps) {
    const locale = getClientLocale();
    const tr = (key: string, fallback: string) => t(locale, key, fallback);

    if (!appId) return null;

    const handleShare = async () => {
        try {
            const url = window.location.href;
            if (navigator.share) {
                await navigator.share({ url });
            } else {
                await navigator.clipboard.writeText(url);
            }
        } catch { /* silent */ }
    };

    return (
        <Modal
            open={!!appId}
            onClose={onClose}
            slideOver
            size="lg"
            hideClose={false}
            headerActions={
                <div className="flex items-center gap-1">
                    <button
                        onClick={onPrev}
                        disabled={!hasPrev}
                        title={tr("drawer.app.prev", "Previous candidate")}
                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                        onClick={onNext}
                        disabled={!hasNext}
                        title={tr("drawer.app.next", "Next candidate")}
                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handleShare}
                        title={tr("drawer.app.share", "Copy link")}
                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors"
                    >
                        <Share2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            }
        >
            <div className="p-5 overflow-y-auto">
                <ApplicationPanel
                    appId={appId}
                    fullPage={false}
                    onClose={onClose}
                    onNext={onNext}
                    onPrev={onPrev}
                    hasNext={hasNext}
                    hasPrev={hasPrev}
                />
            </div>
        </Modal>
    );
}
