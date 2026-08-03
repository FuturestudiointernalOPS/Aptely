"use client";

import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/apiHelper";
import { authAvatarPresignApi, authAvatarApi } from "@/lib/routes";
import { useAuth } from "@/lib/auth";
import { getClientLocale, t } from "@/lib/i18n";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

export function AvatarUploader({ size = 80 }: { size?: number }) {
    const { user, setAvatarUrl } = useAuth();
    const inputRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const locale = getClientLocale();
    const tr = (key: string, fallback: string) => t(locale, key, fallback);

    const initial = (user?.email?.[0] ?? "?").toUpperCase();

    const handleFile = async (file: File) => {
        setError(null);
        if (!ACCEPTED.includes(file.type)) {
            setError(tr("avatar.badType", "JPG, PNG or WEBP only"));
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setError(tr("avatar.tooLarge", "Image too large (max 5 MB)"));
            return;
        }
        setBusy(true);
        try {
            const pre = await apiFetch(authAvatarPresignApi, "HR", {
                method: "POST",
                body: JSON.stringify({ fileName: file.name }),
            });
            if (!pre?.signedUrl || !pre?.path) {
                setError(tr("avatar.uploadFailed", "Upload failed"));
                return;
            }
            const put = await fetch(pre.signedUrl, {
                method: "PUT",
                body: file,
                headers: { "content-type": file.type },
            });
            if (!put.ok) {
                setError(tr("avatar.uploadFailed", "Upload failed"));
                return;
            }
            const done = await apiFetch(authAvatarApi, "HR", {
                method: "POST",
                body: JSON.stringify({ path: pre.path }),
            });
            if (done?.avatarUrl) {
                setAvatarUrl(done.avatarUrl);
            } else {
                setError(tr("avatar.saveFailed", "Could not save photo"));
            }
        } catch {
            setError(tr("avatar.error", "Something went wrong"));
        } finally {
            setBusy(false);
        }
    };

    const inputId = "avatar-upload-input";

    return (
        <div className="flex items-center gap-4">
            <div
                className="relative rounded-full overflow-hidden bg-[var(--accent)] flex items-center justify-center text-white font-bold flex-shrink-0"
                style={{ width: size, height: size, fontSize: size / 2.5 }}
            >
                {user?.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                    initial
                )}
            </div>
            <div className="space-y-1">
                <label
                    htmlFor={busy ? undefined : inputId}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg-raised)] border border-[var(--border)] text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--accent)]/40 transition-colors cursor-pointer ${busy ? "opacity-50 pointer-events-none" : ""}`}
                >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                    {user?.avatarUrl ? tr("avatar.change", "Change photo") : tr("avatar.add", "Add a photo")}
                </label>
                {error && <p className="text-xs text-red-400">{error}</p>}
                <p className="text-xs text-[var(--text-muted)]">{tr("avatar.hint", "JPG, PNG, WEBP · max 5 MB")}</p>
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
