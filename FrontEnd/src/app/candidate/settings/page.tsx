"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Settings,
  User2,
  Mail,
  Lock,
  Trash2,
  Save,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getClientLocale, t } from "@/lib/i18n";

export default function CandidateSettingsPage() {
  const { user, logout, setAvatarUrl } = useAuth();
  const locale = getClientLocale();
  const tr = (key: string, fallback: string) => t(locale, key, fallback);
  const router = useRouter();

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (newPassword.length < 8) {
      setPasswordError(tr("settings.password.tooShort", "Password must be at least 8 characters."));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(tr("settings.password.mismatch", "Passwords do not match."));
      return;
    }

    setChangingPassword(true);
    try {
      const { supabase } = await import("@/lib/supabase");
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setPasswordError(error.message);
      } else {
        setPasswordSuccess(tr("settings.password.success", "Password updated successfully."));
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err) {
      setPasswordError(tr("settings.password.error", "Failed to update password."));
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") return;
    setDeleting(true);
    setDeleteError("");
    try {
      const { apiFetch } = await import("@/lib/apiHelper");
      const { authMeDeleteApi } = await import("@/lib/routes");
      await apiFetch(authMeDeleteApi, "HR", { method: "DELETE" });
      await logout();
      router.push("/login");
    } catch (err) {
      setDeleteError(tr("settings.delete.error", "Failed to delete account. You may have active memberships that prevent deletion."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">
          {tr("settings.title", "Paramètres")}
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          {tr("settings.subtitle", "Gérez votre compte et vos préférences")}
        </p>
      </div>

      {/* Personal Info */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <User2 className="w-5 h-5 text-[var(--accent)]" />
          <h2 className="text-sm font-bold text-[var(--text-primary)]">
            {tr("settings.info.title", "Informations personnelles")}
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
              {tr("settings.info.name", "Nom")}
            </label>
            <p className="text-sm text-[var(--text-primary)] font-medium">
              {user?.fullName || user?.email?.split("@")[0] || "—"}
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
              {tr("settings.info.email", "Email")}
            </label>
            <p className="text-sm text-[var(--text-primary)] font-medium">
              {user?.email || "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Password */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Lock className="w-5 h-5 text-[var(--accent)]" />
          <h2 className="text-sm font-bold text-[var(--text-primary)]">
            {tr("settings.password.title", "Changer le mot de passe")}
          </h2>
        </div>

        {passwordSuccess && (
          <div className="bg-emerald-400/10 border border-emerald-400/20 rounded-xl p-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <p className="text-sm text-emerald-400">{passwordSuccess}</p>
          </div>
        )}
        {passwordError && (
          <div className="bg-red-400/10 border border-red-400/20 rounded-xl p-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <p className="text-sm text-red-400">{passwordError}</p>
          </div>
        )}

        <form onSubmit={handlePasswordChange} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
              {tr("settings.password.new", "Nouveau mot de passe")}
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-raised)] border border-[var(--border)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
              {tr("settings.password.confirm", "Confirmer le mot de passe")}
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-raised)] border border-[var(--border)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={changingPassword || !newPassword || !confirmPassword}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {changingPassword ? (
              <><Loader2 className="w-4 h-4 animate-spin" />{tr("settings.password.saving", "Enregistrement...")}</>
            ) : (
              <><Save className="w-4 h-4" />{tr("settings.password.save", "Changer le mot de passe")}</>
            )}
          </button>
        </form>
      </div>

      {/* Danger zone */}
      <div className="bg-[var(--bg-surface)] border border-red-400/20 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Trash2 className="w-5 h-5 text-red-400" />
          <h2 className="text-sm font-bold text-red-400">
            {tr("settings.delete.title", "Supprimer le compte")}
          </h2>
        </div>
        <p className="text-sm text-[var(--text-muted)]">
          {tr("settings.delete.warning", "Cette action est irréversible. Toutes vos données seront définitivement supprimées.")}
        </p>

        {deleteError && (
          <div className="bg-red-400/10 border border-red-400/20 rounded-xl p-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <p className="text-sm text-red-400">{deleteError}</p>
          </div>
        )}

        {!showDeleteConfirm ? (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-red-400/30 text-red-400 text-sm font-semibold hover:bg-red-400/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            {tr("settings.delete.button", "Supprimer mon compte")}
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-[var(--text-primary)] font-semibold">
              {tr("settings.delete.confirm", "Tapez DELETE pour confirmer :")}
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-raised)] border border-[var(--border)] text-sm text-[var(--text-primary)] outline-none focus:border-red-400"
              placeholder="DELETE"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }}
                className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-raised)]"
              >
                {tr("common.cancel", "Annuler")}
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== "DELETE" || deleting}
                className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {deleting ? tr("settings.delete.deleting", "Suppression...") : tr("settings.delete.confirmButton", "Supprimer définitivement")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
