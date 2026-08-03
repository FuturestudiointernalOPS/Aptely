"use client";

// Team Management — matches screen_7.png
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getHRMembers,
  getJoinRequests,
  getInstitutionSettings,
  approveJoinRequest,
  refuseJoinRequest,
  removeInstitutionMember,
  updateInstitutionMemberStatus,
  transferOwnership,
  getCustomRoles,
  updateMemberRoleSpecialization,
  HRMember,
  JoinRequest,
  InstitutionSettings,
  type CustomRole,
} from "@/lib/api";
import { useAuth, useRequireInstitution } from "@/lib/auth";
import { roleRank, useWorkspace } from "@/lib/workspace";
import { apiFetch } from "@/lib/apiHelper";
import { getClientLocale, t } from "@/lib/i18n";
import Modal from "@/components/ui/Modal";
import Button from "@/components/Button";
import { FormField, Input, Select } from "@/components/ui/FormField";
import {
  ArrowLeft,
  MoreVertical,
  UserPlus,
  CheckCircle,
  Building,
  User,
  Search,
  Copy,
  UserMinus,
  ShieldCheck,
  ShieldOff,
  UserCog,
  Link2,
  Key,
} from "lucide-react";
import Link from "next/link";
import {
  ROUTES,
  API,
  institutionInvitationsApi,
} from "@/lib/routes";

// i18n label keys for built-in role_specialization values (role-change dropdown + badges).
const ROLE_LABEL_KEYS: Record<string, [string, string]> = {
  OWNER: ["perm.role.owner", "Propriétaire"],
  ADMIN: ["perm.role.admin", "Administrateur"],
  HR_LEAD: ["perm.role.hrLead", "Responsable RH"],
  STANDARD_HR: ["perm.role.standardHr", "RH"],
  HIRING_MANAGER: ["perm.role.hiringManager", "Manager recruteur"],
  RECRUITER: ["perm.role.recruiter", "Recruteur"],
  MEMBER: ["perm.role.member", "Membre"],
};

const STATUS_STYLE: Record<string, string> = {
  OWNER:
    "bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20",
  ADMIN: "bg-amber-400/10 text-amber-400 border border-amber-400/20",
  ACTIVE: "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20",
  PENDING: "bg-amber-400/10 text-amber-400 border border-amber-400/20",
  SUSPENDED: "bg-red-400/10 text-red-400 border border-red-400/20",
};

