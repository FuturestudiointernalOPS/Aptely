import { apiFetch, isApiSuccess } from "./apiHelper";
import {
  API,
  mkApiPath,
  withParams,
  absoluteUrl,
  applyPath,
  institutionMembersApi,
  institutionJoinRequestsApi,
  institutionPersonalSettingsApi,
  individualProfileApi,
} from "@/lib/routes";
import { getClientLocale, t, type Locale } from "@/lib/i18n";

import type {
  Role,
  Application,
  ApplicationDocument,
  HRMember,
  JoinRequest,
  InstitutionSettings,
  PersonalSettings,
  SortedTalent,
  AptelyReport,
  AptelyReportResult,
  Team,
  CandidateProfile,
  RolePermissionsMap,
  CustomRole,
} from "./api.types";

import {
  asNonEmptyString,
  isLocationPlaceholder,
  safeEntityId,
  extractMatchScore,
  safeDateString,
} from "./api.utils";

// Re-export types and utils for backward compatibility via barrel
export type {
  ApplicationStatus,
  RoleStatus,
  MembershipStatus,
  DashboardStats,
  Role,
  Application,
  Activity,
  ApplicationDocument,
  HRMember,
  JoinRequest,
  InstitutionSettings,
  PersonalSettings,
  SortedTalent,
  AptelyReport,
  AptelyReportResult,
  Team,
  CandidateProfile,
  Interview,
  InstitutionInterviewListItem,
  InterviewAvailabilityQuery,
  InterviewSlotParticipant,
  InterviewSlot,
  InterviewGuideQuestion,
  QuestionType,
  GeneratedQuestion,
  DebriefAnswer,
  InterviewQuestionTemplate,
  InterviewerQuestionPack,
  ScorecardCriterionInput,
  InterviewInterviewerScore,
  InterviewScoreContribution,
  InterviewScoresSummary,
  ScorecardStatus,
  InterviewScorecardTemplateSnapshot,
  InterviewScorecardEntry,
  InterviewScorecard,
  InterviewScorecardsList,
  CandidateInterviewHistoryEnrichedItem,
  InterviewActivityEvent,
  InterviewReminderStatus,
  RolePermissionsMap,
  CustomRole,
} from "./api.types";

export { extractMatchScore } from "./api.utils";

// ────────── Roles ──────────

export async function getRoleById(id: string): Promise<Role | null> {
  const r = await apiFetch(mkApiPath(`/roles/${id}`), "HR");
  if (!r) return null;
  const roleDna = Array.isArray(r.role_dna) ? r.role_dna[0] : r.role_dna;
  const fullForm = roleDna?.full_form_json || {};
  const cleanCountry = isLocationPlaceholder(fullForm.country) ? "" : (fullForm.country || "");
  const cleanCity = isLocationPlaceholder(fullForm.city) ? "" : (fullForm.city || "");
  const derivedLocation = `${cleanCountry}${cleanCountry && cleanCity ? ` - ${cleanCity}` : cleanCity}`;
  const derivedQuestions = typeof fullForm.customFormQuestions === "string"
    ? fullForm.customFormQuestions
      .split("\n")
      .map((line: string, index: number) => ({
        id: `custom_idx_${index}`,
        type: "textarea",
        label: line.trim(),
        required: true,
      }))
      .filter((q: any) => q.label)
    : [];

  return {
    roleId: r.id,
    title: asNonEmptyString(fullForm.title) || asNonEmptyString(r.title) || "Role to complete",
    description: asNonEmptyString(fullForm.mission90Day) || asNonEmptyString(r.description) || undefined,
    status: r.status,
    location: asNonEmptyString(r.location) || asNonEmptyString(derivedLocation) || null,
    type: asNonEmptyString(r.type) || asNonEmptyString(fullForm.type) || "UNSPECIFIED",
    createdAt: safeDateString(r.created_at) || new Date().toISOString(),
    endDate: safeDateString(r.end_date || fullForm.decisionTime),
    applicationsCount: 0,
    metadataMissing: Boolean(r.metadata_missing),
    shareLink: r.share_link ? absoluteUrl(applyPath(r.share_link)) : "",
    applicationForm: Array.isArray(r.application_form) && r.application_form.length ? r.application_form : derivedQuestions,
    roleDna: roleDna
      ? {
          mission90Days: roleDna.mission_90_days,
          success6Months: roleDna.success_6_months,
          keyProblems: Array.isArray(roleDna.key_problems) ? roleDna.key_problems : [],
          constraints: roleDna.constraints || {},
          teamContext: roleDna.team_context || {},
          candidateProfile: roleDna.candidate_profile || {},
          dealbreakers: Array.isArray(roleDna.dealbreakers) ? roleDna.dealbreakers : roleDna.dealbreakers ? [roleDna.dealbreakers] : [],
          evaluationContext: roleDna.evaluation_context,
          fullFormSnapshot: roleDna.full_form_json || undefined,
        }
      : undefined,
  };
}

