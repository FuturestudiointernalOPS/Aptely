import { apiFetch } from "./apiHelper";
import {
  API,
  mkApiPath,
  withParams,
  onboardingTemplatesApi,
  onboardingChecklistInstantiateApi,
  analyticsPhase2OverviewApi,
  analyticsPhase2FunnelApi,
  analyticsPhase2TimeToHireApi,
  offersPendingApprovalsApi,
  decisionsActionQueueApi,
} from "@/lib/routes";
import { extractMatchScore } from "./api.utils";

export type OfferStatus = "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "COUNTER_OFFERED";

export interface OfferListItem {
  id: string;
  applicationId: string;
  status: OfferStatus;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
  roleTitle: string;
  candidate: { id: string; full_name: string; email: string } | null;
}

export interface OfferDetail extends OfferListItem {
  createdBy: string;
  latestPayload: {
    position: string;
    compensation: string;
    startDate: string;
    benefits?: string;
    notes?: string;
  } | null;
  latestVersion: {
    id: string;
    versionNo: number;
    payload_json: Record<string, unknown>;
    change_reason: string | null;
    created_at: string;
  } | null;
}

export interface OfferVersion {
  id: string;
  version_no: number;
  payload_json: Record<string, unknown>;
  change_reason: string | null;
  author_id: string;
  created_at: string;
}

export async function listOffers(params?: {
  page?: number;
  limit?: number;
  status?: OfferStatus;
}): Promise<{ data: OfferListItem[]; meta: { total: number; page: number; limit: number } }> {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.status) query.set("status", params.status);

  const qs = query.toString();
  const res = await apiFetch(qs ? withParams(API.offers, qs) : API.offers, "HR");
  if (!res) return { data: [], meta: { total: 0, page: 1, limit: 20 } };

  if (Array.isArray(res)) {
    return { data: res, meta: { total: res.length, page: params?.page || 1, limit: params?.limit || 20 } };
  }
  return res as any;
}

export async function createOffer(
  applicationId: string,
  payload: { position: string; compensation: string; startDate: string; benefits?: string; notes?: string }
): Promise<{ offer: OfferListItem; version: OfferVersion } | null> {
  const res = await apiFetch(API.offers, "HR", {
    method: "POST",
    body: JSON.stringify({ applicationId, payload }),
  });
  return res || null;
}

export async function getOfferById(offerId: string): Promise<OfferDetail | null> {
  const res = await apiFetch(mkApiPath(`/offers/${offerId}`), "HR");
  return res || null;
}

export async function updateOffer(
  offerId: string,
  payload: { position: string; compensation: string; startDate: string; benefits?: string; notes?: string },
  changeReason?: string
): Promise<{ offerId: string; currentVersion: number; version: OfferVersion } | null> {
  const res = await apiFetch(mkApiPath(`/offers/${offerId}`), "HR", {
    method: "PATCH",
    body: JSON.stringify({ payload, changeReason }),
  });
  return res || null;
}

