"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, Building2 } from "lucide-react";
import { apiFetch } from "@/lib/apiHelper";
import { institutionLogoPresignApi, institutionLogoApi } from "@/lib/routes";
import { getClientLocale, t } from "@/lib/i18n";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

export function LogoUploader({
    logoUrl,
    onSaved,
    size = 80,
}: {
    logoUrl: string | null;
    onSaved: (logoUrl: string) => void;
    size?: number;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const locale = getClientLocale();
    const tr = (key: string, fallback: string) => t(locale, key, fallback);

    const handleFile = async (file: File) => {
        setError(null);
        if (!ACCEPTED.includes(file.type)) {
            setError(tr("logo.badType", "JPG, PNG or WEBP only"));
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setError(tr("logo.tooLarge", "Image too large (max 5 MB)"));
            return;
        }
        setBusy(true);
        try {
            const pre = await apiFetch(institutionLogoPresignApi, "HR", {
                method: "POST",
                body: JSON.stringify({ fileName: file.name }),
            });
            if (!pre?.signedUrl || !pre?.path) {
                setError(tr("logo.uploadFailed", "Upload failed"));
                return;
            }
            const put = await fetch(pre.signedUrl, {
                method: "PUT",
                body: file,
                headers: { "content-type": file.type },
            });
            if (!put.ok) {
                setError(tr("logo.uploadFailed", "Upload failed"));
                return;
            }
            const done = await apiFetch(institutionLogoApi, "HR", {
                method: "POST",
                body: JSON.stringify({ path: pre.path }),
            });
            if (done?.logoUrl) {
                onSaved(done.logoUrl);
            } else {
                setError(tr("logo.saveFailed", "Could not save logo"));
            }
        } catch {
            setError(tr("logo.error", "Something went wrong"));
        } finally {
            setBusy(false);
        }
    };

    const inputId = "logo-upload-input";

    return (
        <div className="flex items-center gap-4">
            <div
                className="relative rounded-xl overflow-hidden bg-[var(--bg-raised)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] flex-shrink-0"
                style={{ width: size, height: size }}
            >
                {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                    <Building2 className="w-8 h-8" />
                )}
            </div>
            <div className="space-y-1">
                <label
                    htmlFor={busy ? undefined : inputId}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg-raised)] border border-[var(--border)] text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--accent)]/40 transition-colors cursor-pointer ${busy ? "opacity-50 pointer-events-none" : ""}`}
                >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                    {logoUrl ? tr("logo.change", "Change logo") : tr("logo.add", "Add a logo")}
                </label>
                {error && <p className="text-xs text-red-400">{error}</p>}
                <p className="text-xs text-[var(--text-muted)]">{tr("logo.hint", "JPG, PNG, WEBP · max 5 MB")}</p>
            </div>
            <input
                ref={inputRef}
                id={inputId}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFile(f);
                    e.target.value = "";
                }}
            />
        </div>
    );
}
