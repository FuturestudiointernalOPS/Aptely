"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getHRMembers,
  getInstitutionSettings,
  getPersonalSettings,
  InstitutionSettings,
  PersonalSettings,
  updatePersonalSettings,
} from "@/lib/api";
import { apiFetch, isApiSuccess } from "@/lib/apiHelper";
import { getClientLocale, localizePath, setLocaleCookie, t } from "@/lib/i18n";
import { AvatarUploader } from "@/components/ui/AvatarUploader";
import { LogoUploader } from "@/components/ui/LogoUploader";
import { useToast } from "@/components/ui/Toast";
import { InstitutionSettingsSchema, parseForm } from "@/lib/schemas";
import { useAuth, useRequireInstitution } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import {
  ArrowLeft,
  AlertCircle,
  CalendarRange,
  CheckCircle2,
  Copy,
  ExternalLink,
  Link2,
  LogOut,
  MapPin,
  ShieldCheck,
  RefreshCw,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import {
  ROUTES,
  API,
  institutionOwnerLabelApi,
  institutionInvitationsApi,
  institutionInviteRegenerateApi,
  authMeApi,
} from "@/lib/routes";

const TEAM_SIZES = [10, 50, 200, 500, 1000];
const STAGES = [
  "Pre-Seed",
  "Seed",
  "Series A",
  "Series B",
  "Series C+",
  "Growth",
  "Public",
];

type SettingsTab = "WORKSPACE" | "PERSONAL";

type ActivityItem = {
  at: string;
  label: string;
};

function defaultPersonalSettings(): PersonalSettings {
  return {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    language: "fr",
    emailNotifications: true,
    inAppNotifications: true,
    interviewReminders: true,
    defaultInterviewDuration: 60,
    interviewBufferMinutes: 15,
    workdayStart: "09:00",
    workdayEnd: "18:00",
    calcomLink: "",
  };
}

export default function InstitutionSettingsPage() {
  useRequireInstitution();
  const { user, logout } = useAuth();
  const { active, refresh: refreshWorkspace, hasPermission } = useWorkspace();
  // Gate on effective permissions (OWNER and ADMIN have both by default), not on
  // the OWNER status: the backend authorises these actions by permission.
  const canEditInstitution = hasPermission("settings.edit");
  const canManageInvites = hasPermission("members.invite");
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const locale = getClientLocale();
  const tr = (key: string, fallback: string) => t(locale, key, fallback);

  const [activeTab, setActiveTab] = useState<SettingsTab>("WORKSPACE");

  const [settings, setSettings] = useState<InstitutionSettings | null>(null);
  const [baselineSettings, setBaselineSettings] =
    useState<InstitutionSettings | null>(null);

  const [personalSettings, setPersonalSettings] = useState<PersonalSettings>(
    defaultPersonalSettings(),
  );
  const [baselinePersonalSettings, setBaselinePersonalSettings] =
    useState<PersonalSettings>(defaultPersonalSettings());

  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [isLoading, setIsLoading] = useState(true);
  const [ownerStatusLoading, setOwnerStatusLoading] = useState(true);
  const [inviteCopied, setInviteCopied] = useState(false);

  const [saveBanner, setSaveBanner] = useState<string | null>(null);
  const [memberStatus, setMemberStatus] = useState<string | null>(null);
  const [ownerEmails, setOwnerEmails] = useState<string[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityItem[]>([]);
  const [displayInviteCode, setDisplayInviteCode] = useState("--------");
  const [displayInviteToken, setDisplayInviteToken] = useState("");
  const [displayInviteId, setDisplayInviteId] = useState<string | null>(null);
  const [regeneratingInvite, setRegeneratingInvite] = useState(false);

  // Owner role label — self-service rename
  const [ownerLabel, setOwnerLabel] = useState("");
  const [savingLabel, setSavingLabel] = useState(false);

  // Sync input with workspace context once it loads
  useEffect(() => {
    if (active.kind === "institution") {
      setOwnerLabel(active.membership.role_custom_label ?? "");
    }
  }, [active]);

  const pushActivity = useCallback((label: string) => {
    setActivityLog((prev) =>
      [{ at: new Date().toISOString(), label }, ...prev].slice(0, 12),
    );
  }, []);

  const handleRegenerateInvite = useCallback(async () => {
    if (!displayInviteId || regeneratingInvite) return;
    setRegeneratingInvite(true);
    try {
      const res = await apiFetch(
        institutionInviteRegenerateApi(displayInviteId),
        "HR",
        { method: "PATCH" },
      );
      const newData = res?.data || res;
      if (newData?.token) {
        setDisplayInviteToken(newData.token);
        setDisplayInviteCode(newData.token);
        setDisplayInviteId(newData.id || null);
        setInviteCopied(false);
      }
    } catch {
      // silently fail — the old link remains valid
    } finally {
      setRegeneratingInvite(false);
    }
  }, [displayInviteId, regeneratingInvite]);

  const handleSaveOwnerLabel = useCallback(async () => {
    setSavingLabel(true);
    const res = await apiFetch(institutionOwnerLabelApi, "HR", {
      method: "PATCH",
      body: JSON.stringify({ label: ownerLabel }),
    });
    setSavingLabel(false);
    if (isApiSuccess(res)) {
      // Reload to refresh workspace context so badge updates immediately
      window.location.reload();
    }
  }, [ownerLabel]);

  useEffect(() => {
    const loadSettings = async () => {
      setIsLoading(true);

      // getHRMembers walks every page: the first page alone (20 members) may not
      // contain the current user, which left their status unknown.
      const [institutionData, membersList] = await Promise.all([
        getInstitutionSettings(),
        getHRMembers().catch(() => []),
      ]);

      if (institutionData.name === "Unknown") {
        router.push(ROUTES.company.settings.onboarding);
        return;
      }

      const currentMember = user?.email
        ? membersList.find((member) => member.email.toLowerCase() === user.email.toLowerCase())
        : undefined;
      if (membersList.length > 0) {
        setOwnerEmails(
          membersList
            .filter((member) => member.membershipStatus === "OWNER")
            .map((member) => member.email)
            .filter(Boolean),
        );
        setMemberStatus(currentMember?.membershipStatus ?? null);
      }

      setSettings(institutionData);
      setBaselineSettings(institutionData);

      // Display the canonical institution invite code/link.
      // GET existing invite first (matches Équipe); only POST if none exists.
      // Owners and admins can create the canonical invite (members.invite by default).
      const canCreateInvite =
        currentMember?.membershipStatus === "OWNER" || currentMember?.membershipStatus === "ADMIN";
      try {
        let token = "";
        // Always GET first — ensures same token as Équipe
        const invites = await apiFetch(institutionInvitationsApi, "HR", {
          method: "GET",
        });
        if (Array.isArray(invites) && invites.length > 0) {
          token = String(invites[0].token || "");
          setDisplayInviteId(String(invites[0].id || ""));
        }
        // Only POST if no existing invite AND user may create one
        if (!token && canCreateInvite) {
          const created = await apiFetch(institutionInvitationsApi, "HR", {
            method: "POST",
            body: JSON.stringify({}),
          });
          token = created?.token || created?.data?.token || "";
          setDisplayInviteId(created?.id || created?.data?.id || "");
        }
        if (token) {
          setDisplayInviteToken(token);
          setDisplayInviteCode(token);
        }
      } catch {
        /* ignore */
      }

      setOwnerStatusLoading(false);
      setIsLoading(false);
    };

    loadSettings();
  }, [router, user?.email]);

  useEffect(() => {
    const loadPersonalSettings = async () => {
      const prefs = await getPersonalSettings();
      if (!prefs) {
        const defaults = defaultPersonalSettings();
        setPersonalSettings(defaults);
        setBaselinePersonalSettings(defaults);
        return;
      }

      setPersonalSettings(prefs);
      setBaselinePersonalSettings(prefs);
    };

    loadPersonalSettings();
  }, []);

  const workspaceChangedFields = useMemo(() => {
    if (!settings || !baselineSettings) return [] as string[];

    const labels: Record<keyof InstitutionSettings, string> = {
      institutionId: tr(
        "institution.settings.field.institution",
        "Institution",
      ),
      name: tr(
        "institution.settings.field.institutionName",
        "Institution Name",
      ),
      website: tr("institution.settings.field.website", "Website"),
      sector: tr("institution.settings.field.sector", "Sector"),
      teamSize: tr("institution.settings.field.teamSize", "Team Size"),
      stage: tr("institution.settings.field.fundingStage", "Funding Stage"),
      location: tr("institution.settings.field.location", "Location"),
      description: tr("institution.settings.field.description", "Description"),
      logoUrl: tr("institution.settings.field.logo", "Logo"),
    };

    const changed: string[] = [];
    const keys: Array<keyof InstitutionSettings> = [
      "name",
      "website",
      "sector",
      "teamSize",
      "stage",
      "location",
      "description",
    ];

    keys.forEach((key) => {
      const currentValue = settings[key] ?? null;
      const baseValue = baselineSettings[key] ?? null;
      if (String(currentValue) !== String(baseValue)) {
        changed.push(labels[key]);
      }
    });

    return changed;
  }, [settings, baselineSettings, tr]);

  const isWorkspaceDirty = workspaceChangedFields.length > 0;

  const isPersonalDirty = useMemo(() => {
    return (
      JSON.stringify(personalSettings) !==
      JSON.stringify(baselinePersonalSettings)
    );
  }, [personalSettings, baselinePersonalSettings]);

  const hasUnsavedChanges = isWorkspaceDirty || isPersonalDirty;

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleLogoSaved = (logoUrl: string) => {
    setSettings((prev) => (prev ? { ...prev, logoUrl } : prev));
    setBaselineSettings((prev) => (prev ? { ...prev, logoUrl } : prev));
    // Refresh workspace so the new institution logo propagates to the topbar pill immediately.
    void refreshWorkspace();
  };

  const handleChange = (
    field: keyof InstitutionSettings,
    value: string | number | undefined,
  ) => {
    setSettings((prev) => (prev ? { ...prev, [field]: value } : prev));
    setSaved(false);
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSaveWorkspace = async () => {
    if (!settings) return;

    if (!canEditInstitution) {
      setSaveBanner(
        tr(
          "institution.settings.ownerOnlyWorkspace",
          "You don't have permission to edit workspace settings. Your personal settings remain available in the Personal tab.",
        ),
      );
      return;
    }

    if (!isWorkspaceDirty) {
      setSaveBanner(
        tr(
          "institution.settings.noWorkspaceChanges",
          "No workspace changes to save.",
        ),
      );
      return;
    }

    const validation = parseForm(InstitutionSettingsSchema, {
      name: settings.name,
      website: settings.website,
      sector: settings.sector,
      description: settings.description,
      location: settings.location,
      teamSize:
        typeof settings.teamSize === "number" ? settings.teamSize : undefined,
      stage: settings.stage,
    });

    if (!validation.success) {
      setErrors(validation.errors);
      return;
    }

    setSavingWorkspace(true);
    setErrors({});
    try {
      const res = await apiFetch(API.institution, "HR", {
        method: "PATCH",
        body: JSON.stringify(validation.data),
      });

      if (!isApiSuccess(res)) {
        setSaveBanner(
          (res as { error?: string } | null)?.error ??
            tr("institution.settings.workspaceSaveFailed", "Unable to save workspace settings."),
        );
      } else {
        setSaved(true);
        setBaselineSettings(settings);
        setSaveBanner(
          tr(
            "institution.settings.workspaceSaved",
            "Workspace settings updated successfully.",
          ),
        );
        pushActivity(
          tr(
            "institution.settings.workspaceSavedActivity",
            "Workspace settings saved",
          ),
        );
      }
    } finally {
      setSavingWorkspace(false);
    }
  };

  const handleSavePersonal = async () => {
    if (!isPersonalDirty) {
      setSaveBanner(
        tr(
          "institution.settings.noPersonalChanges",
          "No personal changes to save.",
        ),
      );
      return;
    }

    setSavingPersonal(true);
    const prevLanguage = baselinePersonalSettings.language;
    try {
      const updated = await updatePersonalSettings(personalSettings);
      if (updated) {
        setPersonalSettings(updated);
        setBaselinePersonalSettings(updated);
        setSaveBanner(
          tr(
            "institution.settings.personalSaved",
            "Personal preferences updated successfully.",
          ),
        );
        toast.success(
          tr(
            "institution.settings.personalSaved",
            "Personal preferences updated successfully.",
          ),
        );
        pushActivity(
          tr(
            "institution.settings.personalSavedActivity",
            "Personal preferences saved",
          ),
        );
        // Apply the chosen UI language immediately (cookie + reload into localized path)
        if (updated.language && updated.language !== prevLanguage) {
          setLocaleCookie(updated.language);
          const path = `${window.location.pathname}${window.location.search}`;
          window.location.assign(localizePath(path, updated.language));
          return;
        }
      }
    } catch {
      toast.error(tr("common.saveError", "Something went wrong while saving."));
    } finally {
      setSavingPersonal(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      tr(
        "institution.settings.deleteConfirm",
        "Delete your account permanently? This cannot be undone.",
      ),
    );

    if (!confirmed) return;

    const typedConfirmation = window.prompt(
      tr(
        "institution.settings.deleteTypeConfirm",
        "Type DELETE to confirm permanent account deletion.",
      ),
    );

    if (typedConfirmation !== "DELETE") {
      setSaveBanner(
        tr(
          "institution.settings.deleteCancelled",
          "Account deletion cancelled. Confirmation text did not match.",
        ),
      );
      return;
    }

    setDeletingAccount(true);
    try {
      const response = await apiFetch(authMeApi, "HR", {
        method: "DELETE",
        body: JSON.stringify({ confirm: true }),
      });

      if (
        response &&
        typeof response === "object" &&
        "isAuthError" in response &&
        response.isAuthError
      ) {
        setSaveBanner(
          tr(
            "institution.settings.sessionExpired",
            "Session expired. Please log in again.",
          ),
        );
        return;
      }

      if (!response) {
        setSaveBanner(
          tr(
            "institution.settings.deleteBlockedLastOwner",
            "Unable to delete account. If you are the last owner, transfer ownership first.",
          ),
        );
        return;
      }

      logout();
      router.push(ROUTES.login);
    } catch (error) {
      console.error("[Settings] Delete account failed:", error);
      setSaveBanner(
        tr(
          "institution.settings.deleteFailed",
          "Unable to delete account right now. Please try again.",
        ),
      );
    } finally {
      setDeletingAccount(false);
    }
  };

  const formatExpiresAt = (value: string | null): string | null => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString(locale === "en" ? "en-US" : "fr-FR");
  };

  if (!settings || isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
      </div>
    );
  }

  const FieldError = ({ field }: { field: string }) =>
    errors[field] ? (
      <p className="mt-1 flex items-center gap-1 text-xs text-red-400">
        <AlertCircle className="h-3 w-3" /> {errors[field]}
      </p>
    ) : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href={ROUTES.company.dashboard}
            className="rounded-lg border border-[var(--border)] p-2 text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <p className="text-xs uppercase tracking-widest text-[var(--text-muted)]">
              {tr("institution.settings.title", "Settings")}
            </p>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">
              {tr(
                "institution.settings.subtitle",
                "Workspace and personal preferences",
              )}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "WORKSPACE" && (
            <button
              onClick={handleSaveWorkspace}
              disabled={
                savingWorkspace ||
                ownerStatusLoading ||
                !canEditInstitution ||
                !isWorkspaceDirty
              }
              className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent)]-soft disabled:opacity-60"
            >
              {savingWorkspace
                ? tr("common.saving", "Saving...")
                : tr("institution.settings.saveWorkspace", "Save workspace")}
            </button>
          )}
          {activeTab === "PERSONAL" && (
            <button
              onClick={handleSavePersonal}
              disabled={savingPersonal || !isPersonalDirty}
              className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent)]-soft disabled:opacity-60"
            >
              {savingPersonal
                ? tr("common.saving", "Saving...")
                : tr("institution.settings.savePersonal", "Save personal")}
            </button>
          )}
        </div>
      </div>

      <div className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-1">
        <button
          type="button"
          onClick={() => setActiveTab("WORKSPACE")}
          className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
            activeTab === "WORKSPACE"
              ? "bg-[var(--bg-surface)]-active text-[var(--text-primary)]"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          {tr("institution.settings.tab.workspace", "Workspace")}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("PERSONAL")}
          className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
            activeTab === "PERSONAL"
              ? "bg-[var(--bg-surface)]-active text-[var(--text-primary)]"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          {tr("institution.settings.tab.personal", "Personal")}
        </button>
      </div>

      {hasUnsavedChanges && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          {tr(
            "institution.settings.unsaved",
            "You have unsaved changes. If you leave now, your edits will be lost.",
          )}
        </div>
      )}

      {saveBanner && (
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
          {saveBanner}
        </div>
      )}

      {activeTab === "WORKSPACE" && (
        <>
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] overflow-hidden">
            <div className="border-b border-[var(--border)] px-5 py-3">
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                {tr(
                  "institution.settings.permissionsTitle",
                  "Your permissions",
                )}
              </p>
            </div>
            <div className="space-y-2 p-5 text-sm text-[var(--text-secondary)]">
              <p>
                {tr(
                  "institution.settings.currentMembership",
                  "Current membership status",
                )}
                :{" "}
                <span className="font-semibold text-[var(--text-primary)]">
                  {memberStatus ||
                    tr("institution.settings.unknown", "UNKNOWN")}
                </span>
              </p>
              {canEditInstitution ? (
                <p>
                  {tr(
                    "institution.settings.canEdit",
                    "You can edit and save institution settings.",
                  )}
                </p>
              ) : (
                <p>
                  {tr(
                    "institution.settings.readOnly",
                    "You can view workspace settings, but not edit them (settings permission required).",
                  )}
                  {ownerEmails.length > 0
                    ? ` ${tr("institution.settings.owners", "Owners")}: ${ownerEmails.join(", ")}.`
                    : ""}
                </p>
              )}
            </div>
          </div>

          {isWorkspaceDirty && (
            <div className="rounded-xl border border-sky-400/20 bg-sky-400/10 px-4 py-3 text-sm text-sky-200">
              {tr("institution.settings.changedFields", "Changed fields")}:{" "}
              {workspaceChangedFields.join(", ")}
            </div>
          )}

          {canEditInstitution ? (
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] overflow-hidden">
              <div className="border-b border-[var(--border)] px-5 py-3">
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                  {tr(
                    "institution.settings.controlsOwner",
                    "Institution controls",
                  )}
                </p>
              </div>

              <div className="px-5 py-4 border-b border-[var(--border)]">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  {tr("institution.settings.field.logo", "Logo")}
                </label>
                <LogoUploader logoUrl={settings.logoUrl ?? null} onSaved={handleLogoSaved} />
              </div>

              <div className="grid gap-4 p-5 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    {tr(
                      "institution.settings.field.institutionName",
                      "Institution Name",
                    )}
                  </label>
                  <input
                    type="text"
                    value={settings.name ?? ""}
                    onChange={(event) =>
                      handleChange("name", event.target.value)
                    }
                    className="glass-input w-full"
                    placeholder={tr(
                      "institution.settings.namePlaceholder",
                      "Aptely",
                    )}
                  />
                  <FieldError field="name" />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    {tr("institution.settings.field.website", "Website")}
                  </label>
                  <input
                    type="url"
                    value={settings.website ?? ""}
                    onChange={(event) =>
                      handleChange("website", event.target.value)
                    }
                    className="glass-input w-full"
                    placeholder={tr(
                      "institution.settings.websitePlaceholder",
                      "https://company.com",
                    )}
                  />
                  <FieldError field="website" />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    {tr("institution.settings.field.sector", "Sector")}
                  </label>
                  <input
                    type="text"
                    value={settings.sector ?? ""}
                    onChange={(event) =>
                      handleChange("sector", event.target.value)
                    }
                    className="glass-input w-full"
                    placeholder={tr(
                      "institution.settings.sectorPlaceholder",
                      "SaaS, Fintech, Healthcare...",
                    )}
                  />
                  <FieldError field="sector" />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    {tr("institution.settings.field.location", "Location")}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={settings.location ?? ""}
                      onChange={(event) =>
                        handleChange("location", event.target.value)
                      }
                      className="glass-input w-full pr-9"
                      placeholder={tr(
                        "institution.settings.locationPlaceholder",
                        "Paris, France",
                      )}
                    />
                    <MapPin className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                  </div>
                  <FieldError field="location" />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    {tr("institution.settings.field.teamSize", "Team Size")}
                  </label>
                  <select
                    value={settings.teamSize ?? ""}
                    onChange={(event) => {
                      const value = event.target.value;
                      handleChange(
                        "teamSize",
                        value ? Number(value) : undefined,
                      );
                    }}
                    className="glass-input w-full"
                  >
                    <option value="">
                      {tr("institution.settings.selectSize", "Select size")}
                    </option>
                    {TEAM_SIZES.map((size) => (
                      <option key={size} value={size}>
                        {size >= 1000
                          ? "1000+"
                          : `${tr("institution.settings.upTo", "up to")} ${size}`}
                      </option>
                    ))}
                  </select>
                  <FieldError field="teamSize" />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    {tr(
                      "institution.settings.field.fundingStage",
                      "Funding Stage",
                    )}
                  </label>
                  <select
                    value={settings.stage ?? ""}
                    onChange={(event) =>
                      handleChange("stage", event.target.value)
                    }
                    className="glass-input w-full"
                  >
                    <option value="">
                      {tr("institution.settings.selectStage", "Select stage")}
                    </option>
                    {STAGES.map((stage) => (
                      <option key={stage} value={stage}>
                        {stage}
                      </option>
                    ))}
                  </select>
                  <FieldError field="stage" />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    {tr(
                      "institution.settings.field.description",
                      "Description",
                    )}
                  </label>
                  <textarea
                    value={settings.description ?? ""}
                    onChange={(event) =>
                      handleChange("description", event.target.value)
                    }
                    rows={4}
                    className="glass-input w-full resize-y"
                    placeholder={tr(
                      "institution.settings.descriptionPlaceholder",
                      "Describe your institution, hiring culture, and goals.",
                    )}
                  />
                  <FieldError field="description" />
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] overflow-hidden">
              <div className="border-b border-[var(--border)] px-5 py-3">
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                  {tr(
                    "institution.settings.overviewMember",
                    "Institution overview (Member)",
                  )}
                </p>
              </div>

              <div className="grid gap-3 p-5 md:grid-cols-2">
                <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                    {tr(
                      "institution.settings.field.institution",
                      "Institution",
                    )}
                  </p>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {settings.name || "-"}
                  </p>
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                    {tr("institution.settings.field.website", "Website")}
                  </p>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {settings.website || "-"}
                  </p>
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                    {tr("institution.settings.field.sector", "Sector")}
                  </p>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {settings.sector || "-"}
                  </p>
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                    {tr("institution.settings.field.location", "Location")}
                  </p>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {settings.location || "-"}
                  </p>
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                    {tr("institution.settings.field.teamSize", "Team Size")}
                  </p>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {settings.teamSize || "-"}
                  </p>
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                    {tr("institution.settings.field.stage", "Stage")}
                  </p>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {settings.stage || "-"}
                  </p>
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 md:col-span-2">
                  <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                    {tr(
                      "institution.settings.field.description",
                      "Description",
                    )}
                  </p>
                  <p className="text-sm text-[var(--text-primary)]">
                    {settings.description || "-"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {canManageInvites && active.kind === "institution" && (
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] overflow-hidden">
              <div className="border-b border-[var(--border)] px-5 py-3 flex items-center gap-2">
                <Link2 className="w-4 h-4 text-[var(--accent)]" />
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                  {tr(
                    "institution.settings.inviteLink.title",
                    "Lien d'invitation",
                  )}
                </p>
              </div>
              <div className="p-5 space-y-3">
                <p className="text-sm text-[var(--text-secondary)]">
                  {tr(
                    "institution.settings.inviteLink.hint",
                    "Partagez ces informations avec les membres que vous souhaitez inviter.",
                  )}
                </p>

                {/* Lien d'invitation */}
                <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-deep)] p-3">
                  <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)] mb-1">
                    {tr(
                      "institution.settings.inviteLink.label",
                      "Lien d'invitation",
                    )}
                  </p>
                  <div className="flex gap-2">
                  <input
                    readOnly
                    value={`${typeof window !== "undefined" ? window.location.origin : ""}${ROUTES.join}/${displayInviteToken}`}
                    className="flex-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-deep)] text-xs text-[var(--text-muted)] font-mono truncate focus:outline-none"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const link = `${window.location.origin}${ROUTES.join}/${displayInviteToken}`;
                      void navigator.clipboard.writeText(link).then(() => {
                        setInviteCopied(true);
                        setTimeout(() => setInviteCopied(false), 2000);
                      });
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-raised)] text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent)]/40 transition-colors shrink-0"
                  >
                    {inviteCopied ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        {tr(
                          "institution.settings.inviteLink.copied",
                          "Copié !",
                        )}
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        {tr(
                          "institution.settings.inviteLink.copy",
                          "Copier le lien",
                        )}
                      </>
                    )}
                  </button>
                  </div>
                </div>

                {/* Code d'invitation */}
                <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-deep)] p-3">
                  <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)] mb-1">
                    {tr(
                      "institution.settings.inviteCode.label",
                      "Code d'invitation",
                    )}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-mono font-bold tracking-widest text-[var(--accent)]">
                      {displayInviteCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard
                          .writeText(displayInviteToken)
                          .then(() => {
                            setInviteCopied(true);
                            setTimeout(() => setInviteCopied(false), 2000);
                          });
                      }}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--bg-raised)] text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent)]/40 transition-colors shrink-0"
                    >
                      {inviteCopied ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      {tr(
                        "institution.settings.inviteLink.copy",
                        "Copier le code",
                      )}
                    </button>
                  </div>
                </div>

                {/* Regenerate button — members.invite (OWNER/ADMIN by default) */}
                {canManageInvites && displayInviteId && (
                  <button
                    type="button"
                    onClick={handleRegenerateInvite}
                    disabled={regeneratingInvite}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-orange-500/30 bg-orange-500/10 text-xs font-semibold text-orange-400 hover:bg-orange-500/20 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${regeneratingInvite ? "animate-spin" : ""}`} />
                    {regeneratingInvite
                      ? tr("institution.settings.inviteLink.regenerating", "Regenerating…")
                      : tr("institution.settings.inviteLink.regenerate", "Regenerate link")}
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === "PERSONAL" && (
        <>
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] overflow-hidden">
            <div className="border-b border-[var(--border)] px-5 py-3">
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                {tr("institution.settings.myProfile", "My profile")}
              </p>
            </div>
            <div className="grid gap-3 p-5 md:grid-cols-3">
              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 md:col-span-2">
                <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                  {tr("auth.email", "Email")}
                </p>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {user?.email || "-"}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                  {tr("institution.settings.membership", "Membership")}
                </p>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {memberStatus || "-"}
                </p>
              </div>
            </div>

            {/* Mon titre */}
            <div className="border-t border-[var(--border)] px-5 py-4 space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                {tr(
                  "institution.settings.ownerLabel.label",
                  "Mon titre dans l'équipe",
                )}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={ownerLabel}
                  onChange={(e) => setOwnerLabel(e.target.value)}
                  maxLength={80}
                  placeholder={tr(
                    "institution.settings.ownerLabel.placeholder",
                    "ex: Directeur RH, Head of People…",
                  )}
                  className="flex-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-raised)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]/40"
                />
                <button
                  type="button"
                  onClick={handleSaveOwnerLabel}
                  disabled={savingLabel}
                  className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {savingLabel ? "…" : tr("common.save", "Sauvegarder")}
                </button>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                {tr(
                  "institution.settings.ownerLabel.hint",
                  "Remplace le label par défaut de votre rôle dans la sidebar et les badges.",
                )}
              </p>
            </div>

            <div className="border-t border-[var(--border)] px-5 py-4">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    router.push(ROUTES.login);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--accent)]/30"
                >
                  <LogOut className="h-4 w-4" />
                  {tr("auth.logout", "Logout")}
                </button>

                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deletingAccount}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2 text-sm font-semibold text-red-300 transition-colors hover:bg-red-400/20 disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" />
                  {deletingAccount
                    ? tr("institution.settings.deleting", "Deleting...")
                    : tr(
                        "institution.settings.deleteAccount",
                        "Delete account",
                      )}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-[var(--bg-surface)] border border-[var(--border)] overflow-hidden">
            <div className="border-b border-[var(--border)] px-5 py-3">
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                {tr(
                  "institution.settings.personalPreferences",
                  "Personal preferences",
                )}
              </p>
            </div>

            <div className="px-5 py-4 border-b border-[var(--border)]">
              <AvatarUploader />
            </div>

            <div className="grid gap-4 p-5 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  {tr("institution.settings.language", "Language")}
                </label>
                <select
                  value={personalSettings.language}
                  onChange={(event) =>
                    setPersonalSettings((prev) => ({
                      ...prev,
                      language: event.target.value as "fr" | "en",
                    }))
                  }
                  className="glass-input w-full"
                >
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  {tr("institution.settings.timezone", "Timezone")}
                </label>
                <input
                  type="text"
                  value={personalSettings.timezone}
                  onChange={(event) =>
                    setPersonalSettings((prev) => ({
                      ...prev,
                      timezone: event.target.value,
                    }))
                  }
                  className="glass-input w-full"
                  placeholder={tr(
                    "institution.settings.timezonePlaceholder",
                    "Europe/Paris",
                  )}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  {tr(
                    "institution.settings.defaultInterviewDuration",
                    "Default interview duration",
                  )}
                </label>
                <select
                  value={personalSettings.defaultInterviewDuration}
                  onChange={(event) =>
                    setPersonalSettings((prev) => ({
                      ...prev,
                      defaultInterviewDuration: Number(event.target.value) as
                        30 | 45 | 60 | 90,
                    }))
                  }
                  className="glass-input w-full"
                >
                  <option value={30}>30 min</option>
                  <option value={45}>45 min</option>
                  <option value={60}>60 min</option>
                  <option value={90}>90 min</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  {tr(
                    "institution.settings.bufferBetweenInterviews",
                    "Buffer between interviews",
                  )}
                </label>
                <select
                  value={personalSettings.interviewBufferMinutes}
                  onChange={(event) =>
                    setPersonalSettings((prev) => ({
                      ...prev,
                      interviewBufferMinutes: Number(event.target.value) as
                        0 | 10 | 15 | 30,
                    }))
                  }
                  className="glass-input w-full"
                >
                  <option value={0}>
                    {tr("institution.settings.noBuffer", "No buffer")}
                  </option>
                  <option value={10}>10 min</option>
                  <option value={15}>15 min</option>
                  <option value={30}>30 min</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  {tr("institution.settings.workdayStart", "Workday start")}
                </label>
                <input
                  type="time"
                  value={personalSettings.workdayStart}
                  onChange={(event) =>
                    setPersonalSettings((prev) => ({
                      ...prev,
                      workdayStart: event.target.value,
                    }))
                  }
                  className="glass-input w-full"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  {tr("institution.settings.workdayEnd", "Workday end")}
                </label>
                <input
                  type="time"
                  value={personalSettings.workdayEnd}
                  onChange={(event) =>
                    setPersonalSettings((prev) => ({
                      ...prev,
                      workdayEnd: event.target.value,
                    }))
                  }
                  className="glass-input w-full"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="inline-flex items-center gap-2 text-sm text-[var(--text-primary)]">
                  <input
                    type="checkbox"
                    checked={personalSettings.emailNotifications}
                    onChange={(event) =>
                      setPersonalSettings((prev) => ({
                        ...prev,
                        emailNotifications: event.target.checked,
                      }))
                    }
                  />
                  {tr(
                    "institution.settings.emailNotifications",
                    "Email notifications",
                  )}
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-[var(--text-primary)]">
                  <input
                    type="checkbox"
                    checked={personalSettings.inAppNotifications}
                    onChange={(event) =>
                      setPersonalSettings((prev) => ({
                        ...prev,
                        inAppNotifications: event.target.checked,
                      }))
                    }
                  />
                  {tr(
                    "institution.settings.inAppNotifications",
                    "In-app notifications",
                  )}
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-[var(--text-primary)]">
                  <input
                    type="checkbox"
                    checked={personalSettings.interviewReminders}
                    onChange={(event) =>
                      setPersonalSettings((prev) => ({
                        ...prev,
                        interviewReminders: event.target.checked,
                      }))
                    }
                  />
                  {tr(
                    "institution.settings.interviewReminders",
                    "Interview reminders",
                  )}
                </label>
              </div>
            </div>
          </div>

          <div
            id="calendar-integration"
            className="bg-[var(--bg-surface)] border border-[var(--border)] overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                {tr(
                  "institution.settings.calendarIntegration",
                  "Calendar integration",
                )}
              </p>
              <CalendarRange className="h-4 w-4 text-[var(--accent)]" />
            </div>
            <div className="flex items-center justify-between p-5">
              <p className="text-sm text-[var(--text-secondary)]">
                {tr(
                  "institution.settings.calendarIntegrationDesc",
                  "Gérez la synchronisation de votre calendrier externe (Google, Outlook) depuis votre agenda.",
                )}
              </p>
              <Link
                href={ROUTES.company.calendar}
                className="ml-4 flex-shrink-0 inline-flex items-center gap-2 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent-dim)] px-4 py-2 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-colors"
              >
                <CalendarRange className="h-4 w-4" />
                {tr("institution.settings.goToCalendar", "Aller à Mon Agenda")}
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
            <div className="border-t border-[var(--border)] px-5 py-4 space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                {tr(
                  "institution.settings.calcomLink.label",
                  "Lien Cal.com (self-booking candidat)",
                )}
              </label>
              <input
                type="text"
                value={personalSettings.calcomLink ?? ""}
                onChange={(e) =>
                  setPersonalSettings((prev) => ({
                    ...prev,
                    calcomLink: e.target.value,
                  }))
                }
                className="glass-input w-full"
                placeholder={tr(
                  "institution.settings.calcomLink.placeholder",
                  "ex: mon-user/entretien-30min",
                )}
              />
              <p className="text-xs text-[var(--text-muted)]">
                {tr(
                  "institution.settings.calcomLink.hint",
                  "Format : nom-utilisateur/type-event (depuis cal.com). Les candidats pourront réserver directement un créneau.",
                )}
              </p>
            </div>
          </div>

          <div className="bg-[var(--bg-surface)] border border-[var(--border)] overflow-hidden">
            <div className="border-b border-[var(--border)] px-5 py-3">
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                {tr(
                  "institution.settings.recentActivity",
                  "Recent settings activity",
                )}
              </p>
            </div>
            <div className="space-y-2 p-5">
              {activityLog.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">
                  {tr(
                    "institution.settings.noRecentActions",
                    "No recent actions yet.",
                  )}
                </p>
              ) : (
                activityLog.map((item, index) => (
                  <div
                    key={`${item.at}-${index}`}
                    className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2"
                  >
                    <p className="text-sm text-[var(--text-primary)]">
                      {item.label}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {new Date(item.at).toLocaleString(locale === "en" ? "en-US" : "fr-FR")}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