function formatDate(iso: string, locale: string) {
  const dateLocale = locale === "en" ? "en-US" : "fr-FR";
  return new Date(iso).toLocaleDateString(dateLocale, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function getStatusLabel(
  status: string,
  translate: (k: string, f: string) => string,
) {
  switch (status) {
    case "OWNER":
      return translate("institution.hr.status.owner", "Owner");
    case "ADMIN":
      return translate("institution.hr.status.admin", "Admin");
    case "ACTIVE":
      return translate("institution.hr.status.member", "Member");
    case "PENDING":
      return translate("institution.hr.status.pending", "Pending");
    case "SUSPENDED":
      return translate("institution.hr.status.suspended", "Suspended");
    default:
      return status;
  }
}

export default function TeamManagementPage() {
  useRequireInstitution();
  const { user } = useAuth();
  const { hasPermission } = useWorkspace();
  const router = useRouter();
  const locale = getClientLocale();
  const translate = (key: string, fallback: string) => t(locale, key, fallback);

  const [members, setMembers] = useState<HRMember[]>([]);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [institution, setInstitution] = useState<InstitutionSettings | null>(
    null,
  );
  const [currentMembership, setCurrentMembership] = useState<
    "OWNER" | "ADMIN" | "ACTIVE" | null
  >(null);
  const [tab, setTab] = useState<"team" | "requests">("team");
  const [loading, setLoading] = useState(true);
  const [memberQuery, setMemberQuery] = useState("");
  const [menuUserId, setMenuUserId] = useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [requestActionUserId, setRequestActionUserId] = useState<string | null>(
    null,
  );
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("MEMBER");
  const [inviteJobPositionId, setInviteJobPositionId] = useState<string>("");
  const [jobPositions, setJobPositions] = useState<
    Array<{ id: string; title: string }>
  >([]);
  const [transferTarget, setTransferTarget] = useState<HRMember | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [roleTarget, setRoleTarget] = useState<HRMember | null>(null);
  const [selectedRoleSpec, setSelectedRoleSpec] = useState<string>("MEMBER");
  const [selectedCustomRoleId, setSelectedCustomRoleId] = useState<string>("");
  const [assigningRole, setAssigningRole] = useState(false);

  const isOwner = currentMembership === "OWNER";
  const isManager =
    currentMembership === "OWNER" || currentMembership === "ADMIN";

  // Actor authority rank — drives which members/roles the current user can manage.
  const selfMember = useMemo(
    () =>
      members.find(
        (m) => m.email.toLowerCase() === (user?.email || "").toLowerCase(),
      ),
    [members, user?.email],
  );
  // Self rank — CUSTOM actor uses their custom role's rank.
  const customRoleRank = (id: string | null | undefined): number | null => {
    if (!id) return null;
    const r = customRoles.find((c) => c.id === id);
    return r ? r.rank : null;
  };
  const selfSpec =
    selfMember?.roleSpecialization ?? currentMembership ?? "MEMBER";
  const actorRank =
    selfSpec === "CUSTOM"
      ? (customRoleRank(selfMember?.customRoleId) ?? roleRank("CUSTOM"))
      : roleRank(selfSpec);
  // Built-in roles the actor can assign (rank < actor's rank).
  const assignableRoles = useMemo(
    () =>
      [
        "MEMBER",
        "RECRUITER",
        "HIRING_MANAGER",
        "STANDARD_HR",
        "HR_LEAD",
        "ADMIN",
      ].filter((r) => roleRank(r) < actorRank),
    [actorRank],
  );
  // Custom roles the actor can assign (their rank < actor's rank).
  const assignableCustomRoles = useMemo(
    () => customRoles.filter((r) => r.rank < actorRank),
    [customRoles, actorRank],
  );
  const canAssignCustom = assignableCustomRoles.length > 0;
  // Target rank (CUSTOM resolves via customRoles list).
  const targetRank = (m: HRMember): number => {
    if (m.roleSpecialization === "CUSTOM") {
      return customRoleRank(m.customRoleId) ?? roleRank("CUSTOM");
    }
    return roleRank(m.roleSpecialization ?? m.membershipStatus);
  };
  // Can the actor manage a given target (strictly higher rank, not self)?
  const canManageTarget = (m: HRMember) =>
    m.email.toLowerCase() !== (user?.email || "").toLowerCase() &&
    actorRank > targetRank(m);
  // Permission-aware action gates — items only show if BOTH rank AND permission allow.
  const canChangeRoleOf = (m: HRMember) =>
    canManageTarget(m) && hasPermission("members.roles");
  const canChangeStatusOf = (m: HRMember) =>
    canManageTarget(m) && hasPermission("members.remove");
  const canRemoveOf = (m: HRMember) =>
    canManageTarget(m) && hasPermission("members.remove");
  // Role-aware label for a member's badge (prefers role_specialization; falls back to legacy status).
  const memberRoleLabel = (m: HRMember): string => {
    if (m.roleCustomLabel) return m.roleCustomLabel; // custom label for ANY role (incl. OWNER)
    const key = m.roleSpecialization && ROLE_LABEL_KEYS[m.roleSpecialization];
    if (key) return translate(key[0], key[1]);
    return getStatusLabel(m.membershipStatus, translate);
  };

  const teamMembers = useMemo(
    () =>
      members.filter(
        (m) => m.email.toLowerCase() !== (user?.email || "").toLowerCase(),
      ),
    [members, user?.email],
  );

  const filteredMembers = useMemo(() => {
    const query = memberQuery.trim().toLowerCase();
    if (!query) return teamMembers;
    return teamMembers.filter((member) => {
      const email = member.email.toLowerCase();
      const fullName = String(member.fullName || "").toLowerCase();
      return email.includes(query) || fullName.includes(query);
    });
  }, [memberQuery, teamMembers]);

  const buildInvitePayload = (email?: string) => ({
    email: email || undefined,
    // MEMBER is the default base role. Treat it as no-scope so the default member
    // invitation reuses the canonical institution token — the same code/link shown in
    // Settings and returned by the "copy code/link" buttons. Only elevated roles
    // (ADMIN, STANDARD_HR, …) mint a distinct role-scoped token. Backend defaults a
    // canonical (no-role) join to MEMBER, so this stays behaviour-equivalent.
    roleSpecialization:
      inviteRole && inviteRole !== "MEMBER" ? inviteRole : undefined,
    jobPositionId: inviteJobPositionId || undefined,
  });

  const handleInviteMember = async (targetEmail?: string) => {
    try {
      const res = await apiFetch(institutionInvitationsApi, "HR", {
        method: "POST",
        body: JSON.stringify(buildInvitePayload(targetEmail)),
      });
      if (!res) throw new Error("no response");
      const inviteUrl = res.inviteUrl || res.data?.inviteUrl;
      setFeedback({
        type: "success",
        text: targetEmail
          ? translate("institution.hr.inviteEmailSent", "Invitation sent!")
          : translate(
              "institution.hr.inviteLinkCopied",
              "Invitation link copied.",
            ),
      });
      if (!targetEmail && inviteUrl) {
        await navigator.clipboard.writeText(inviteUrl).catch(() => {});
      }
    } catch {
      setFeedback({
        type: "error",
        text: translate(
          "institution.hr.inviteFailed",
          "Failed to create invite link.",
        ),
      });
    }
  };

  // Canonical invite: GET existing first, only POST if none exists.
  // This ensures HR "copy link/code" always matches Settings.
  const getOrCreateCanonicalInvite = async (): Promise<{ token?: string; inviteUrl?: string } | null> => {
    try {
      const existing = await apiFetch(institutionInvitationsApi, "HR", {
        method: "GET",
      });
      if (Array.isArray(existing) && existing.length > 0) {
        const first = existing[0] as any;
        const token = String(first.token || "");
        return {
          token,
          inviteUrl: first.inviteUrl || `https://aptely.com/join/${token}`,
        };
      }
    } catch {
      /* fall through to POST */
    }
    // No existing invite — create one
    try {
      const created = await apiFetch(institutionInvitationsApi, "HR", {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (!created) return null;
      return {
        token: (created as any).token || (created as any).data?.token,
        inviteUrl: (created as any).inviteUrl || (created as any).data?.inviteUrl,
      };
    } catch {
      return null;
    }
  };

  const handleCopyInviteLink = async () => {
    try {
      const res = await getOrCreateCanonicalInvite();
      const inviteUrl = res?.inviteUrl;
      if (inviteUrl) {
        await navigator.clipboard.writeText(inviteUrl);
        setFeedback({
          type: "success",
          text: translate(
            "institution.hr.inviteLinkCopied",
            "Invitation link copied.",
          ),
        });
      }
    } catch {
      setFeedback({
        type: "error",
        text: translate(
          "institution.hr.inviteLinkCopyFailed",
          "Unable to copy invitation link.",
        ),
      });
    }
  };

  const handleCopyInviteCode = async () => {
    try {
      const res = await getOrCreateCanonicalInvite();
      const code = res?.token;
      if (code) {
        await navigator.clipboard.writeText(code);
        setFeedback({
          type: "success",
          text: translate(
            "institution.hr.inviteCodeCopied",
            "Code d'invitation copié.",
          ),
        });
      }
    } catch {
      setFeedback({
        type: "error",
        text: translate(
          "institution.hr.inviteCodeCopyFailed",
          "Unable to copy invitation code.",
        ),
      });
    }
  };

  const handleCopyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      setFeedback({
        type: "success",
        text: translate("institution.hr.emailCopied", "Email copied."),
      });
    } catch {
      setFeedback({
        type: "error",
        text: translate("institution.hr.copyFailed", "Unable to copy email."),
      });
    } finally {
      setMenuUserId(null);
    }
  };

  const handleRemoveMember = async (member: HRMember) => {
    if (!isManager) return;

    if (member.email.toLowerCase() === (user?.email || "").toLowerCase()) {
      setFeedback({
        type: "error",
        text: translate(
          "institution.hr.cannotRemoveSelf",
          "Use leave flow to remove yourself.",
        ),
      });
      return;
    }

    if (member.membershipStatus === "OWNER") {
      setFeedback({
        type: "error",
        text: translate(
          "institution.hr.cannotRemoveOwner",
          "Owners must be demoted or transferred first.",
        ),
      });
      return;
    }

    if (
      currentMembership === "ADMIN" &&
      member.membershipStatus !== "ACTIVE" &&
      member.membershipStatus !== "SUSPENDED"
    ) {
      setFeedback({
        type: "error",
        text: translate(
          "institution.hr.adminRemoveRestriction",
          "Admins can only remove active or suspended members.",
        ),
      });
      return;
    }

    setRemovingUserId(member.userId);
    const ok = await removeInstitutionMember(member.userId);
    if (!ok) {
      setFeedback({
        type: "error",
        text: translate(
          "institution.hr.removeFailed",
          "Unable to remove this member.",
        ),
      });
      setRemovingUserId(null);
      return;
    }

    setMembers((prev) => prev.filter((m) => m.userId !== member.userId));
    setFeedback({
      type: "success",
      text: translate(
        "institution.hr.memberRemoved",
        "Member removed successfully.",
      ),
    });
    setRemovingUserId(null);
    setMenuUserId(null);
  };

  const handleUpdateMemberStatus = async (
    member: HRMember,
    status: "ACTIVE" | "SUSPENDED",
  ) => {
    if (!isManager) return;

    if (member.membershipStatus === "OWNER") {
      setFeedback({
        type: "error",
        text: translate(
          "institution.hr.ownerStatusProtected",
          "Owner status cannot be suspended from this action.",
        ),
      });
      return;
    }

    if (currentMembership === "ADMIN" && member.membershipStatus === "ADMIN") {
      setFeedback({
        type: "error",
        text: translate(
          "institution.hr.adminStatusRestriction",
          "Admins cannot update another admin status.",
        ),
      });
      return;
    }

    setUpdatingUserId(member.userId);
    const ok = await updateInstitutionMemberStatus(member.userId, status);
    if (!ok) {
      setFeedback({
        type: "error",
        text: translate(
          "institution.hr.statusUpdateFailed",
          "Unable to update member status.",
        ),
      });
      setUpdatingUserId(null);
      return;
    }

    setMembers((prev) =>
      prev.map((m) =>
        m.userId === member.userId ? { ...m, membershipStatus: status } : m,
      ),
    );
    setFeedback({
      type: "success",
      text:
        status === "SUSPENDED"
          ? translate("institution.hr.memberSuspended", "Member suspended.")
          : translate("institution.hr.memberActivated", "Member activated."),
    });
    setUpdatingUserId(null);
    setMenuUserId(null);
  };

  const handleTransferOwnership = async () => {
    if (!isOwner || !transferTarget) return;
    setTransferring(true);
    const ok = await transferOwnership(transferTarget.userId);
    if (!ok) {
      setFeedback({
        type: "error",
        text: translate("team.transfer.error", "Unable to transfer ownership."),
      });
      setTransferring(false);
      return;
    }
    // Ownership swapped: target is OWNER, current user is now ADMIN. Reload so the
    // sidebar, permissions and workspace context reflect the new role everywhere.
    window.location.reload();
  };

  const handleAssignRole = async () => {
    if (!roleTarget) return;
    if (selectedRoleSpec === "CUSTOM" && !selectedCustomRoleId) {
      setFeedback({
        type: "error",
        text: translate(
          "team.role.pickCustomError",
          "Sélectionnez un rôle personnalisé.",
        ),
      });
      return;
    }
    setAssigningRole(true);
    const ok = await updateMemberRoleSpecialization(
      roleTarget.userId,
      selectedRoleSpec,
      selectedRoleSpec === "CUSTOM" ? selectedCustomRoleId : undefined,
    );
    if (!ok) {
      setFeedback({
        type: "error",
        text: translate("team.role.failed", "Échec du changement de rôle."),
      });
      setAssigningRole(false);
      return;
    }
    // status follows the role: ADMIN→ADMIN, everything else→ACTIVE.
    const newStatus = (
      selectedRoleSpec === "ADMIN" ? "ADMIN" : "ACTIVE"
    ) as HRMember["membershipStatus"];
    const customLabel =
      selectedRoleSpec === "CUSTOM"
        ? (customRoles.find((c) => c.id === selectedCustomRoleId)?.name ?? null)
        : null;
    setMembers((prev) =>
      prev.map((m) =>
        m.userId === roleTarget.userId
          ? {
              ...m,
              membershipStatus: newStatus,
              roleSpecialization: selectedRoleSpec,
              customRoleId:
                selectedRoleSpec === "CUSTOM" ? selectedCustomRoleId : null,
              roleCustomLabel: customLabel,
            }
          : m,
      ),
    );
    setFeedback({
      type: "success",
      text: translate("team.role.updated", "Rôle mis à jour."),
    });
    setRoleTarget(null);
    setAssigningRole(false);
  };

  const handleAddMember = () => {
    if (!isManager) {
      setFeedback({
        type: "error",
        text: translate(
          "institution.hr.managerOnly",
          "Only owners or admins can manage invitations.",
        ),
      });
      return;
    }

    setIsInviteModalOpen(true);
    setInviteEmail("");
  };

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!menuUserId) return;
      const target = event.target as Element;
      const container = target.closest("[data-menu-container]");
      if (
        container &&
        container.getAttribute("data-menu-container") === menuUserId
      )
        return;
      setMenuUserId(null);
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [menuUserId]);

  useEffect(() => {
    const load = async () => {
      try {
        const [m, inst, jpRes, custom] = await Promise.all([
          getHRMembers(),
          getInstitutionSettings(),
          apiFetch(API.jobPositions, "HR", { method: "GET" }).catch(() => []),
          getCustomRoles().catch(() => [] as CustomRole[]),
        ]);
        if (Array.isArray(jpRes)) setJobPositions(jpRes);
        setCustomRoles(custom);

        // If institution name is "Unknown", user is PENDING approval
        if (inst.name === "Unknown") {
          router.push(ROUTES.company.settings.onboarding);
          return;
        }

        setMembers(m);
        setInstitution(inst?.institutionId ? inst : null);

        const selfMember = m.find(
          (member) =>
            member.email.toLowerCase() === (user?.email || "").toLowerCase(),
        );
        const status = selfMember?.membershipStatus;
        if (status === "OWNER" || status === "ADMIN" || status === "ACTIVE") {
          setCurrentMembership(status);
        } else {
          setCurrentMembership(null);
        }

        // OWNER and ADMIN can manage join requests.
        if (status === "OWNER" || status === "ADMIN") {
          const r = await getJoinRequests();
          setRequests(r);
        } else {
          setRequests([]);
        }

        setLoading(false);
      } catch (err) {
        console.error("[TEAM MANAGEMENT] Error loading data:", err);
        setFeedback({
          type: "error",
          text: translate(
            "institution.hr.loadFailed",
            "Unable to load team management data.",
          ),
        });
        setLoading(false);
      }
    };
    load();
  }, [router, user?.email]);

  useEffect(() => {
    if (!feedback) return;
    const timeout = window.setTimeout(() => setFeedback(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  const handleApprove = async (userId: string) => {
    setRequestActionUserId(userId);
    const ok = await approveJoinRequest(userId);
    if (ok) {
      setRequests((prev) => prev.filter((r) => r.userId !== userId));
      // Opt-in: fetch fresh members to see the person who just joined
      getHRMembers().then(setMembers);
      setFeedback({
        type: "success",
        text: translate(
          "institution.hr.requestApproved",
          "Join request approved.",
        ),
      });
    } else {
      setFeedback({
        type: "error",
        text: translate(
          "institution.hr.requestApproveFailed",
          "Unable to approve this request.",
        ),
      });
    }
    setRequestActionUserId(null);
  };

  const handleRefuse = async (userId: string) => {
    setRequestActionUserId(userId);
    const ok = await refuseJoinRequest(userId);
    if (ok) {
      setRequests((prev) => prev.filter((r) => r.userId !== userId));
      setFeedback({
        type: "success",
        text: translate(
          "institution.hr.requestRefused",
          "Join request refused.",
        ),
      });
    } else {
      setFeedback({
        type: "error",
        text: translate(
          "institution.hr.requestRefuseFailed",
          "Unable to refuse this request.",
        ),
      });
    }
    setRequestActionUserId(null);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in-up">
        <Link
          href={ROUTES.company.dashboard}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-[var(--text-primary)] font-bold text-xl">
          {translate("institution.hr.title", "Team Management")}
        </h1>
        <div className="flex items-center gap-3">
          <Link
            href={ROUTES.company.settings.permissions}
            className="text-[var(--text-secondary)] font-semibold text-sm hover:text-[var(--text-primary)]"
          >
            {translate("institution.hr.permissions", "Permissions")}
          </Link>
          <button
            onClick={handleAddMember}
            className="text-[var(--accent)] font-semibold text-sm hover:underline"
          >
            {translate("institution.hr.addMembers", "Add members")}
          </button>
        </div>
      </div>

      {/* Institution Card */}
      {loading ? (
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-5  flex items-center gap-4 animate-pulse">
          <div className="w-14 h-14 rounded-xl bg-[var(--bg-surface)]" />
          <div className="space-y-2 flex-1">
            <div className="h-4 bg-[var(--bg-surface)] rounded w-1/3" />
            <div className="h-3 bg-[var(--bg-surface)] rounded w-1/4" />
          </div>
        </div>
      ) : institution ? (
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 animate-fade-in-up delay-100">
          <div className="w-14 h-14 rounded-xl bg-[var(--bg-deep)] flex items-center justify-center text-[var(--text-primary)] text-2xl font-bold uppercase">
            {institution.name.charAt(0)}
          </div>
          <div>
            <p className="text-[var(--text-primary)] font-bold text-lg">
              {institution.name}
            </p>
            <p className="text-[var(--text-muted)] text-sm">
              {institution.sector ||
                translate("institution.hr.institution", "Institution")}
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-[var(--accent)]/10 rounded-2xl p-5 border border-[var(--accent)]/20 flex items-start gap-4 animate-fade-in-up delay-100">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] flex-shrink-0">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[var(--text-primary)] font-bold">
              {translate(
                "institution.hr.noInstitution",
                "No institution found",
              )}
            </p>
            <p className="text-[var(--text-secondary)] text-sm mt-1 mb-3">
              {translate(
                "institution.hr.noInstitutionHint",
                "You are not part of any institution yet. You must create or join one to manage teams.",
              )}
            </p>
            <Link
              href={ROUTES.company.settings.teams}
              className="text-[var(--accent)] font-bold text-sm hover:underline"
            >
              {translate("institution.hr.goTeams", "Go to teams →")}
            </Link>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-[var(--border)] animate-fade-in-up delay-200 overflow-x-auto">
        <button
          onClick={() => setTab("team")}
          className={`pb-3 px-1 mr-4 sm:mr-8 text-sm font-semibold border-b-2 transition-all whitespace-nowrap flex-shrink-0 ${
            tab === "team"
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          }`}
        >
          {translate("institution.hr.currentTeam", "Current team")} (
          {teamMembers.length})
        </button>
        {isManager && (
          <button
            onClick={() => setTab("requests")}
            className={`pb-3 px-1 mr-4 sm:mr-8 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap flex-shrink-0 ${
              tab === "requests"
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {translate("institution.hr.joinRequests", "Join requests")}
            {requests.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-[var(--accent)] text-white text-xs font-bold flex items-center justify-center">
                {requests.length}
              </span>
            )}
          </button>
        )}
      </div>

      {feedback && (
        <div
          className={`rounded-xl p-3 text-sm font-semibold ${
            feedback.type === "success"
              ? "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20"
              : "bg-red-400/10 text-red-400 border border-red-400/20"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-[var(--bg-surface)] border border-[var(--border)] p-5  animate-pulse flex gap-3"
            >
              <div className="w-10 h-10 rounded-full bg-[var(--bg-surface)]" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-[var(--bg-surface)] rounded w-1/2" />
                <div className="h-3 bg-[var(--bg-surface)] rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : tab === "team" ? (
        /* Team Members List */
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={memberQuery}
              onChange={(event) => setMemberQuery(event.target.value)}
              placeholder={translate(
                "institution.hr.searchPlaceholder",
                "Search a team member",
              )}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]/40"
            />
          </div>

          {filteredMembers.length === 0 ? (
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-5 text-center text-[var(--text-muted)] text-sm">
              {translate(
                "institution.hr.noMemberResults",
                "No member matches your search.",
              )}
            </div>
          ) : (
            <ul className="space-y-3">
              {filteredMembers.map((m, i) => (
                <li
                  key={m.userId}
                  className={`bg-[var(--bg-surface)] border border-[var(--border)] p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 animate-fade-in-up relative ${menuUserId === m.userId ? "z-20" : ""}`}
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="w-10 h-10 rounded-full bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-muted)] flex-shrink-0">
                    <User className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[var(--text-primary)] font-semibold text-sm truncate">
                        {m.fullName || m.email}
                      </p>
                      <span
                        className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                          STATUS_STYLE[m.membershipStatus] ??
                          "bg-[var(--bg-surface)] text-[var(--text-muted)]"
                        }`}
                      >
                        {memberRoleLabel(m)}
                      </span>
                    </div>
                    <p className="text-[var(--text-muted)] text-xs mt-0.5">
                      <span className="mr-2">{m.email}</span>
                      {translate("institution.hr.joinedOn", "Joined ")}
                      {formatDate(m.createdAt, locale)}
                    </p>
                  </div>

                  <div className="relative" data-menu-container={m.userId}>
                    <button
                      type="button"
                      onClick={() =>
                        setMenuUserId((prev) =>
                          prev === m.userId ? null : m.userId,
                        )
                      }
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-surface)]"
                      aria-label={translate(
                        "institution.hr.memberActions",
                        "Member actions",
                      )}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {menuUserId === m.userId && (
                      <div className="absolute right-0 top-9 z-50 min-w-52 max-w-[calc(100vw-2rem)] rounded-xl border border-[var(--border)] bg-elevated p-1 shadow-xl">
                        <button
                          type="button"
                          onClick={() => void handleCopyEmail(m.email)}
                          className="w-full px-3 py-2 text-left text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] rounded-lg inline-flex items-center gap-2"
                        >
                          <Copy className="w-4 h-4" />
                          {translate("institution.hr.copyEmail", "Copy email")}
                        </button>

                        {/* Role change — covers promote/demote, capped by rank + members.roles */}
                        {canChangeRoleOf(m) && (
                          <button
                            type="button"
                            onClick={() => {
                              setRoleTarget(m);
                              setSelectedRoleSpec(
                                m.roleSpecialization &&
                                  m.roleSpecialization !== "OWNER"
                                  ? m.roleSpecialization
                                  : "MEMBER",
                              );
                              setSelectedCustomRoleId(m.customRoleId || "");
                              setMenuUserId(null);
                            }}
                            className="w-full px-3 py-2 text-left text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] rounded-lg inline-flex items-center gap-2"
                          >
                            <UserCog className="w-4 h-4" />
                            {translate("team.role.change", "Changer de rôle")}
                          </button>
                        )}

                        {/* Transfer ownership — OWNER only, to an active member */}
                        {isOwner &&
                          m.email.toLowerCase() !==
                            (user?.email || "").toLowerCase() &&
                          (m.membershipStatus === "ACTIVE" ||
                            m.membershipStatus === "ADMIN") && (
                            <button
                              type="button"
                              onClick={() => {
                                setTransferTarget(m);
                                setMenuUserId(null);
                              }}
                              disabled={updatingUserId === m.userId}
                              className="w-full px-3 py-2 text-left text-sm text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded-lg inline-flex items-center gap-2 disabled:opacity-60"
                            >
                              <ShieldCheck className="w-4 h-4" />
                              {translate(
                                "team.transfer.action",
                                "Transfer ownership",
                              )}
                            </button>
                          )}

                        {canChangeStatusOf(m) &&
                          m.membershipStatus === "ACTIVE" && (
                            <button
                              type="button"
                              onClick={() =>
                                void handleUpdateMemberStatus(m, "SUSPENDED")
                              }
                              disabled={updatingUserId === m.userId}
                              className="w-full px-3 py-2 text-left text-sm text-red-300 hover:text-red-200 hover:bg-red-400/10 rounded-lg inline-flex items-center gap-2 disabled:opacity-60"
                            >
                              <ShieldOff className="w-4 h-4" />
                              {translate(
                                "institution.hr.suspendMember",
                                "Suspend member",
                              )}
                            </button>
                          )}

                        {canChangeStatusOf(m) &&
                          m.membershipStatus === "SUSPENDED" && (
                            <button
                              type="button"
                              onClick={() =>
                                void handleUpdateMemberStatus(m, "ACTIVE")
                              }
                              disabled={updatingUserId === m.userId}
                              className="w-full px-3 py-2 text-left text-sm text-emerald-300 hover:text-emerald-200 hover:bg-emerald-400/10 rounded-lg inline-flex items-center gap-2 disabled:opacity-60"
                            >
                              <ShieldCheck className="w-4 h-4" />
                              {translate(
                                "institution.hr.activateMember",
                                "Activate member",
                              )}
                            </button>
                          )}

                        {canRemoveOf(m) && (
                          <button
                            type="button"
                            onClick={() => void handleRemoveMember(m)}
                            disabled={
                              removingUserId === m.userId ||
                              updatingUserId === m.userId
                            }
                            className="w-full px-3 py-2 text-left text-sm text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg inline-flex items-center gap-2 disabled:opacity-60"
                          >
                            <UserMinus className="w-4 h-4" />
                            {removingUserId === m.userId
                              ? translate(
                                  "institution.hr.removing",
                                  "Removing...",
                                )
                              : translate(
                                  "institution.hr.removeMember",
                                  "Remove member",
                                )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        /* Join Requests */
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[var(--text-muted)] text-xs font-bold uppercase tracking-widest">
                {translate("institution.hr.joinRequests", "Join requests")}
              </p>
              <span className="w-6 h-6 rounded-full bg-[var(--accent)] text-white text-xs font-bold flex items-center justify-center">
                {requests.length}
              </span>
            </div>
            {requests.length === 0 ? (
              <div className="text-center py-10 text-[var(--text-muted)]">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">
                  {translate("institution.hr.noPending", "No pending requests")}
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {requests.map((req, i) => {
                  const time = new Date(req.requestedAt);
                  const timeStr = `${time.getHours().toString().padStart(2, "0")}:${time.getMinutes().toString().padStart(2, "0")}`;
                  const label = translate(
                    "institution.hr.requestedAt",
                    "Requested at {{time}}",
                  ).replace("{{time}}", timeStr);
                  return (
                    <li
                      key={req.requestId}
                      className="bg-[var(--bg-surface)] border border-[var(--border)] p-5  animate-fade-in-up"
                      style={{ animationDelay: `${i * 80}ms` }}
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-muted)] text-sm">
                          <UserPlus className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-[var(--text-primary)] font-semibold text-sm">
                            {req.email}
                          </p>
                          <p className="text-[var(--text-muted)] text-xs">
                            {label}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => handleApprove(req.userId)}
                          disabled={requestActionUserId === req.userId}
                          className="py-2.5 bg-[var(--accent)] text-white font-semibold text-sm rounded-xl hover:bg-[var(--accent)]-soft transition-all"
                        >
                          {requestActionUserId === req.userId
                            ? translate(
                                "institution.hr.approving",
                                "Approving...",
                              )
                            : translate("institution.hr.approve", "Approve")}
                        </button>
                        <button
                          onClick={() => handleRefuse(req.userId)}
                          disabled={requestActionUserId === req.userId}
                          className="py-2.5 border border-[var(--border)] text-[var(--text-secondary)] font-semibold text-sm rounded-xl hover:bg-[var(--bg-surface)] transition-colors disabled:opacity-60"
                        >
                          {requestActionUserId === req.userId
                            ? translate(
                                "institution.hr.refusing",
                                "Refusing...",
                              )
                            : translate("institution.hr.refuse", "Refuse")}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {transferTarget && (
        <Modal
          open
          onClose={() => {
            if (!transferring) setTransferTarget(null);
          }}
          title={translate("team.transfer.title", "Transfer ownership")}
          description={t(
            locale,
            "team.transfer.confirm",
            "{{name}} will become the OWNER and you will become an ADMIN. This action cannot be undone by you afterwards.",
            { name: transferTarget.fullName || transferTarget.email },
          )}
          footer={
            <div className="flex flex-wrap gap-2 justify-end">
              <Button
                variant="secondary"
                onClick={() => setTransferTarget(null)}
                disabled={transferring}
              >
                {translate("common.cancel", "Cancel")}
              </Button>
              <Button
                variant="danger"
                onClick={() => void handleTransferOwnership()}
                disabled={transferring}
              >
                {transferring
                  ? translate("team.transfer.transferring", "Transferring...")
                  : translate("team.transfer.action", "Transfer ownership")}
              </Button>
            </div>
          }
        >
          <p className="text-sm text-[var(--text-secondary)]">
            {translate(
              "team.transfer.body",
              "Only the new owner will be able to transfer ownership back or manage owners.",
            )}
          </p>
        </Modal>
      )}

      {roleTarget && (
        <Modal
          open
          onClose={() => {
            if (!assigningRole) setRoleTarget(null);
          }}
          title={translate("team.role.title", "Changer de rôle")}
          description={t(
            locale,
            "team.role.desc",
            "Choisissez le rôle de {{name}}.",
            { name: roleTarget.fullName || roleTarget.email },
          )}
          footer={
            <div className="flex flex-wrap gap-2 justify-end">
              <Button
                variant="secondary"
                onClick={() => setRoleTarget(null)}
                disabled={assigningRole}
              >
                {translate("common.cancel", "Cancel")}
              </Button>
              <Button
                variant="primary"
                onClick={() => void handleAssignRole()}
                disabled={assigningRole}
              >
                {assigningRole
                  ? translate("team.role.saving", "Mise à jour...")
                  : translate("team.role.save", "Mettre à jour")}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <FormField label={translate("team.role.roleLabel", "Rôle")}>
              <Select
                value={selectedRoleSpec}
                onChange={(e) => setSelectedRoleSpec(e.target.value)}
              >
                {assignableRoles.map((r) => (
                  <option key={r} value={r}>
                    {translate(
                      ROLE_LABEL_KEYS[r]?.[0] ?? r,
                      ROLE_LABEL_KEYS[r]?.[1] ?? r,
                    )}
                  </option>
                ))}
                {canAssignCustom && (
                  <option value="CUSTOM">
                    {translate(
                      "team.role.customGroup",
                      "— Rôle personnalisé —",
                    )}
                  </option>
                )}
              </Select>
            </FormField>

            {selectedRoleSpec === "CUSTOM" && (
              <FormField
                label={translate("team.role.customLabel", "Rôle personnalisé")}
              >
                <Select
                  value={selectedCustomRoleId}
                  onChange={(e) => setSelectedCustomRoleId(e.target.value)}
                >
                  <option value="">
                    {translate("team.role.pickCustom", "— Sélectionner —")}
                  </option>
                  {assignableCustomRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </Select>
              </FormField>
            )}
          </div>
        </Modal>
      )}

      {isInviteModalOpen && (
        <Modal
          open
          onClose={() => setIsInviteModalOpen(false)}
          title={translate("institution.hr.addMembers", "Add members")}
          description={translate(
            "institution.hr.addMemberHint",
            "Invite a new HR member by email, then approve the join request if needed.",
          )}
          footer={
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleInviteMember(inviteEmail)}
              >
                {translate(
                  "institution.hr.sendInviteEmail",
                  "Send invite email",
                )}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void handleCopyInviteLink()}
              >
                {translate(
                  "institution.hr.copyInviteLink",
                  "Copier le lien d'invitation",
                )}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void handleCopyInviteCode()}
              >
                {translate(
                  "institution.hr.copyInviteCode",
                  "Copier le code d'invitation",
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTab("requests");
                  setIsInviteModalOpen(false);
                }}
              >
                {translate(
                  "institution.hr.viewJoinRequests",
                  "View join requests",
                )}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <FormField label={translate("institution.hr.inviteRole", "Rôle")}>
              <Select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
              >
                <option value="MEMBER">
                  {translate(
                    "institution.hr.role.member",
                    "Employé (accès de base)",
                  )}
                </option>
                <option value="RECRUITER">
                  {translate("institution.hr.role.recruiter", "Recruteur")}
                </option>
                <option value="HIRING_MANAGER">
                  {translate(
                    "institution.hr.role.hiringManager",
                    "Hiring Manager",
                  )}
                </option>
                <option value="STANDARD_HR">
                  {translate("institution.hr.role.standardHr", "RH Standard")}
                </option>
                <option value="HR_LEAD">
                  {translate("institution.hr.role.hrLead", "Responsable RH")}
                </option>
                <option value="ADMIN">
                  {translate("institution.hr.role.admin", "Administrateur")}
                </option>
              </Select>
            </FormField>

            {jobPositions.length > 0 && (
              <FormField
                label={translate(
                  "institution.hr.inviteJobPosition",
                  "Poste (optionnel)",
                )}
              >
                <Select
                  value={inviteJobPositionId}
                  onChange={(e) => setInviteJobPositionId(e.target.value)}
                >
                  <option value="">
                    {translate(
                      "institution.hr.noJobPosition",
                      "— Aucun poste spécifique —",
                    )}
                  </option>
                  {jobPositions.map((jp) => (
                    <option key={jp.id} value={jp.id}>
                      {jp.title}
                    </option>
                  ))}
                </Select>
              </FormField>
            )}

            <FormField label={translate("institution.hr.inviteEmail", "Email")}>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder={translate(
                  "institution.hr.inviteEmailPlaceholder",
                  "name@company.com",
                )}
              />
            </FormField>
          </div>
        </Modal>
      )}

      {/* Invite CTA */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={handleAddMember}
          className="w-full flex items-center justify-center gap-2 py-4 bg-[var(--accent)] hover:bg-[var(--accent)]-soft text-white font-bold rounded-2xl transition-all shadow-none animate-fade-in-up"
        >
          <UserPlus className="w-5 h-5" />
          {translate("institution.hr.inviteMember", "Inviter un membre")}
        </button>

        <button
          onClick={() => void handleCopyInviteLink()}
          className="w-full flex items-center justify-center gap-2 py-4 bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] font-bold rounded-2xl hover:bg-[var(--bg-surface)]-hover transition-all animate-fade-in-up"
        >
          <Link2 className="w-5 h-5" />
          {translate(
            "institution.hr.copyInviteLink",
            "Copier le lien d'invitation",
          )}
        </button>

        <button
          onClick={() => void handleCopyInviteCode()}
          className="w-full flex items-center justify-center gap-2 py-4 bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] font-bold rounded-2xl hover:bg-[var(--bg-surface)]-hover transition-all animate-fade-in-up"
        >
          <Key className="w-5 h-5" />
          {translate(
            "institution.hr.copyInviteCode",
            "Copier le code d'invitation",
          )}
        </button>
      </div>
    </div>
  );
}