export async function updateOfferStatus(offerId: string, status: OfferStatus): Promise<boolean> {
  const res = await apiFetch(mkApiPath(`/offers/${offerId}/status`), "HR", {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  return !!res;
}

export async function getOfferVersions(offerId: string): Promise<OfferVersion[]> {
  const res = await apiFetch(mkApiPath(`/offers/${offerId}/versions`), "HR");
  return Array.isArray(res) ? res : [];
}

type OnboardingStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED";
export type OnboardingTaskStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";

export interface OnboardingTemplate {
  id: string;
  name: string;
  description: string | null;
  tasks_json: Array<{ title: string; description?: string; assigneeType?: string; position?: number }>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface OnboardingTask {
  id: string;
  title: string;
  description: string | null;
  assignee_type: "CANDIDATE" | "HR";
  position: number;
  status: OnboardingTaskStatus;
  due_date: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
}

export interface OnboardingDocument {
  id: string;
  task_id: string | null;
  file_name: string;
  mime_type: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

export interface OnboardingChecklist {
  id: string;
  application_id: string;
  template_id: string | null;
  status: OnboardingStatus;
  created_at: string;
  updated_at: string;
  tasks: OnboardingTask[];
  documents: OnboardingDocument[];
  progress: { total: number; completed: number; percentage: number };
}

export async function listOnboardingTemplates(params?: {
  page?: number;
  limit?: number;
}): Promise<{ data: OnboardingTemplate[]; meta: { total: number; page: number; limit: number } }> {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));

  const qs = query.toString();
  const res = await apiFetch(qs ? withParams(onboardingTemplatesApi, qs) : onboardingTemplatesApi, "HR");
  if (!res) return { data: [], meta: { total: 0, page: 1, limit: 20 } };

  if (Array.isArray(res)) {
    return { data: res, meta: { total: res.length, page: params?.page || 1, limit: params?.limit || 20 } };
  }
  return res as any;
}

export async function createOnboardingTemplate(
  name: string,
  tasks: Array<{ title: string; description?: string; assigneeType?: "CANDIDATE" | "HR" }>,
  description?: string
): Promise<OnboardingTemplate | null> {
  const res = await apiFetch(onboardingTemplatesApi, "HR", {
    method: "POST",
    body: JSON.stringify({ name, description, tasks }),
  });
  return res || null;
}

export async function updateOnboardingTemplate(
  templateId: string,
  data: { name?: string; description?: string; tasks?: Array<{ title: string; description?: string; assigneeType?: "CANDIDATE" | "HR" }> }
): Promise<OnboardingTemplate | null> {
  const res = await apiFetch(mkApiPath(`/onboarding/templates/${templateId}`), "HR", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  return res || null;
}

export async function deleteOnboardingTemplate(templateId: string): Promise<boolean> {
  const res = await apiFetch(mkApiPath(`/onboarding/templates/${templateId}`), "HR", {
    method: "DELETE",
  });
  return !!res;
}

export async function instantiateOnboardingChecklist(
  applicationId: string,
  templateId: string
): Promise<{ checklist: OnboardingChecklist; tasks: OnboardingTask[] } | null> {
  const res = await apiFetch(onboardingChecklistInstantiateApi, "HR", {
    method: "POST",
    body: JSON.stringify({ applicationId, templateId }),
  });
  return res || null;
}

export async function getOnboardingChecklist(applicationId: string): Promise<OnboardingChecklist | null> {
  const res = await apiFetch(mkApiPath(`/onboarding/checklists/${applicationId}`), "HR");
  return res || null;
}

export async function updateOnboardingTaskStatus(
  taskId: string,
  status: OnboardingTaskStatus
): Promise<{ data: OnboardingTask; checklistStatus: OnboardingStatus } | null> {
  const res = await apiFetch(mkApiPath(`/onboarding/tasks/${taskId}/status`), "HR", {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  return res || null;
}

export async function generateOfferPdf(offerId: string, expiresInHours = 168): Promise<{
  documentId: string;
  token: string;
  tokenExpiresAt: string;
  portalUrl: string;
  downloadUrl: string;
} | null> {
  const res = await apiFetch(mkApiPath(`/offers/${offerId}/generate-pdf`), "HR", {
    method: "POST",
    body: JSON.stringify({ expiresInHours }),
  });
  return res || null;
}

export async function getPublicOfferByToken(token: string): Promise<any | null> {
  const res = await apiFetch(mkApiPath(`/offers/public/${token}`), "none", {
    method: "GET",
  });
  if (!res) return null;

  return {
    id: res.offerId,
    offerId: res.offerId,
    status: res.status,
    expiresAt: res.tokenExpiresAt ?? null,
    roleTitle: res.roleTitle,
    institution: {
      name: res.institutionName,
    },
    candidate: res.candidate,
    latestVersion: res.latestVersion
      ? {
          ...res.latestVersion,
          payload: res.latestVersion.payload_json ?? null,
        }
      : null,
  };
}

export async function publicAcceptOffer(token: string): Promise<boolean> {
  const res = await apiFetch(mkApiPath(`/offers/public/${token}/accept`), "none", { method: "POST" });
  return !!res;
}

export async function publicRejectOffer(token: string): Promise<boolean> {
  const res = await apiFetch(mkApiPath(`/offers/public/${token}/reject`), "none", { method: "POST" });
  return !!res;
}

export async function publicCounterOffer(
  token: string,
  payload: Record<string, unknown>,
  message?: string
): Promise<boolean> {
  const res = await apiFetch(mkApiPath(`/offers/public/${token}/counter`), "none", {
    method: "POST",
    body: JSON.stringify({ payload, message }),
  });
  return !!res;
}

export async function acceptOffer(offerId: string): Promise<boolean> {
  const res = await apiFetch(mkApiPath(`/offers/${offerId}/accept`), "HR", { method: "POST" });
  return !!res;
}

export async function rejectOffer(offerId: string): Promise<boolean> {
  const res = await apiFetch(mkApiPath(`/offers/${offerId}/reject`), "HR", { method: "POST" });
  return !!res;
}

export interface OnboardingSigningStep {
  id: string;
  position: number;
  signer_role: string;
  signer_user_id: string | null;
  status: "PENDING" | "SIGNED" | "REJECTED";
  signed_at: string | null;
  signature_token?: string | null;
  profiles?: { email: string; full_name: string } | null;
}

export async function getOnboardingDocumentSigningChain(docId: string): Promise<OnboardingSigningStep[]> {
  const res = await apiFetch(mkApiPath(`/onboarding/documents/${docId}/signing-chain`), "HR");
  if (!res) return [];
  const data = res.data ?? res;
  return Array.isArray(data) ? data : [];
}

export async function initOnboardingDocumentSigningChain(
  docId: string,
  signers: Array<{ signer_role: string; signer_user_id?: string }>
): Promise<OnboardingSigningStep[]> {
  const res = await apiFetch(mkApiPath(`/onboarding/documents/${docId}/signing-chain`), "HR", {
    method: "POST",
    body: JSON.stringify({ signers }),
  });
  if (!res) return [];
  const data = res.data ?? res;
  return Array.isArray(data) ? data : [];
}

export async function signOnboardingDocumentStep(docId: string, position: number): Promise<boolean> {
  const res = await apiFetch(mkApiPath(`/onboarding/documents/${docId}/signing-chain/${position}/sign`), "HR", {
    method: "POST",
    body: JSON.stringify({ signature_meta: {} }),
  });
  return !!res;
}

export async function verifyOnboardingDocument(
  id: string,
  status: "VERIFIED" | "REJECTED",
  notes?: string
): Promise<boolean> {
  const res = await apiFetch(mkApiPath(`/onboarding/documents/${id}/verify`), "HR", {
    method: "PATCH",
    body: JSON.stringify({ status, notes }),
  });
  return !!res;
}

export async function getPhase2Overview(): Promise<{
  applications: number;
  interviews: number;
  offers: number;
  acceptedOffers: number;
  onboardingChecklists: number;
} | null> {
  const res = await apiFetch(analyticsPhase2OverviewApi, "HR");
  return res || null;
}

export async function getPhase2Funnel(): Promise<{
  applied: number;
  decided: number;
  offersSent: number;
  offersAccepted: number;
  onboardingStarted: number;
} | null> {
  const res = await apiFetch(analyticsPhase2FunnelApi, "HR");
  return res || null;
}

export async function getPhase2TimeToHire(): Promise<{
  samples: number;
  averageDays: number;
  medianDays: number;
} | null> {
  const res = await apiFetch(analyticsPhase2TimeToHireApi, "HR");
  return res || null;
}

// ─── Offer Approval Chain ─────────────────────────────────────────────────────

export interface OfferApprovalStep {
  id: string;
  step: number;
  required_role: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  approver_user_id: string | null;
  comment: string | null;
  decided_at: string | null;
  created_at: string;
  profiles?: { full_name: string; email: string } | null;
}

export async function getOfferApprovalChain(offerId: string): Promise<OfferApprovalStep[]> {
  const res = await apiFetch(mkApiPath(`/offers/${offerId}/approvals`), "HR");
  return Array.isArray(res) ? res : [];
}

export async function createOfferApprovalChain(
  offerId: string,
  steps: Array<{ required_role: string }>
): Promise<OfferApprovalStep[]> {
  const res = await apiFetch(mkApiPath(`/offers/${offerId}/approval-chain`), "HR", {
    method: "POST",
    body: JSON.stringify({ steps }),
  });
  return Array.isArray(res) ? res : [];
}

export async function approveOfferStep(
  offerId: string,
  step: number,
  comment?: string
): Promise<OfferApprovalStep | null> {
  const res = await apiFetch(mkApiPath(`/offers/${offerId}/approvals/${step}/approve`), "HR", {
    method: "POST",
    body: JSON.stringify({ comment }),
  });
  return res || null;
}

export async function rejectOfferStep(
  offerId: string,
  step: number,
  comment?: string
): Promise<OfferApprovalStep | null> {
  const res = await apiFetch(mkApiPath(`/offers/${offerId}/approvals/${step}/reject`), "HR", {
    method: "POST",
    body: JSON.stringify({ comment }),
  });
  return res || null;
}

export interface OfferCounterHistoryEntry {
  id: string;
  round: number;
  proposed_by: "HR" | "CANDIDATE";
  counter_terms: Record<string, unknown>;
  reason: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  responded_by: string | null;
  responded_at: string | null;
  created_at: string;
}

export async function getOfferCounterHistory(offerId: string): Promise<OfferCounterHistoryEntry[]> {
  const res = await apiFetch(mkApiPath(`/offers/${offerId}/counter-history`), "HR");
  return Array.isArray(res) ? res : [];
}

export interface PendingApprovalOffer {
  id: string;
  applicationId: string;
  roleTitle: string;
  candidate: { id: string; full_name: string; email: string } | null;
  currentVersion: number;
  pendingStep: number;
  requiredRole: string;
  createdAt: string;
}

export async function getPendingApprovalOffers(): Promise<PendingApprovalOffer[]> {
  const res = await apiFetch(offersPendingApprovalsApi, "HR");
  return Array.isArray(res) ? res : [];
}

export interface ActionQueueItem {
  id: string;
  status: string;
  matchScore: number | null;
  createdAt: string;
  candidateName: string | null;
  profile: { id: string; full_name: string; email: string } | null;
  role: { id: string; title: string } | null;
}

export interface ActionQueue {
  pendingRecommendation: ActionQueueItem[];
  pendingDecision: ActionQueueItem[];
  pendingRatification: ActionQueueItem[];
}

export async function getActionQueue(): Promise<ActionQueue> {
  const res = await apiFetch(decisionsActionQueueApi, "HR");
  if (!res || typeof res !== "object") {
    return { pendingRecommendation: [], pendingDecision: [], pendingRatification: [] };
  }
  const normalizeScore = (item: any): ActionQueueItem => ({
    ...item,
    matchScore: extractMatchScore(item) ?? null,
  });
  return {
    pendingRecommendation: Array.isArray(res.pendingRecommendation) ? res.pendingRecommendation.map(normalizeScore) : [],
    pendingDecision: Array.isArray(res.pendingDecision) ? res.pendingDecision.map(normalizeScore) : [],
    pendingRatification: Array.isArray(res.pendingRatification) ? res.pendingRatification.map(normalizeScore) : [],
  };
}
