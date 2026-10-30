/**
 * Central route registry — single source of truth.
 * FRONTEND routes: navigation hrefs, router.push, Link href
 * API routes: backend endpoints for apiFetch()
 * Never hardcode route strings elsewhere — import from here.
 */

// ─── Frontend navigation routes ───────────────────────────────
export const ROUTES = {
  login: "/login",
  register: "/register",
  forgot: "/forgot-password",
  reset: "/reset-password",

  join: "/join",

  company: {
    dashboard: "/company/dashboard",
    recruitment: {
      root: "/company/recruitment",
      roles: "/company/recruitment/roles",
      rolesCreate: "/company/recruitment/roles/create",
      applications: "/company/recruitment/applications",
      offers: "/company/recruitment/offers",
      interviews: "/company/recruitment/interviews",
      onboarding: "/company/recruitment/onboarding",
      cvStudio: "/company/recruitment/cv-studio",
    },
    interviewer: "/company/interviewer",
    calendar: "/company/calendar",
    hr: {
      root: "/company/employees",
      leave: "/company/employees/leave",
    },
    analytics: "/company/analytics",
    analyticsRetention: "/company/analytics/retention",
    recruitmentApplicationsAnalysing:
      "/company/recruitment/applications?status=ANALYSING",
    payroll: "/company/payroll",
    goals: "/company/goals",
    goalsCreate: "/company/goals/new",
    settings: {
      root: "/company/settings",
      hr: "/company/settings/hr",
      permissions: "/company/settings/permissions",
      settings: "/company/settings/settings",
      integrations: "/company/settings/integrations",
      webhooks: "/company/settings/webhooks",
      teams: "/company/settings/teams",
      onboarding: "/company/settings/onboarding",
      create: "/company/settings/create",
      join: "/company/settings/join",
      accessStatus: "/company/settings/access-status",
      waitingApproval: "/company/settings/waiting-approval",
      organization: "/company/settings/organization",
    },
  },

  candidate: {
    dashboard: "/candidate/dashboard",
    profile: "/candidate/profile",
    vault: "/candidate/vault",
    prep: "/candidate/prep",
    messages: "/candidate/messages",
    offers: "/candidate/offers",
    onboarding: "/candidate/onboarding",
    export: "/candidate/export",
    opportunities: "/candidate/opportunities",
    endorse: "/candidate/endorse",
    reflection: "/candidate/reflection",
    learning: "/candidate/learning",
    cvStudio: "/candidate/cv-studio",
    calendar: "/candidate/calendar",
    settings: "/candidate/settings",
  },

  // Public job discovery
  discover: "/offers",
  /** @deprecated Legacy marketing URL — next.config redirects /talents → /offers */
  talents: "/offers",

  // Marketing / public pages
  demo: "/demo",
  privacy: "/privacy",
  terms: "/terms",
  tarifs: "/tarifs",

  // Public pages without auth shell
  public: {
    profile: "/public/profile",
  },

  // Waves public booking
  waves: {
    booking: "/waves/booking",
  },

  // Workspace creation
  workspaces: {
    new: "/workspaces/new",
  },

  // HR-facing candidate management routes (plural — distinct from /candidate portal)
  candidatesHR: "/candidates",

  // Platform admin (super admin only)
  admin: {
    root: "/admin",
    users: "/admin/users",
    institutions: "/admin/institutions",
    metrics: "/admin/metrics",
  },
} as const;

// ─── Branded API path type ─────────────────────────────────────────────────────
// Only values produced by helpers in this file can be passed to apiFetch().
// External code cannot create ApiPath by string concatenation — compile error.
declare const __apiPath: unique symbol;
export type ApiPath = string & { readonly [__apiPath]: never };

// Private factory — the ONLY way to create ApiPath values. Not exported.
const p = (s: string): ApiPath => s as ApiPath;