export async function saveRolePostSheet(
  roleId: string,
  payload: { fullForm: Record<string, any> }
): Promise<boolean> {
  const dnaRes = await apiFetch(mkApiPath(`/roles/${roleId}/dna`), "HR", {
    method: "PATCH",
    body: JSON.stringify({ fullForm: payload.fullForm }),
  });

  if (dnaRes && typeof dnaRes === "object" && "error" in dnaRes) return false;
  return !!dnaRes;
}

export async function createRoleWithDna(payload: {
  title?: string;
  description?: string;
  location?: string;
  type?: "FULL_TIME" | "PART_TIME" | "FREELANCE" | "INTERNSHIP";
  endDate?: string;
  mission90Days?: string;
  success6Months?: string;
  keyProblems?: Array<{ problem: string; priority: "HIGH" | "MEDIUM" | "LOW" }>;
  constraints?: {
    budget?: string;
    teamSize?: number;
    techStack?: string[];
    reportingTo?: string;
  };
  teamContext?: {
    size?: number;
    structure?: string;
    dynamics?: string;
    challenges?: string[];
  };
  candidateProfile?: {
    mustHave?: string[];
    niceToHave?: string[];
    culture?: string;
  };
  dealbreakers?: string[];
  applicationForm?: any[];
  evaluationContext?: string;
  fullForm?: Record<string, any>;
}): Promise<string | null> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (typeof window !== "undefined") {
      try {
        const stored = window.localStorage.getItem("aptely_active_workspace");
        headers["X-Workspace-Id"] = stored && stored !== "personal" ? stored : "individual";
      } catch {
        // Ignore localStorage read issues
      }
      headers["x-locale"] = getClientLocale();
    }

    const res = await fetch(`/api/backend${API.roles}`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        fullForm: payload.fullForm,
        title: payload.title,
        department_id: (payload.fullForm as any)?.department_id || undefined,
        hiring_manager_user_id: (payload.fullForm as any)?.hiring_manager_user_id || undefined,
      }),
    });

    let responseBody: any = null;
    try {
      responseBody = await res.json();
    } catch {
      responseBody = null;
    }

    if (!res.ok) {
      const details = responseBody?.details;
      const detailText =
        details && typeof details === "object"
          ? Object.entries(details)
              .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(", ") : String(messages)}`)
              .join(" | ")
          : null;

      const backendMessage = responseBody?.error || responseBody?.message || "Unknown backend error";

      if (res.status === 401) {
        throw new Error("Session expirée. Veuillez vous reconnecter puis réessayer.");
      }
      if (res.status === 403) {
        throw new Error(`Accès refusé pour créer la fiche de poste. Détail: ${backendMessage}`);
      }
      if (res.status === 422) {
        throw new Error(`Le formulaire contient des données invalides. ${detailText ? `Champs en erreur: ${detailText}` : backendMessage}`);
      }
      if (res.status >= 500) {
        throw new Error(`Erreur serveur lors de la création de la fiche de poste. ${backendMessage}`);
      }

      throw new Error(`Échec de création (${res.status}): ${backendMessage}`);
    }

    const created = responseBody?.data ?? responseBody;
    if (!created?.id) {
      console.error("[API] Failed to create role: no ID returned");
      throw new Error("Création incomplète: le serveur n'a pas renvoyé d'identifiant de fiche de poste.");
    }
    const roleId = created.id as string;
    console.log(`[API] Role JSON created successfully for role ${roleId}`);
    return roleId;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[API] createRoleWithDna failed:", message);
    throw err;
  }
}


// ────────── All Applications ──────────
export async function getAllApplications(): Promise<Application[]> {
  const timestamp = Date.now();
  const apps = await apiFetch(withParams(mkApiPath("/applications"), `t=${timestamp}`), "HR", { cache: "no-store" });
  if (!Array.isArray(apps)) return [];
  return apps.map((a: any) => ({
    applicationId: a.id || a.applicationId,
    candidateId: safeEntityId(a.candidate_id) || safeEntityId(a.candidateId),
    candidateName: a.candidateName || a.profiles?.full_name || "Unknown",
    roleId: a.role_id || a.roleId || "unknown",
    roleTitle: a.roleTitle || a.roles?.title || "Role",
    status: a.status,
    submittedAt: a.submittedAt || a.created_at,
    hasDocuments: !!a.hasDocuments,
    matchScore: extractMatchScore(a),
  }));
}

export async function getApplicationsByRole(roleId: string, page?: number, limit?: number): Promise<{ data: Application[]; meta: { total: number; page: number; limit: number } }> {
  const timestamp = Date.now();
  const params = [`t=${timestamp}`];
  if (page) params.push(`page=${page}`);
  if (limit) params.push(`limit=${limit}`);
  else params.push(`limit=20`);
  const res = await apiFetch(withParams(mkApiPath(`/roles/${roleId}/applications`), params.join('&')), "HR", { cache: "no-store" });
  const apps = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
  const meta = res?.meta || { total: apps.length, page: page || 1, limit: limit || 20 };
  return {
    data: apps.map((a: any) => ({
      applicationId: a.id,
      candidateId: safeEntityId(a.candidate_id) || safeEntityId(a.candidateId) || safeEntityId(a.profiles?.id),
      candidateName: a.guest_name || a.profiles?.full_name || "Unknown",
      roleId,
      roleTitle: "",
      status: a.status,
      submittedAt: a.created_at,
      hasDocuments: false,
      matchScore: extractMatchScore(a),
    })),
    meta,
  };
}

// ────────── Evaluation & Finalization ──────────

export async function evaluateRole(roleId: string, limit: number): Promise<boolean> {
  const res = await apiFetch(mkApiPath(`/roles/${roleId}/evaluate`), "HR", {
    method: "POST",
    body: JSON.stringify({ limit })
  });
  return isApiSuccess(res);
}

export async function finalizeSelection(applicationId: string, selectionData: { approvalMessage?: string; rejectionMessage?: string }): Promise<boolean> {
  const res = await apiFetch(mkApiPath(`/applications/${applicationId}/finalize-selection`), "HR", {
    method: "POST",
    body: JSON.stringify(selectionData)
  });
  return isApiSuccess(res);
}

export async function sendSelectionEmails(applicationId: string): Promise<boolean> {
  const res = await apiFetch(mkApiPath(`/applications/${applicationId}/send-emails`), "HR", {
    method: "POST",
  });
  return isApiSuccess(res);
}

export async function getApplicationById(applicationId: string): Promise<any> {
  const timestamp = Date.now();
  return await apiFetch(withParams(mkApiPath(`/applications/${applicationId}`), `t=${timestamp}`), "HR", {
    cache: "no-store"
  });
}

export async function getApplicationDocuments(applicationId: string): Promise<ApplicationDocument[]> {
  const docs = await apiFetch(mkApiPath(`/applications/${applicationId}/documents`), "HR", {
    cache: "no-store",
  });
  if (!Array.isArray(docs)) return [];
  return docs.map((doc: any) => ({
    id: doc.id,
    type: doc.file_type ?? doc.type,
    fileName: doc.fileName,
    storagePath: doc.storagePath,
    url: doc.signedUrl ?? doc.url ?? null,
    createdAt: doc.createdAt,
  }));
}

// ────────── HR Members ──────────
function normalizeMember(m: any): HRMember {
  return {
    userId: m.user_id || m.profiles?.id || "unknown",
    email: m.profiles?.email || "Unknown",
    fullName: m.profiles?.full_name || null,
    membershipStatus: m.status,
    roleSpecialization: m.role_specialization ?? null,
    roleCustomLabel: m.role_custom_label ?? null,
    customRoleId: m.custom_role_id ?? null,
    createdAt: m.joined_at,
  };
}

/**
 * Without an explicit page, walks every page so callers get the whole team — the
 * backend paginates (20 by default, 50 max) and the team page looks the current
 * user up in this list to decide which management actions to show.
 */
export async function getHRMembers(params?: { search?: string; page?: number; limit?: number }): Promise<HRMember[]> {
  if (params?.page) {
    const { members } = await getHRMembersPaginated(params);
    return members;
  }
  const all: HRMember[] = [];
  for (let page = 1; page <= 100; page++) {
    const { members, meta } = await getHRMembersPaginated({ ...params, page, limit: params?.limit ?? 50 });
    all.push(...members);
    if (!meta.hasMore || members.length === 0) break;
  }
  return all;
}

export async function getHRMembersPaginated(params?: { search?: string; page?: number; limit?: number }): Promise<{
  members: HRMember[];
  meta: { total: number; page: number; limit: number; hasMore: boolean };
}> {
  const qs = new URLSearchParams();
  if (params?.search) qs.set("search", params.search);
  if (params?.page)   qs.set("page", String(params.page));
  if (params?.limit)  qs.set("limit", String(params.limit ?? "20"));
  const qsStr2 = qs.toString();
  const paginatedUrl = qsStr2 ? withParams(institutionMembersApi, qsStr2) : institutionMembersApi;
  const res = await apiFetch(paginatedUrl, "HR");
  const raw = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
  const meta = res?.meta ?? { total: raw.length, page: 1, limit: 20, hasMore: false };
  return {
    members: raw.map(normalizeMember),
    meta,
  };
}

export async function removeInstitutionMember(userId: string): Promise<boolean> {
  const res = await apiFetch(mkApiPath(`/institution/members/${userId}`), "HR", {
    method: "DELETE",
  });
  return isApiSuccess(res);
}

export async function updateInstitutionMemberStatus(
  userId: string,
  status: "ACTIVE" | "SUSPENDED"
): Promise<boolean> {
  const res = await apiFetch(mkApiPath(`/institution/members/${userId}/status`), "HR", {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  return isApiSuccess(res);
}

export async function transferOwnership(newOwnerUserId: string): Promise<boolean> {
  const res = await apiFetch(mkApiPath(`/institution/transfer-ownership`), "HR", {
    method: "POST",
    body: JSON.stringify({ newOwnerUserId }),
  });
  return isApiSuccess(res);
}

// ────────── Role permissions matrix ──────────

export async function getRolePermissions(): Promise<RolePermissionsMap> {
  const res = await apiFetch(mkApiPath(`/institution/permissions`), "HR");
  return (res && typeof res === "object" ? res : {}) as RolePermissionsMap;
}

export async function updateRolePermissions(
  role: string,
  permissions: Record<string, boolean>
): Promise<boolean> {
  const res = await apiFetch(mkApiPath(`/institution/permissions/${role}`), "HR", {
    method: "PUT",
    body: JSON.stringify(permissions),
  });
  return isApiSuccess(res);
}

// ────────── Custom roles ──────────

export async function getCustomRoles(): Promise<CustomRole[]> {
  const res = await apiFetch(mkApiPath(`/institution/custom-roles`), "HR");
  return Array.isArray(res) ? (res as CustomRole[]) : [];
}

export async function createCustomRole(
  name: string,
  permissions: string[],
  rank?: number
): Promise<CustomRole | null> {
  const res = await apiFetch(mkApiPath(`/institution/custom-roles`), "HR", {
    method: "POST",
    body: JSON.stringify({ name, permissions, ...(typeof rank === "number" ? { rank } : {}) }),
  });
  return (isApiSuccess(res) ? res : null) as CustomRole | null;
}

export async function updateCustomRole(
  id: string,
  payload: { name?: string; rank?: number; permissions?: string[] }
): Promise<boolean> {
  const res = await apiFetch(mkApiPath(`/institution/custom-roles/${id}`), "HR", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return isApiSuccess(res);
}

export async function deleteCustomRole(id: string): Promise<boolean> {
  const res = await apiFetch(mkApiPath(`/institution/custom-roles/${id}`), "HR", {
    method: "DELETE",
  });
  return isApiSuccess(res);
}

export async function updateMemberRoleSpecialization(
  userId: string,
  roleSpecialization: string,
  customRoleId?: string
): Promise<boolean> {
  const res = await apiFetch(mkApiPath(`/institution/members/${userId}/role-specialization`), "HR", {
    method: "PATCH",
    body: JSON.stringify({ roleSpecialization, customRoleId }),
  });
  return isApiSuccess(res);
}

// ────────── Join Requests ──────────
export async function getJoinRequests(): Promise<JoinRequest[]> {
  const reqs = await apiFetch(institutionJoinRequestsApi, "HR");
  if (!Array.isArray(reqs)) return [];
  return reqs.map((r: any) => ({
    requestId: r.id,
    userId: r.user_id || "unknown",
    email: r.profiles?.email || "Unknown",
    requestedAt: r.joined_at || r.created_at || new Date().toISOString(),
    status: "PENDING"
  }));
}

export async function approveJoinRequest(userId: string): Promise<boolean> {
  const res = await apiFetch(mkApiPath(`/institution/join-requests/${userId}`), "HR", {
    method: "PATCH",
    body: JSON.stringify({ action: "ACCEPT" })
  });
  return isApiSuccess(res);
}

export async function refuseJoinRequest(userId: string): Promise<boolean> {
  const res = await apiFetch(mkApiPath(`/institution/join-requests/${userId}`), "HR", {
    method: "PATCH",
    body: JSON.stringify({ action: "REJECT" })
  });
  return isApiSuccess(res);
}

// ────────── Institution Settings ──────────
export async function getInstitutionSettings(): Promise<InstitutionSettings> {
  const inst = await apiFetch(API.institution, "HR");
  if (!inst) return { institutionId: "", name: "Unknown" };
  return {
    institutionId: inst.id,
    name: inst.name,
    website: inst.website,
    sector: inst.sector,
    teamSize: inst.team_size,
    stage: inst.stage,
    location: inst.location,
    description: inst.description,
    logoUrl: inst.logo_url
  };
}

export async function getPersonalSettings(): Promise<PersonalSettings | null> {
  const prefs = await apiFetch(institutionPersonalSettingsApi, "HR", {
    method: "GET",
  });

  if (!prefs || typeof prefs !== "object") return null;

  return {
    timezone: String((prefs as any).timezone ?? "UTC"),
    language: ((prefs as any).language ?? "fr") as "fr" | "en",
    emailNotifications: Boolean((prefs as any).emailNotifications),
    inAppNotifications: Boolean((prefs as any).inAppNotifications),
    interviewReminders: Boolean((prefs as any).interviewReminders),
    defaultInterviewDuration: Number((prefs as any).defaultInterviewDuration ?? 60) as 30 | 45 | 60 | 90,
    interviewBufferMinutes: Number((prefs as any).interviewBufferMinutes ?? 15) as 0 | 10 | 15 | 30,
    workdayStart: String((prefs as any).workdayStart ?? "09:00"),
    workdayEnd: String((prefs as any).workdayEnd ?? "18:00"),
    ...((prefs as any).calcomLink ? { calcomLink: String((prefs as any).calcomLink) } : {}),
  };
}

export async function updatePersonalSettings(payload: PersonalSettings): Promise<PersonalSettings | null> {
  const prefs = await apiFetch(institutionPersonalSettingsApi, "HR", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  if (!prefs || typeof prefs !== "object") return null;

  return {
    timezone: String((prefs as any).timezone ?? "UTC"),
    language: ((prefs as any).language ?? "fr") as "fr" | "en",
    emailNotifications: Boolean((prefs as any).emailNotifications),
    inAppNotifications: Boolean((prefs as any).inAppNotifications),
    interviewReminders: Boolean((prefs as any).interviewReminders),
    defaultInterviewDuration: Number((prefs as any).defaultInterviewDuration ?? 60) as 30 | 45 | 60 | 90,
    interviewBufferMinutes: Number((prefs as any).interviewBufferMinutes ?? 15) as 0 | 10 | 15 | 30,
    workdayStart: String((prefs as any).workdayStart ?? "09:00"),
    workdayEnd: String((prefs as any).workdayEnd ?? "18:00"),
    ...((prefs as any).calcomLink ? { calcomLink: String((prefs as any).calcomLink) } : {}),
  };
}

// ────────── Sorted Talents ──────────
export async function getSortedTalents(applicationId: string): Promise<SortedTalent[]> {
  const talents = await apiFetch(mkApiPath(`/applications/${applicationId}/sorted-talents`), "HR");
  if (!Array.isArray(talents)) return [];
  return talents.map((t: any) => ({
    rank: t.rank || 0,
    talentId: t.candidate_id || t.talentId || "unknown",
    name: t.candidate_name || "Unknown",
    score: t.score || 0,
    approved: t.approved ?? null,
    yearsExp: 0,
    context: t.ai_explanation || "",
    tags: []
  }));
}

// ────────── Aptely Report (New Schema) ──────────
export async function getAptelyReport(applicationId: string, locale: Locale = "fr"): Promise<AptelyReport | null> {
  const envelope = await apiFetch(mkApiPath(`/applications/${applicationId}`), "HR");
  if (!envelope) return null;

  const report = envelope.data ?? envelope;
  const rawMatchResults = report.match_results;
  const match = Array.isArray(rawMatchResults)
    ? (rawMatchResults[0] ?? null)
    : (rawMatchResults ?? null);
  const profile = report.profiles ?? {};
  const role = report.roles ?? {};

  let aiExp: { strengths?: string[]; gaps?: string[]; recommendation?: string } = {};
  if (match?.ai_explanation) {
    try {
      aiExp = typeof match.ai_explanation === "string"
        ? JSON.parse(match.ai_explanation)
        : match.ai_explanation;
    } catch {
      aiExp = {};
    }
  }

  const strengths: string[] = aiExp.strengths ?? [];
  const gaps: string[] = aiExp.gaps ?? [];
  const recommendation: string = aiExp.recommendation ?? "";

  const toPercent = (v: number | undefined | null) =>
    v != null ? Math.round(v * 100) : 0;

  const finalScore = toPercent(
    match?.overall_score ??
    match?.final_score
  );

  const dnaSnapshot = report.dna_snapshot || {};
  const identityName = dnaSnapshot.talent_identity?.name ?? dnaSnapshot.talent_identity?.full_name;

  const result: AptelyReportResult | null = match
    ? {
        talentId: profile?.id ?? "",
        name: identityName ?? report.guest_name ?? profile?.full_name ?? profile?.email ?? "Unknown Candidate",
        score: {
          roleFit: toPercent(match.role_fit ?? match.technical_score),
          skillValidity: toPercent(match.skill_validity ?? match.experience_score),
          capabilityStrength: toPercent(match.capability_strength ?? match.technical_score),
          environmentFit: toPercent(match.environment_fit ?? match.culture_score),
          motivationFit: toPercent(match.motivation_fit ?? match.motivation_score),
          constraintFit: toPercent(match.constraint_fit ?? match.adaptability_score),
          reliabilityIndex: toPercent(match.reliability_index ?? match.communication_score),
          finalScore,
        },
        aiExplanation: {
          whySelected: strengths.length > 0
            ? strengths
            : recommendation
              ? [recommendation]
              : ["Analysis complete — see score breakdown above."],
          evidenceUsed: gaps.map((g) => ({
            type: t(locale, "application.report.gapType", "gap"),
            text: g,
            signal: t(locale, "application.report.gapSignal", "Consider this when evaluating the candidate."),
          })),
          riskFlags: gaps.map((g) => ({
            risk: g,
            impact: t(locale, "application.report.gapImpact", "This gap may impact performance if not addressed during onboarding."),
          })),
          tradeoffs: recommendation ? [recommendation] : [],
          alignmentWithRole: {
            mission90Days: strengths[0] ?? t(locale, "application.report.candidateRelevantExp", "Candidate profile shows relevant experience."),
            success6Months: strengths[1] ?? t(locale, "application.report.trackRecord", "Track record indicates strong alignment with role goals."),
            keyProblems: [],
          },
        },
      }
    : null;

  return {
    roleId: role?.id ?? report.role_id ?? "",
    roleTitle: role?.title ?? (role?.role_dna as { full_form_json?: { title?: string } } | undefined)?.full_form_json?.title ?? "",
    summary: {
      topCandidates: result ? 1 : 0,
      totalReviewed: 1,
      aiConfidence: match?.ai_confidence ?? 0,
      keySelectionFactors: strengths.slice(0, 3),
    },
    results: result ? [result] : [],
  };
}

// ────────── Available Teams ──────────
export async function getAvailableTeams(): Promise<Team[]> {
  return [];
}

export async function requestToJoinTeam(teamId: string): Promise<boolean> {
  void teamId;
  return false;
}

// ────────── Candidate Profile (7 Sections) ──────────
export async function getCandidateProfile(candidateId: string): Promise<CandidateProfile | null> {
  const profile = await apiFetch(individualProfileApi(candidateId), "HR");
  if (!profile) return null;
  return profile;
}