// Brands all values in a plain object as ApiPath (used for the API prefix map).
function makeApi<const T extends Record<string, string>>(
  obj: T,
): { readonly [K in keyof T]: ApiPath } {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, p(v)]),
  ) as never;
}

// Use this when you need to add query params to an ApiPath.
// e.g. apiFetch(withParams(API.employees, params.toString()))
export const withParams = (base: ApiPath, params: string): ApiPath =>
  p(`${base}?${params}`);

/**
 * Low-level escape hatch for api.*.ts files.
 * DO NOT import this in components or pages — use named helpers from this file.
 * ESLint bans mkApiPath in src/app/** and src/components/**.
 */
export const mkApiPath = (s: string): ApiPath => s as ApiPath;

// ─── Backend API endpoint prefixes ────────────────────────────
export const API = makeApi({
  auth: "/auth",
  roles: "/roles",
  applications: "/applications",
  offers: "/offers",
  decisions: "/decisions",
  interviews: "/interviews",
  onboarding: "/onboarding",
  institution: "/institution",
  individuals: "/individuals",
  vault: "/vault",
  prep: "/prep",
  messages: "/messages",
  match: "/match",
  waves: "/waves",
  analytics: "/analytics",
  communications: "/communications",
  hr: "/hr",
  employees: "/employees",
  notifications: "/notifications",
  availability: "/institution/availability",
  departments: "/institution/departments",
  jobPositions: "/institution/job-positions",
  leave: "/leave",
  offboardingHr: "/offboarding-hr",
  payroll: "/payroll",
  webhooks: "/webhooks",
  goals: "/goals",
  retention: "/retention",
  learning: "/learning",
  compensation: "/compensation",
  cvStudio: "/cv-studio",
  adminApi: "/admin",
});

// ─── Absolute URL builder ──────────────────────────────────────────────────
// Single source of truth for constructing full URLs.
// Reads NEXT_PUBLIC_APP_URL (set in .env) — works on server + client.
// Falls back to window.location.origin only when env var is absent (local dev without .env).
export function absoluteUrl(path: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}${path}`;
}

// ─── Dynamic route helpers ─────────────────────────────────────────────────
// All routes with ID params. Import these — NEVER concatenate strings manually.

const R = ROUTES.company.recruitment;
const C = ROUTES.candidate;

// Institution API helpers
export const institutionCreateApi: ApiPath = p(`${API.institution}/create`);

// Applications
export const appPath = (id: string) => `${R.applications}/${id}`;
export const appCandidatePath = (id: string) =>
  `${R.applications}/${id}/candidate`;
export const appReportPath = (id: string) => `${R.applications}/${id}/report`;
export const appInterviewPath = (id: string) =>
  `${R.applications}/${id}/interview`;
export const appMessagesPath = (id: string) =>
  `${R.applications}/${id}/messages`;
export const appSortingPath = (id: string) => `${R.applications}/${id}/sorting`;
export const appEmailPreviewPath = (id: string) =>
  `${R.applications}/${id}/email-preview`;
export const interviewNotesPath = (appId: string, interviewId: string) =>
  `${R.applications}/${appId}/interview/notes/${interviewId}`;

// Roles
export const rolePath = (id: string) => `${R.roles}/${id}`;
export const roleWithAppPath = (roleId: string, appId: string) =>
  `${rolePath(roleId)}?app=${appId}`;
export const roleFinalizeListPath = (id: string) => `${R.roles}/${id}/finalize`;
export const roleFinalizePath = (id: string, appId: string) =>
  `${R.roles}/${id}/finalize/${appId}`;
// Offers
export const offerPath = (id: string) => `${R.offers}/${id}`;
// Public candidate-facing offer pages (no /company/recruitment prefix)
export const offerPublicPrefix = "/offers/public";
// Signing page lives at /company/recruitment/offers/sign/[token] (single page for both parties)
export const offerSignPrefix = "/offers/sign"; // kept for PUBLIC_SHELL_ROUTES guard (harmless)
export const offerSignHRPrefix = `${R.offers}/sign`;
export const offerSignPath = (token: string) => `${offerSignHRPrefix}/${token}`;
export const offerSignedPdfApi = (id: string): ApiPath =>
  p(`${API.offers}/${id}/signed-pdf`);
export const offerSignByTokenApi = (token: string): ApiPath =>
  p(`${API.offers}/sign/${token}`);

// Interviews
export const interviewBookPath = (token: string) =>
  `${R.interviews}/book/${token}`;
export const interviewBookPrefix = `${R.interviews}/book`;
export const appInterviewReschedulePath = (
  appId: string,
  interviewId: string,
) => `${R.applications}/${appId}/interview?reschedule=${interviewId}`;

// Candidate portal
export const candidateReflectionPath = (interviewId: string) =>
  `${ROUTES.candidate.reflection}/${interviewId}`;
export const candidateInterviewsPath = (candidateId: string) =>
  `${ROUTES.candidatesHR}/${candidateId}/interviews`;
export const candidateInterviewsNewPath = (candidateId: string) =>
  `${candidateInterviewsPath(candidateId)}/new`;
export const endorsePath = (token: string) => `${C.endorse}/${token}`;

// Apply public links
export const applyPath = (shareLink: string) => `/apply/${shareLink}`;

// Auth redirect helpers
export const createAuthRedirect = (targetPath: string) =>
  `${ROUTES.login}?redirect=${encodeURIComponent(targetPath)}`;
export const loginWithError = (code: string) =>
  `${ROUTES.login}?error=${encodeURIComponent(code)}`;

export const interviewConfirmSecondaryApi = (id: string): ApiPath =>
  p(`${API.interviews}/${id}/confirm-secondary`);

// Employees (HR module)
export const employeePath = (userId: string) =>
  `${ROUTES.company.hr.root}/${userId}`;
export const employeeApiPath = (userId: string): ApiPath =>
  p(`${API.employees}/${userId}`);
export const employeeOffboardPath = (userId: string) =>
  `${ROUTES.company.hr.root}/${userId}/offboarding`;
export const employeeReviewsApi = (userId: string): ApiPath =>
  p(`${API.employees}/${userId}/reviews`);

// ─── Offboarding HR ───────────────────────────────────────────────────────────
export const offboardingHrApi = (userId: string): ApiPath =>
  p(`${API.offboardingHr}/${userId}`);
export const offboardingHrTasksApi = (userId: string): ApiPath =>
  p(`${API.offboardingHr}/${userId}/tasks`);
export const offboardingHrTaskToggleApi = (
  userId: string,
  taskId: string,
): ApiPath => p(`${API.offboardingHr}/${userId}/tasks/${taskId}/toggle`);

// Payroll
export const payrollPeriodApi = (periodId: string): ApiPath =>
  p(`${API.payroll}/periods/${periodId}`);
export const payrollEntryApi = (periodId: string, entryId: string): ApiPath =>
  p(`${API.payroll}/periods/${periodId}/entries/${entryId}`);
export const payrollGenerateApi = (periodId: string): ApiPath =>
  p(`${API.payroll}/periods/${periodId}/generate`);

// ─── Institution management endpoints (backend-relative, pass to apiFetch) ───
export const institutionJoinRequestApi = (institutionId: string): ApiPath =>
  p(`${API.institution}/${institutionId}/join-request`);
export const institutionInvitationsApi: ApiPath = p(
  `${API.institution}/invitations`,
);
export const institutionMembersApi: ApiPath = p(`${API.institution}/members`);
export const institutionInviteJoinApi = (token: string): ApiPath =>
  p(`${institutionInvitationsApi}/join/${token}`);
export const institutionInviteRegenerateApi = (id: string): ApiPath =>
  p(`${institutionInvitationsApi}/${id}/regenerate`);
export const institutionMeDepartmentsApi: ApiPath = p(
  `${API.institution}/me/departments`,
);
export const institutionMembershipsApi: ApiPath = p(
  `${API.institution}/memberships`,
);
export const institutionMePermissionsApi: ApiPath = p(
  `${API.institution}/me/permissions`,
);
export const institutionOwnerLabelApi: ApiPath = p(
  `${API.institution}/me/owner-label`,
);
export const institutionLogoPresignApi: ApiPath = p(
  `${API.institution}/settings/logo/presign`,
);
export const institutionLogoApi: ApiPath = p(
  `${API.institution}/settings/logo`,
);

// ─── Messages ────────────────────────────────────────────────────────────────
export const messagesThreadApi = (appId: string): ApiPath =>
  p(`${API.messages}/${appId}`);
export const messagesReadApi = (appId: string): ApiPath =>
  p(`${API.messages}/${appId}/read`);

// ─── Applications sub-paths ───────────────────────────────────────────────────
export const appStatusApi = (id: string): ApiPath =>
  p(`${API.applications}/${id}/status`);
export const appSendEmailsApi = (id: string): ApiPath =>
  p(`${API.applications}/${id}/send-emails`);
export const appEmailPreviewApi = (id: string): ApiPath =>
  p(`${API.applications}/${id}/email-preview`);

// ─── Decisions sub-paths ──────────────────────────────────────────────────────
export const decisionStateApi = (appId: string): ApiPath =>
  p(`${API.decisions}/applications/${appId}/state`);
export const decisionAuditApi = (appId: string): ApiPath =>
  p(`${API.decisions}/applications/${appId}/audit-logs`);
export const decisionRecommendApi = (appId: string): ApiPath =>
  p(`${API.decisions}/applications/${appId}/recommend`);
export const decisionDecideApi = (appId: string): ApiPath =>
  p(`${API.decisions}/applications/${appId}/decide`);
export const decisionRatifyApi = (appId: string): ApiPath =>
  p(`${API.decisions}/applications/${appId}/ratify`);

// ─── Offers sub-paths ────────────────────────────────────────────────────────
export const offerAcceptApi = (id: string): ApiPath =>
  p(`${API.offers}/${id}/accept`);
export const offerRejectApi = (id: string): ApiPath =>
  p(`${API.offers}/${id}/reject`);
export const offerCounterApi = (id: string): ApiPath =>
  p(`${API.offers}/${id}/counter`);
export const offerCounterApproveApi = (id: string): ApiPath =>
  p(`${API.offers}/${id}/counter-response/approve`);
export const offerCounterRejectApi = (id: string): ApiPath =>
  p(`${API.offers}/${id}/counter-response/reject`);
export const myOfferApi = (id: string): ApiPath =>
  p(`${API.individuals}/me/offers/${id}`);

// ─── Prep / reflection ────────────────────────────────────────────────────────
export const prepBriefApi = (appId: string): ApiPath =>
  p(`${API.prep}/${appId}/brief`);
export const reflectionApi = (interviewId: string): ApiPath =>
  p(`${API.prep}/reflections/${interviewId}`);
export const myInterviewApi = (appId: string): ApiPath =>
  p(`${API.individuals}/me/applications/${appId}/interview`);

// ─── Vault ───────────────────────────────────────────────────────────────────
export const vaultProofApi = (id: string): ApiPath =>
  p(`${API.vault}/me/proofs/${id}`);
export const vaultEvidenceApi = (id: string): ApiPath =>
  p(`${API.vault}/me/evidence/${id}`);
export const vaultReferenceApi = (id: string): ApiPath =>
  p(`${API.vault}/me/references/${id}`);

// ─── Onboarding ──────────────────────────────────────────────────────────────
export const onboardingChecklistApi = (appId: string): ApiPath =>
  p(`${API.onboarding}/checklists/${appId}`);
export const onboardingTaskStatusApi = (taskId: string): ApiPath =>
  p(`${API.onboarding}/tasks/${taskId}/status`);

// ─── Employee sub-paths ───────────────────────────────────────────────────────
export const employeeLeaveRequestsApi = (userId: string): ApiPath =>
  p(`${API.leave}/requests?employee_user_id=${userId}`);
export const employeeReviewApi = (userId: string, reviewId: string): ApiPath =>
  p(`${API.employees}/${userId}/reviews/${reviewId}`);
export const employeeReviewAckApi = (
  userId: string,
  reviewId: string,
): ApiPath => p(`${API.employees}/${userId}/reviews/${reviewId}/acknowledge`);

// ─── Analytics ────────────────────────────────────────────────────────────────
export const analyticsHrHeadcountApi: ApiPath = p(
  `${API.analytics}/hr/headcount`,
);
export const analyticsHrTurnoverApi: ApiPath = p(
  `${API.analytics}/hr/turnover`,
);
export const analyticsHrLeaveStatsApi: ApiPath = p(
  `${API.analytics}/hr/leave-stats`,
);
export const analyticsPhase2OverviewApi: ApiPath = p(
  `${API.analytics}/phase2/overview`,
);
export const analyticsPhase2FunnelApi: ApiPath = p(
  `${API.analytics}/phase2/funnel`,
);
export const analyticsPhase2TimeToHireApi: ApiPath = p(
  `${API.analytics}/phase2/time-to-hire`,
);

// ─── Interviews extended paths ────────────────────────────────────────────────
export const interviewApiPath = (id: string): ApiPath =>
  p(`${API.interviews}/${id}`);
export const interviewNotifyApi = (id: string): ApiPath =>
  p(`${API.interviews}/${id}/notify`);
export const interviewProposeWindowApi = (id: string): ApiPath =>
  p(`${API.interviews}/${id}/propose-window`);
export const interviewsAssignedToMeApi: ApiPath = p(
  `${API.interviews}/assigned-to-me`,
);
export const interviewsInstitutionListApi: ApiPath = p(
  `${API.interviews}/institution/list`,
);
export const interviewQuestionTemplatesDefaultApi: ApiPath = p(
  `${API.interviews}/question-templates/default`,
);

// ─── Applications extended paths ─────────────────────────────────────────────
export const applicationApiPath = (id: string): ApiPath =>
  p(`${API.applications}/${id}`);
export const applicationPublicApi = (shareLink: string): ApiPath =>
  p(`${API.applications}/public/${shareLink}`);
export const rolePublicApi = (shareLink: string): ApiPath =>
  p(`${API.roles}/public/${shareLink}`);
export const rolesPublicDiscoverApi: ApiPath = p(
  `${API.roles}/public/discover`,
);
export const applicationSortedTalentApi = (
  id: string,
  talentId: string,
): ApiPath => p(`${API.applications}/${id}/sorted-talents/${talentId}`);

// ─── Individuals (candidate self-service) ────────────────────────────────────
export const individualsMeApi: ApiPath = p(`${API.individuals}/me`);
export const individualsUploadCvApi: ApiPath = p(`${API.individuals}/me/upload-cv`);
export const individualsDeleteCvApi: ApiPath = p(`${API.individuals}/me/cv`);
export const individualsMyApplicationsApi: ApiPath = p(
  `${API.individuals}/me/applications`,
);
export const individualsMyExportApi: ApiPath = p(
  `${API.individuals}/me/export`,
);
export const individualsMyOffersApi: ApiPath = p(
  `${API.individuals}/me/offers`,
);
export const individualProfileApi = (candidateId: string): ApiPath =>
  p(`${API.individuals}/${candidateId}/profile`);
export const individualPublicProfileApi = (token: string): ApiPath =>
  p(`${API.individuals}/public/profile/${token}`);

// ─── Communications ──────────────────────────────────────────────────────────
export const communicationsDispatchDecisionApi: ApiPath = p(
  `${API.communications}/dispatch/decision`,
);

// ─── Vault extended paths ─────────────────────────────────────────────────────
export const vaultMyScoreApi: ApiPath = p(`${API.vault}/me/score`);
export const vaultMyProofsApi: ApiPath = p(`${API.vault}/me/proofs`);
export const vaultMyEvidenceApi: ApiPath = p(`${API.vault}/me/evidence`);
export const vaultMyEndorsementsApi: ApiPath = p(
  `${API.vault}/me/endorsements`,
);
export const vaultMyEndorsementApi = (id: string): ApiPath =>
  p(`${API.vault}/me/endorsements/${id}`);
export const vaultMyReferencesApi: ApiPath = p(`${API.vault}/me/references`);
export const vaultMyProofsUploadApi: ApiPath = p(
  `${API.vault}/me/proofs/upload`,
);
export const vaultMyEndorsementsRequestApi: ApiPath = p(
  `${API.vault}/me/endorsements/request`,
);
export const vaultEndorseApi = (token: string): ApiPath =>
  p(`${API.vault}/endorse/${token}`);

// ─── Onboarding extended paths ────────────────────────────────────────────────
export const onboardingDocPresignApi: ApiPath = p(
  `${API.onboarding}/documents/presign-upload`,
);
export const onboardingDocCompleteApi: ApiPath = p(
  `${API.onboarding}/documents/complete`,
);
export const onboardingTemplatesApi: ApiPath = p(`${API.onboarding}/templates`);
export const onboardingChecklistInstantiateApi: ApiPath = p(
  `${API.onboarding}/checklists/instantiate`,
);

// ─── Payroll collections ──────────────────────────────────────────────────────
export const payrollPeriodsApi: ApiPath = p(`${API.payroll}/periods`);

// ─── Institution extended paths ───────────────────────────────────────────────
export const institutionJoinRequestsApi: ApiPath = p(
  `${API.institution}/join-requests`,
);
export const institutionPersonalSettingsApi: ApiPath = p(
  `${API.institution}/personal-settings`,
);
export const institutionMeActiveApi: ApiPath = p(
  `${API.institution}/me/active`,
);
export const institutionMeModulesApi: ApiPath = p(
  `${API.institution}/me/modules`,
);
export const invitationPublicApi = (token: string): ApiPath =>
  p(`${API.institution}/invitations/public/${token}`);

// ─── Goals (Phase 4 Module 02) ────────────────────────────────────────────────
export const goalsApi: ApiPath = p(`${API.goals}`);
export const goalByIdApi = (id: string): ApiPath => p(`${API.goals}/${id}`);
export const goalKrsApi = (id: string): ApiPath =>
  p(`${API.goals}/${id}/key-results`);
export const goalTasksApi = (id: string): ApiPath =>
  p(`${API.goals}/${id}/tasks`);
export const goalTaskByIdApi = (id: string, taskId: string): ApiPath =>
  p(`${API.goals}/${id}/tasks/${taskId}`);
export const goalRolesApi = (id: string): ApiPath =>
  p(`${API.goals}/${id}/roles`);
export const goalValidateApi = (id: string): ApiPath =>
  p(`${API.goals}/${id}/validate`);
export const goalCommitApi = (id: string): ApiPath =>
  p(`${API.goals}/${id}/commit`);
export const goalLaunchApi = (id: string): ApiPath =>
  p(`${API.goals}/${id}/launch`);
export const goalPath = (id: string) => `${ROUTES.company.goals}/${id}`;

// ─── Decisions extended paths ─────────────────────────────────────────────────
export const decisionsActionQueueApi: ApiPath = p(
  `${API.decisions}/action-queue`,
);

// ─── Compensation (Phase 4 Module 05) ────────────────────────────────────────
export const compensationHistoryApi = (userId: string): ApiPath =>
  p(`${API.compensation}/${userId}/history`);
export const compensationReviewApi = (userId: string): ApiPath =>
  p(`${API.compensation}/${userId}/review`);
export const compensationReviewByIdApi = (
  userId: string,
  id: string,
): ApiPath => p(`${API.compensation}/${userId}/review/${id}`);
export const employeeCompensationPath = (userId: string) =>
  `${ROUTES.company.hr.root}/${userId}/compensation`;

// ─── Learning & Development (Phase 4 Module 04) ──────────────────────────────
export const learningPlansApi: ApiPath = p(`${API.learning}/plans`);
export const learningPlanApi = (id: string): ApiPath =>
  p(`${API.learning}/plans/${id}`);
export const learningActivitiesApi = (planId: string): ApiPath =>
  p(`${API.learning}/plans/${planId}/activities`);
export const learningActivityApi = (planId: string, actId: string): ApiPath =>
  p(`${API.learning}/plans/${planId}/activities/${actId}`);
export const learningSkillGapsApi = (userId: string): ApiPath =>
  p(`${API.learning}/skill-gaps/${userId}`);
export const learningSkillGapsComputeApi = (userId: string): ApiPath =>
  p(`${API.learning}/skill-gaps/${userId}/compute`);
export const learningMyPlanApi: ApiPath = p(`${API.learning}/my-plan`);
export const learningMyActivityApi = (actId: string): ApiPath =>
  p(`${API.learning}/my-plan/activities/${actId}`);
export const employeeLearningPath = (userId: string) =>
  `${ROUTES.company.hr.root}/${userId}/learning`;

// ─── CV Studio ───────────────────────────────────────────────────────────────
export const cvStudioAnalyzeApi: ApiPath = p(`${API.cvStudio}/analyze`);
export const cvStudioAnalysesApi: ApiPath = p(`${API.cvStudio}/analyses`);
export const cvStudioAnalysisApi = (id: string): ApiPath =>
  p(`${API.cvStudio}/analyses/${id}`);
export const cvStudioAnalysisStatusApi = (id: string): ApiPath =>
  p(`${API.cvStudio}/analyses/${id}/status`);
export const cvStudioHrAnalyzeApi: ApiPath = p(`${API.cvStudio}/hr/analyze`);
export const cvStudioExportApi = (id: string): ApiPath =>
  p(`${API.cvStudio}/analyses/${id}/export`);
export const cvStudioDiffApi = (id: string): ApiPath =>
  p(`${API.cvStudio}/analyses/${id}/diff`);
export const cvStudioHrAnalysisApi = (id: string): ApiPath =>
  p(`${API.cvStudio}/hr/analyses/${id}`);

// ─── Retention Risk (Phase 4 Module 03) ──────────────────────────────────────
export const retentionDashboardApi: ApiPath = p(`${API.retention}/dashboard`);
export const retentionComputeApi: ApiPath = p(`${API.retention}/compute`);
export const retentionEmployeeApi = (userId: string): ApiPath =>
  p(`${API.retention}/${userId}`);

// ─── Offers extended paths ────────────────────────────────────────────────────
export const offersPendingApprovalsApi: ApiPath = p(
  `${API.offers}/pending-approvals`,
);
export const offerSigningChainApi = (id: string): ApiPath =>
  p(`${API.offers}/${id}/signing-chain`);
export const offerSigningChainSignApi = (
  id: string,
  pos: number | string,
): ApiPath => p(`${API.offers}/${id}/signing-chain/${pos}/sign`);
export const offerResolveSignersApi = (id: string): ApiPath =>
  p(`${API.offers}/${id}/resolve-signers`);

// ─── Waves extended paths ─────────────────────────────────────────────────────
export const wavesTemplatesApi: ApiPath = p(`${API.waves}/templates`);

// ─── Departments & job positions ─────────────────────────────────────────────
export const departmentApi = (id: string): ApiPath =>
  p(`${API.departments}/${id}`);
export const jobPositionApi = (id: string): ApiPath =>
  p(`${API.jobPositions}/${id}`);

// ─── Notifications ────────────────────────────────────────────────────────────
export const notificationsReadAllApi: ApiPath = p(
  `${API.notifications}/read-all`,
);
export const notificationReadApi = (id: string): ApiPath =>
  p(`${API.notifications}/${id}/read`);

// ─── Webhooks ────────────────────────────────────────────────────────────────
export const webhookApi = (id: string): ApiPath => p(`${API.webhooks}/${id}`);
export const webhookRotateSecretApi = (id: string): ApiPath =>
  p(`${API.webhooks}/${id}/rotate-secret`);

// ─── Leave management ────────────────────────────────────────────────────────
export const leavePoliciesApi: ApiPath = p(`${API.leave}/policies`);
export const leaveRequestsApi: ApiPath = p(`${API.leave}/requests`);
export const leaveRequestActionApi = (id: string, action: string): ApiPath =>
  p(`${API.leave}/requests/${id}/${action}`);

// ─── Admin (super admin) API endpoints ────────────────────────────────────────
export const adminStatsApi: ApiPath = p(`${API.adminApi}/stats`);
export const adminMetricsApi: ApiPath = p(`${API.adminApi}/metrics`);
export const adminActivityApi: ApiPath = p(`${API.adminApi}/activity`);
export const adminUsersApi: ApiPath = p(`${API.adminApi}/users`);
export const adminUserByIdApi = (id: string): ApiPath =>
  p(`${API.adminApi}/users/${id}`);
export const adminSuspendUserApi = (id: string): ApiPath =>
  p(`${API.adminApi}/users/${id}/suspend`);
export const adminDeleteUserApi = (id: string): ApiPath =>
  p(`${API.adminApi}/users/${id}`);
export const adminInstitutionsApi: ApiPath = p(`${API.adminApi}/institutions`);
export const adminInstitutionByIdApi = (id: string): ApiPath =>
  p(`${API.adminApi}/institutions/${id}`);
export const adminDeleteInstitutionApi = (id: string): ApiPath =>
  p(`${API.adminApi}/institutions/${id}`);

// ─── Auth backend endpoints (backend-relative, pass to apiFetch) ─────────────
export const authMeApi: ApiPath = p(`${API.auth}/me`);
export const authMeDeleteApi: ApiPath = p(`${API.auth}/me`);
export const authAvatarPresignApi: ApiPath = p(`${API.auth}/avatar/presign`);
export const authAvatarApi: ApiPath = p(`${API.auth}/avatar`);
export const authForgotPasswordApi: ApiPath = p(`${API.auth}/forgot-password`);
export const authResetPasswordApi: ApiPath = p(`${API.auth}/reset-password`);
export const authRefreshApi: ApiPath = p(`${API.auth}/refresh`);

// ─── Internal Next.js API routes (cookie handlers — not proxied to backend) ──
export const AUTH_INTERNAL = {
  setAccessToken: "/api/auth/set-access-token",
  setCookies: "/api/auth/set-cookies",
  clearCookies: "/api/auth/clear-cookies",
  refresh: "/api/auth/refresh",
} as const;

// ─── Proxy absolute paths (for direct fetch() calls through Next.js proxy) ───
const _PROXY = "/api/backend";
export const PROXY_API = {
  authLogin: `${_PROXY}${API.auth}/login`,
  authMe: `${_PROXY}${API.auth}/me`,
  authLogout: `${_PROXY}${API.auth}/logout`,
  authRegisterRequestOtp: `${_PROXY}${API.auth}/register/request-otp`,
  authRegister: `${_PROXY}${API.auth}/register`,
} as const;

// startsWith prefix constants for path detection (e.g. TopBar breadcrumbs)
export const rolesSubPathPrefix = `${ROUTES.company.recruitment.roles}/`;
export const applicationsSubPathPrefix = `${ROUTES.company.recruitment.applications}/`;
export const offersSubPathPrefix = `${ROUTES.company.recruitment.offers}/`;
export const candidateReflectionPrefix = `${ROUTES.candidate.reflection}/`;
