import { Response } from "express";
import { isApprovalChainCleared } from "./offer-approvals.controller";
import { createNotification, NOTIF_LINKS, NOTIF_TITLES } from "@/modules/notifications/notifications.service";
import { supabaseAdmin } from "@/config/supabase";
import { env } from "@/config/env";
import { sendEmailDirect } from "@/services/email.service";
import { AppError } from "@/middleware/error.middleware";
import { writeAuditLog } from "@/middleware/audit.middleware";
import { asyncHandler, paginate } from "@/utils/helpers";
import {
  STORAGE_BUCKETS,
  buildStoragePath,
  uploadFile,
  getSignedUrl,
  ensureBucketExistsOrThrow,
} from "@/services/storage.service";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import crypto from "crypto";
import PDFDocument from "pdfkit";
import type {
  CreateOfferInput,
  UpdateOfferInput,
  UpdateOfferStatusInput,
  ListOffersQuery,
  GenerateOfferPdfInput,
  CounterOfferInput,
} from "./offers.schema";
import {
  OFFER_VALID_TRANSITIONS,
  resolveOfferActorType,
  assertApplicationInstitution,
  assertOfferInstitution,
  assertOfferAccessByUser,
  getOfferCounterData,
  extractRoleDna,
  renderPdfField,
  writeOfferAudit,
  autoInstantiateOnboardingChecklist,
  resolveOfferByPublicToken,
  resolveOfferTerminalAction,
} from "./offers.service";

// ─── POST /offers ─────────────────────────────────────────────────────────────

export const createOffer = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    if (!user.institutionId) throw new AppError(403, "You are not linked to any institution");

    const { applicationId, payload } = req.body as CreateOfferInput;

    await assertApplicationInstitution(applicationId, user.institutionId, supabaseAdmin);

    const { data: existing } = await supabaseAdmin
      .from("offers")
      .select("id")
      .eq("application_id", applicationId)
      .maybeSingle();

    if (existing) {
      throw new AppError(409, "An offer already exists for this application");
    }

    const { data: offer, error: offerError } = await supabaseAdmin
      .from("offers")
      .insert({
        application_id: applicationId,
        status: "DRAFT",
        current_version: 1,
        created_by: user.id,
      })
      .select("id, status, current_version, created_at")
      .single();

    if (offerError || !offer) {
      throw new AppError(500, "Failed to create offer");
    }

    const { data: version, error: versionError } = await supabaseAdmin
      .from("offer_versions")
      .insert({
        offer_id: offer.id,
        version_no: 1,
        payload_json: payload,
        change_reason: "Initial offer creation",
        author_id: user.id,
      })
      .select("id, version_no, payload_json, created_at")
      .single();

    if (versionError || !version) {
      await supabaseAdmin.from("offers").delete().eq("id", offer.id);
      throw new AppError(500, "Failed to create offer version");
    }

    await writeAuditLog(applicationId, "OFFER_CREATED", user.id, {
      offerId: offer.id,
      versionNo: 1,
      payload,
    });

    res.status(201).json({
      message: "Offer created successfully",
      data: {
        offer: {
          id: offer.id,
          applicationId,
          status: offer.status,
          currentVersion: offer.current_version,
          createdAt: offer.created_at,
        },
        version: {
          id: version.id,
          versionNo: version.version_no,
          payload: version.payload_json,
          createdAt: version.created_at,
        },
      },
    });
  }
);

// ─── PATCH /offers/:id ────────────────────────────────────────────────────────

export const updateOffer = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    if (!user.institutionId) throw new AppError(403, "You are not linked to any institution");

    const offerId = req.params["id"] as string;
    const { payload, changeReason } = req.body as UpdateOfferInput;

    const offer = await assertOfferInstitution(offerId, user.institutionId, supabaseAdmin);

    if (offer.status !== "DRAFT") {
      throw new AppError(422, `Cannot update an offer with status '${offer.status}'. Only DRAFT offers can be edited.`);
    }

    const newVersionNo = offer.current_version + 1;

    const { data: version, error: versionError } = await supabaseAdmin
      .from("offer_versions")
      .insert({
        offer_id: offerId,
        version_no: newVersionNo,
        payload_json: payload,
        change_reason: changeReason || null,
        author_id: user.id,
      })
      .select("id, version_no, payload_json, change_reason, created_at")
      .single();

    if (versionError || !version) {
      throw new AppError(500, "Failed to create new offer version");
    }

    const { error: updateError } = await supabaseAdmin
      .from("offers")
      .update({ current_version: newVersionNo })
      .eq("id", offerId);

    if (updateError) {
      throw new AppError(500, "Failed to update offer version counter");
    }

    await writeAuditLog(offer.application_id, "OFFER_VERSIONED", user.id, {
      offerId,
      versionNo: newVersionNo,
      changeReason: changeReason || null,
    });

    res.status(200).json({
      message: "Offer updated successfully",
      data: {
        offerId,
        currentVersion: newVersionNo,
        version: {
          id: version.id,
          versionNo: version.version_no,
          payload: version.payload_json,
          changeReason: version.change_reason,
          createdAt: version.created_at,
        },
      },
    });
  }
);

// ─── PATCH /offers/:id/status ─────────────────────────────────────────────────

export const updateOfferStatus = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    if (!user.institutionId) throw new AppError(403, "You are not linked to any institution");

    const offerId = req.params["id"] as string;
    const { status } = req.body as UpdateOfferStatusInput;

    const offer = await assertOfferInstitution(offerId, user.institutionId, supabaseAdmin);

    const allowed = OFFER_VALID_TRANSITIONS[offer.status] || [];
    if (!allowed.includes(status)) {
      throw new AppError(
        422,
        `Cannot transition offer from '${offer.status}' to '${status}'. Allowed: ${allowed.join(", ") || "none"}`
      );
    }

    // Phase F gate: approval chain must be fully cleared before sending
    if (status === "SENT") {
      const cleared = await isApprovalChainCleared(offerId);
      if (!cleared) {
        throw new AppError(422, "Offer cannot be sent: approval chain has pending or rejected steps");
      }
    }

    const updatePayload: Record<string, unknown> = { status };
    if (status === "SENT") {
      // Auto-expire after 30 days if not responded
      updatePayload.expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    const { error: updateError } = await supabaseAdmin
      .from("offers")
      .update(updatePayload)
      .eq("id", offerId);

    if (updateError) throw new AppError(500, "Failed to update offer status");

    await writeAuditLog(offer.application_id, "OFFER_STATUS_CHANGED", user.id, {
      offerId,
      previousStatus: offer.status,
      newStatus: status,
    });

    // Notify candidate when offer is sent
    if (status === "SENT") {
      void (async () => {
        const { data: app } = await supabaseAdmin
          .from("applications")
          .select("candidate_id")
          .eq("id", offer.application_id)
          .single();
        if (app?.candidate_id) {
          await createNotification({
            userId: app.candidate_id,
            type: "OFFER_RECEIVED",
            title: NOTIF_TITLES.OFFER_RECEIVED,
            link: NOTIF_LINKS.candidateOffers,
          });
        }
      })();
    }

    res.status(200).json({
      message: `Offer status updated to ${status}`,
      data: { offerId, status },
    });
  }
);

// ─── GET /offers/:id ──────────────────────────────────────────────────────────

export const getOffer = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    if (!user.institutionId) throw new AppError(403, "You are not linked to any institution");

    const offerId = req.params["id"] as string;

    const { data: offer, error } = await supabaseAdmin
      .from("offers")
      .select(
        `id, application_id, status, current_version, created_by, created_at, updated_at,
        applications!inner(
          id, status, candidate_id,
          roles!inner(institution_id, role_dna(full_form_json)),
          profiles!candidate_id(id, full_name, email)
        )`
      )
      .eq("id", offerId)
      .single();

    if (error || !offer) throw new AppError(404, "Offer not found");

    const appData = offer.applications as unknown;
    const app = Array.isArray(appData) ? appData[0] : (appData as any);

    if (!app) throw new AppError(404, "Offer not found");

    const roleData = app.roles as unknown;
    const role = Array.isArray(roleData) ? roleData[0] : (roleData as any);

    if (!role || role.institution_id !== user.institutionId) {
      throw new AppError(404, "Offer not found");
    }

    const { data: latestVersion } = await supabaseAdmin
      .from("offer_versions")
      .select("id, version_no, payload_json, change_reason, author_id, created_at")
      .eq("offer_id", offerId)
      .order("version_no", { ascending: false })
      .limit(1)
      .single();

    const fullForm = extractRoleDna(app.roles.role_dna);

    // Fetch candidate profile via supabaseAdmin (bypass RLS — HR needs to see candidate name)
    let candidateProfile = Array.isArray(app.profiles) ? app.profiles[0] : app.profiles;
    if (!candidateProfile && app.candidate_id) {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", app.candidate_id)
        .maybeSingle();
      candidateProfile = prof ?? null;
    }

    res.status(200).json({
      data: {
        id: offer.id,
        applicationId: offer.application_id,
        status: offer.status,
        currentVersion: offer.current_version,
        createdBy: offer.created_by,
        createdAt: offer.created_at,
        updatedAt: offer.updated_at,
        candidate: candidateProfile,
        roleTitle: (fullForm as Record<string, unknown>).title || "Untitled Role",
        latestPayload: latestVersion?.payload_json || null,
        latestVersion: latestVersion || null,
      },
    });
  }
);

// ─── GET /offers/:id/versions ─────────────────────────────────────────────────

export const getOfferVersions = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    if (!user.institutionId) throw new AppError(403, "You are not linked to any institution");

    const offerId = req.params["id"] as string;

    await assertOfferInstitution(offerId, user.institutionId, supabaseAdmin);

    const { data: versions, error } = await supabaseAdmin
      .from("offer_versions")
      .select("id, version_no, payload_json, change_reason, author_id, created_at")
      .eq("offer_id", offerId)
      .order("version_no", { ascending: false });

    if (error) throw new AppError(500, "Failed to fetch offer versions");

    res.status(200).json({ data: versions ?? [] });
  }
);

// ─── GET /offers ──────────────────────────────────────────────────────────────

export const listOffers = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    if (!user.institutionId) throw new AppError(403, "You are not linked to any institution");

    const query = (res.locals["query"] ?? req.query) as ListOffersQuery;
    const { page, limit, status } = query;
    const { offset, limit: take } = paginate(String(page), String(limit), 20);

    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("roles")
      .select("id")
      .eq("institution_id", user.institutionId);

    if (rolesError) throw new AppError(500, "Failed to fetch roles");

    const roleIds = (roles ?? []).map((r) => r.id);
    if (roleIds.length === 0) {
      res.status(200).json({ data: [], meta: { total: 0, page, limit: take } });
      return;
    }

    const { data: apps } = await supabaseAdmin
      .from("applications")
      .select("id")
      .in("role_id", roleIds);

    const appIds = (apps ?? []).map((a) => a.id);
    if (appIds.length === 0) {
      res.status(200).json({ data: [], meta: { total: 0, page, limit: take } });
      return;
    }

    // Use supabaseAdmin to bypass RLS on profiles (candidate names)
    let offersQuery = supabaseAdmin
      .from("offers")
      .select(
        `id, application_id, status, current_version, created_at, updated_at,
        applications!inner(
          id,
          roles(role_dna(full_form_json)),
          profiles!candidate_id(id, full_name, email)
        )`,
        { count: "exact" }
      )
      .in("application_id", appIds)
      .order("created_at", { ascending: false })
      .range(offset, offset + take - 1);

    if (status) {
      offersQuery = offersQuery.eq("status", status);
    }

    const { data, error, count } = await offersQuery;

    if (error) throw new AppError(500, "Failed to fetch offers");

    const normalized = (data ?? []).map((offer: Record<string, unknown>) => {
      const app = offer.applications as Record<string, unknown>;
      const roleData = app?.roles as Record<string, unknown> | undefined;
      const fullForm = extractRoleDna(roleData?.role_dna);

      return {
        id: offer.id,
        applicationId: offer.application_id,
        status: offer.status,
        currentVersion: offer.current_version,
        createdAt: offer.created_at,
        updatedAt: offer.updated_at,
        roleTitle: fullForm?.title || "Untitled Role",
        candidate: app?.profiles || null,
      };
    });

    res.status(200).json({
      data: normalized,
      meta: { total: count ?? 0, page, limit: take },
    });
  }
);

// ─── POST /offers/:id/generate-pdf ───────────────────────────────────────────

export const generateOfferPdf = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    if (!user.institutionId) throw new AppError(403, "You are not linked to any institution");

    const offerId = req.params["id"] as string;
    const { expiresInHours } = req.body as GenerateOfferPdfInput;

    const offer = await assertOfferInstitution(offerId, user.institutionId, supabaseAdmin);

    const { data: version, error: versionError } = await supabaseAdmin
      .from("offer_versions")
      .select("version_no, payload_json")
      .eq("offer_id", offerId)
      .eq("version_no", offer.current_version)
      .single();

    if (versionError || !version) throw new AppError(404, "Offer version not found");

    const payload = (version.payload_json as Record<string, unknown>) ?? {};

    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 60, size: "A4" });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.fontSize(20).font("Helvetica-Bold").text("APTELY OFFER LETTER", { align: "center" });
      doc.moveDown(0.5);
      doc.moveTo(60, doc.y).lineTo(535, doc.y).stroke();
      doc.moveDown(1);

      renderPdfField(doc, "Position", payload.position);
      renderPdfField(doc, "Compensation", payload.compensation);
      renderPdfField(doc, "Start Date", payload.startDate);
      renderPdfField(doc, "Benefits", payload.benefits);
      if (payload.notes) renderPdfField(doc, "Notes", payload.notes);

      doc.moveDown(1);
      doc.fontSize(9).font("Helvetica").fillColor("grey")
        .text(`Generated at: ${new Date().toISOString()}`, { align: "right" });

      doc.end();
    });

    const fileName = `offer-v${version.version_no}.pdf`;
    const storagePath = buildStoragePath("offers", offerId, `${Date.now()}-${fileName}`);
    await ensureBucketExistsOrThrow(STORAGE_BUCKETS.OFFER_DOCUMENTS);
    const uploaded = await uploadFile(
      STORAGE_BUCKETS.OFFER_DOCUMENTS,
      storagePath,
      pdfBuffer,
      "application/pdf"
    );

    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + (expiresInHours ?? 168) * 60 * 60 * 1000).toISOString();

    const { data: document, error: documentError } = await supabaseAdmin
      .from("offer_documents")
      .insert({
        offer_id: offerId,
        storage_path: uploaded.path,
        file_type: "PDF",
        public_token: token,
        token_expires_at: expiresAt,
        generated_by: user.id,
      })
      .select("id, public_token, token_expires_at, created_at")
      .single();

    if (documentError || !document) throw new AppError(500, "Failed to create offer document record");

    await writeOfferAudit(offerId, "OFFER_PDF_GENERATED", user.id, {
      documentId: document.id,
      storagePath: uploaded.path,
    }, supabaseAdmin);

    const downloadUrl = await getSignedUrl(STORAGE_BUCKETS.OFFER_DOCUMENTS, uploaded.path, 3600);

    res.status(201).json({
      data: {
        documentId: document.id,
        token: document.public_token,
        tokenExpiresAt: document.token_expires_at,
        portalUrl: `${env.FRONTEND_URL}/offers/public/${document.public_token}`,
        downloadUrl,
      },
    });
  }
);

// ─── POST /offers/:id/counter ─────────────────────────────────────────────────

export const counterOffer = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    const offerId = req.params["id"] as string;
    const { payload, message } = req.body as CounterOfferInput;

    const access = await assertOfferAccessByUser(offerId, user);
    if (access.offer.status !== "SENT") {
      throw new AppError(422, "Counter-offer is only allowed when offer status is SENT");
    }

    const actorType = resolveOfferActorType(user);

    const { data: maxRound } = await supabaseAdmin
      .from("offer_counter_history")
      .select("round")
      .eq("offer_id", offerId)
      .order("round", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextRound = (maxRound?.round ?? 0) + 1;

    const { data: counter, error } = await supabaseAdmin
      .from("offer_counter_history")
      .insert({
        offer_id: offerId,
        round: nextRound,
        proposed_by: actorType,
        counter_terms: payload,
        reason: message || null,
        status: "PENDING",
      })
      .select("id, round, proposed_by, counter_terms, reason, status, created_at")
      .single();

    if (error || !counter) throw new AppError(500, "Failed to create counter-offer");

    // Update offer: status → COUNTER_OFFERED, track counter state
    const { error: updateErr } = await supabaseAdmin
      .from("offers")
      .update({
        status: "COUNTER_OFFERED",
        counter_status: "PENDING",
        counter_round: nextRound,
        counter_terms: payload,
        counter_reason: message || null,
        latest_counter_id: counter.id,
      })
      .eq("id", offerId);

    if (updateErr) throw new AppError(500, "Failed to update offer status");

    const { error: negError } = await supabaseAdmin.from("offer_negotiations").insert({
      offer_id: offerId,
      actor_type: actorType,
      actor_id: user.id,
      proposed_payload_json: payload,
      message: message || null,
      status: "PENDING",
    });
    if (negError) console.warn("[Offers] Failed to mirror counter to negotiations:", negError.message);

    await writeOfferAudit(offerId, "OFFER_COUNTERED", user.id, {
      counterId: counter.id,
      round: nextRound,
      status: "COUNTER_OFFERED",
    }, supabaseAdmin);

    // Return in Negotiation format so candidate UI can append it to history
    res.status(201).json({
      data: {
        id: counter.id,
        actor_type: actorType,
        proposed_payload_json: payload,
        message: message || null,
        status: counter.status,
        created_at: counter.created_at,
      },
    });
  }
);

export const acceptOffer = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    await resolveOfferTerminalAction(req, res, "ACCEPTED");
  }
);

export const rejectOffer = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    await resolveOfferTerminalAction(req, res, "REJECTED");
  }
);

// ─── HR Counter-Offer Response (approve/reject counter) ──────────────────────

export const approveCounterOffer = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    const offerId = req.params["id"] as string;
    const { reason } = req.body as { reason?: string };

    const access = await assertOfferAccessByUser(offerId, user);
    if (access.offer.status !== "COUNTER_OFFERED") {
      throw new AppError(422, `Cannot approve counter: offer is ${access.offer.status}, not COUNTER_OFFERED`);
    }

    const { counterTerms } = getOfferCounterData(access.offer as Record<string, unknown>);
    const currentVersionNo = access.offer.current_version;
    const newVersionNo = currentVersionNo + 1;

    // Approving a counter-offer means the negotiated terms become the offer's
    // official terms — merge them into a new version so PDF/portal/signing chain
    // reflect what the candidate actually agreed to (not the stale pre-negotiation values).
    const { data: currentVersion } = await supabaseAdmin
      .from("offer_versions")
      .select("payload_json")
      .eq("offer_id", offerId)
      .eq("version_no", currentVersionNo)
      .single();

    const mergedPayload = {
      ...((currentVersion?.payload_json as Record<string, unknown>) ?? {}),
      ...counterTerms,
    };

    const { error: versionErr } = await supabaseAdmin
      .from("offer_versions")
      .insert({
        offer_id: offerId,
        version_no: newVersionNo,
        payload_json: mergedPayload,
        change_reason: reason || "Counter-offer approved by HR — terms updated to negotiated values",
        author_id: user.id,
      });

    if (versionErr) throw new AppError(500, "Failed to create offer version for approved counter-offer");

    // Update offer: mark counter approved, point to the new negotiated version, revert to SENT
    const { error: updateErr } = await supabaseAdmin
      .from("offers")
      .update({
        status: "SENT",
        current_version: newVersionNo,
        counter_status: "APPROVED",
        counter_terms: null,
        counter_reason: null,
        counter_responded_by: user.id,
        counter_responded_at: new Date().toISOString(),
      })
      .eq("id", offerId);

    if (updateErr) throw new AppError(500, "Failed to approve counter-offer");

    // Log to counter_history
    const { counterRound: currentRound } = getOfferCounterData(access.offer as Record<string, unknown>);
    await supabaseAdmin
      .from("offer_counter_history")
      .insert({
        offer_id: offerId,
        round: currentRound + 1,
        proposed_by: "HR",
        counter_terms: {},
        reason: reason || "Counter-offer approved by HR",
        status: "APPROVED",
        responded_by: user.id,
        responded_at: new Date().toISOString(),
      });

    await writeOfferAudit(offerId, "COUNTER_APPROVED", user.id, {
      reason,
      newTerms: counterTerms,
      newVersion: newVersionNo,
    }, supabaseAdmin);

    res.status(200).json({
      data: {
        offerId,
        status: "SENT",
        counterStatus: "APPROVED",
        currentVersion: newVersionNo,
        updatedTerms: mergedPayload,
      },
    });
  }
);

export const rejectCounterOffer = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    const offerId = req.params["id"] as string;
    const { reason } = req.body as { reason?: string };

    const access = await assertOfferAccessByUser(offerId, user);
    if (access.offer.status !== "COUNTER_OFFERED") {
      throw new AppError(422, `Cannot reject counter: offer is ${access.offer.status}, not COUNTER_OFFERED`);
    }

    // Revert to SENT (original terms stand), clear counter state
    const { error: updateErr } = await supabaseAdmin
      .from("offers")
      .update({
        status: "SENT",
        counter_status: "REJECTED",
        counter_terms: null,
        counter_reason: null,
        counter_responded_by: user.id,
        counter_responded_at: new Date().toISOString(),
      })
      .eq("id", offerId);

    if (updateErr) throw new AppError(500, "Failed to reject counter-offer");

    // Log to counter_history
    const { counterRound: currentRound } = getOfferCounterData(access.offer as Record<string, unknown>);
    await supabaseAdmin
      .from("offer_counter_history")
      .insert({
        offer_id: offerId,
        round: currentRound + 1,
        proposed_by: "HR",
        counter_terms: {},
        reason: reason || "Counter-offer rejected by HR",
        status: "REJECTED",
        responded_by: user.id,
        responded_at: new Date().toISOString(),
      });

    await writeOfferAudit(offerId, "COUNTER_REJECTED", user.id, {
      reason,
    }, supabaseAdmin);

    res.status(200).json({
      data: {
        offerId,
        status: "SENT",
        counterStatus: "REJECTED",
        message: "Candidate may accept original terms or counter again",
      },
    });
  }
);

// ─── Public token routes (no auth — use supabaseAdmin) ────────────────────────

export const getPublicOfferByToken = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const token = req.params["token"] as string;

    const { data: document, error } = await supabaseAdmin
      .from("offer_documents")
      .select(
        `id, offer_id, storage_path, token_expires_at, offers!inner(
          id, status, current_version,
          applications!inner(
            id,
            profiles!candidate_id(full_name, email),
            roles(role_dna(full_form_json), institutions(name))
          )
        )`
      )
      .eq("public_token", token)
      .single();

    if (error || !document) throw new AppError(404, "Offer portal link not found");
    if (new Date(document.token_expires_at).getTime() < Date.now()) {
      throw new AppError(410, "Offer portal link has expired");
    }

    const offerData = document.offers as unknown;
    const offer = Array.isArray(offerData) ? offerData[0] : (offerData as any);
    const appData = offer?.applications;
    const app = Array.isArray(appData) ? appData[0] : appData;
    const roleData = app?.roles;
    const role = Array.isArray(roleData) ? roleData[0] : roleData;
    const fullForm = extractRoleDna(role?.role_dna);
    const institutions = Array.isArray(role?.institutions) ? role.institutions[0] : role?.institutions;

    const { data: latestVersion } = await supabaseAdmin
      .from("offer_versions")
      .select("version_no, payload_json, created_at")
      .eq("offer_id", offer.id)
      .order("version_no", { ascending: false })
      .limit(1)
      .single();

    res.status(200).json({
      data: {
        offerId: offer.id,
        status: offer.status,
        institutionName: institutions?.name || "Aptely",
        roleTitle: fullForm.title || "Untitled Role",
        candidate: app?.profiles || null,
        latestVersion: latestVersion || null,
      },
    });
  }
);

export const publicAcceptOffer = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const token = req.params["token"] as string;
    const resolved = await resolveOfferByPublicToken(token);

    if (resolved.offer.status !== "SENT") {
      throw new AppError(422, `Cannot accept offer in status ${resolved.offer.status}`);
    }

    await supabaseAdmin.from("offers").update({ status: "ACCEPTED" }).eq("id", resolved.offerId);
    await supabaseAdmin.from("offer_negotiations").insert({
      offer_id: resolved.offerId,
      actor_type: "CANDIDATE",
      actor_id: null,
      proposed_payload_json: {},
      message: "Accepted from public portal",
      status: "ACCEPTED",
    });

    if (resolved.institutionId) {
      await autoInstantiateOnboardingChecklist(
        resolved.applicationId,
        resolved.institutionId,
        "00000000-0000-0000-0000-000000000000"
      );
    }

    if (resolved.createdBy) {
      void createNotification({
        userId: resolved.createdBy,
        institutionId: resolved.institutionId,
        type: "OFFER_ACCEPTED",
        title: NOTIF_TITLES.OFFER_ACCEPTED,
        body: resolved.roleTitle ?? null,
        link: NOTIF_LINKS.companyOffers,
      });
    }

    res.status(200).json({ data: { offerId: resolved.offerId, status: "ACCEPTED" } });
  }
);

export const publicRejectOffer = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const token = req.params["token"] as string;
    const resolved = await resolveOfferByPublicToken(token);

    if (resolved.offer.status !== "SENT") {
      throw new AppError(422, `Cannot reject offer in status ${resolved.offer.status}`);
    }

    await supabaseAdmin.from("offers").update({ status: "REJECTED" }).eq("id", resolved.offerId);
    await supabaseAdmin.from("offer_negotiations").insert({
      offer_id: resolved.offerId,
      actor_type: "CANDIDATE",
      actor_id: null,
      proposed_payload_json: {},
      message: "Rejected from public portal",
      status: "REJECTED",
    });

    if (resolved.createdBy) {
      void createNotification({
        userId: resolved.createdBy,
        institutionId: resolved.institutionId,
        type: "OFFER_REJECTED",
        title: NOTIF_TITLES.OFFER_REJECTED,
        body: resolved.roleTitle ?? null,
        link: NOTIF_LINKS.companyOffers,
      });
    }

    res.status(200).json({ data: { offerId: resolved.offerId, status: "REJECTED" } });
  }
);

export const publicCounterOffer = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const token = req.params["token"] as string;
    const { payload, message } = req.body as CounterOfferInput;
    const resolved = await resolveOfferByPublicToken(token);

    if (resolved.offer.status !== "SENT") {
      throw new AppError(422, `Cannot counter offer in status ${resolved.offer.status}`);
    }

    // Get current round count for this offer (mirrors authenticated counterOffer flow)
    const { data: maxRound } = await supabaseAdmin
      .from("offer_counter_history")
      .select("round")
      .eq("offer_id", resolved.offerId)
      .order("round", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextRound = (maxRound?.round ?? 0) + 1;

    const { data: counter, error: counterErr } = await supabaseAdmin
      .from("offer_counter_history")
      .insert({
        offer_id: resolved.offerId,
        round: nextRound,
        proposed_by: "CANDIDATE",
        counter_terms: payload,
        reason: message || null,
        status: "PENDING",
      })
      .select("id, round")
      .single();

    if (counterErr || !counter) throw new AppError(500, "Failed to submit counter-offer");

    const { error: updateErr } = await supabaseAdmin
      .from("offers")
      .update({
        status: "COUNTER_OFFERED",
        counter_status: "PENDING",
        counter_round: nextRound,
        counter_terms: payload,
        counter_reason: message || null,
        latest_counter_id: counter.id,
      })
      .eq("id", resolved.offerId);

    if (updateErr) throw new AppError(500, "Failed to update offer status");

    // Mirror into offer_negotiations so candidate history UI (getMyOffer) can display it
    const { data: negotiation, error } = await supabaseAdmin
      .from("offer_negotiations")
      .insert({
        offer_id: resolved.offerId,
        actor_type: "CANDIDATE",
        actor_id: null,
        proposed_payload_json: payload,
        message: message || "Counter-offer from public portal",
        status: "PENDING",
      })
      .select("id, status, created_at")
      .single();

    if (error || !negotiation) throw new AppError(500, "Failed to submit counter-offer");

    await writeOfferAudit(resolved.offerId, "OFFER_COUNTERED", "00000000-0000-0000-0000-000000000000", {
      counterId: counter.id,
      round: nextRound,
      status: "COUNTER_OFFERED",
      source: "PUBLIC_PORTAL",
    }, supabaseAdmin);

    if (resolved.createdBy) {
      void createNotification({
        userId: resolved.createdBy,
        institutionId: resolved.institutionId,
        type: "OFFER_COUNTERED",
        title: NOTIF_TITLES.OFFER_COUNTERED,
        body: resolved.roleTitle ?? null,
        link: NOTIF_LINKS.companyOffers,
      });
    }

    res.status(201).json({ data: negotiation });
  }
);

// ─── GET /offers/:id/counter-history ─────────────────────────────────────────

export const getPendingApprovals = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    const institutionId = req.workspace?.institutionId ?? user.activeInstitutionId ?? user.institutionId;
    if (!institutionId) throw new AppError(403, "Workspace context required");

    // Step 1 — role IDs for this institution (same pattern as listOffers)
    const { data: roles, error: rolesErr } = await supabaseAdmin
      .from("roles")
      .select("id")
      .eq("institution_id", institutionId);

    if (rolesErr) throw new AppError(500, "Failed to fetch roles");
    const roleIds = (roles ?? []).map((r) => r.id as string);
    if (roleIds.length === 0) {
      res.status(200).json({ data: [] });
      return;
    }

    // Step 2 — application IDs in those roles
    const { data: appRows, error: appsErr } = await supabaseAdmin
      .from("applications")
      .select("id, profiles:candidate_id(id, full_name, email), roles!inner(id, role_dna(full_form_json))")
      .in("role_id", roleIds);

    if (appsErr) throw new AppError(500, "Failed to fetch applications");
    const appIds = (appRows ?? []).map((a) => a.id as string);
    if (appIds.length === 0) {
      res.status(200).json({ data: [] });
      return;
    }

    // Step 3 — DRAFT offers for those applications
    const { data: offers, error: offersErr } = await supabaseAdmin
      .from("offers")
      .select("id, application_id, status, current_version, created_at")
      .eq("status", "DRAFT")
      .in("application_id", appIds);

    if (offersErr) throw new AppError(500, "Failed to fetch offers");
    if (!offers || offers.length === 0) {
      res.status(200).json({ data: [] });
      return;
    }

    const offerIds = offers.map((o) => o.id as string);

    // Step 4 — earliest PENDING approval step per offer
    const { data: pendingSteps, error: stepsErr } = await supabaseAdmin
      .from("offer_approvals")
      .select("offer_id, step, required_role")
      .in("offer_id", offerIds)
      .eq("status", "PENDING")
      .order("step", { ascending: true });

    if (stepsErr) throw new AppError(500, "Failed to fetch approval steps");

    const pendingByOffer = new Map<string, { step: number; required_role: string }>();
    for (const s of pendingSteps ?? []) {
      if (!pendingByOffer.has(s.offer_id as string)) {
        pendingByOffer.set(s.offer_id as string, {
          step: s.step as number,
          required_role: s.required_role as string,
        });
      }
    }

    // Build lookup maps
    const appById = new Map<string, Record<string, unknown>>();
    for (const a of appRows ?? []) {
      appById.set(a.id as string, a as Record<string, unknown>);
    }

    const result = offers
      .filter((o) => pendingByOffer.has(o.id as string))
      .map((o) => {
        const app = appById.get(o.application_id as string);
        const role = Array.isArray(app?.roles) ? (app.roles as any)[0] : app?.roles;
        const fullForm = extractRoleDna((role as Record<string, unknown> | undefined)?.role_dna);
        const candidate = Array.isArray(app?.profiles) ? (app.profiles as any)[0] : app?.profiles;
        const pending = pendingByOffer.get(o.id as string)!;
        return {
          id: o.id,
          applicationId: o.application_id,
          roleTitle: (fullForm?.title as string) || "Unknown Role",
          candidate: candidate
            ? { id: (candidate as any).id, full_name: (candidate as any).full_name, email: (candidate as any).email }
            : null,
          currentVersion: o.current_version,
          pendingStep: pending.step,
          requiredRole: pending.required_role,
          createdAt: o.created_at,
        };
      });

    res.status(200).json({ data: result });
  }
);

export const getCounterHistory = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    if (!user.institutionId) throw new AppError(403, "You are not linked to any institution");

    const offerId = req.params["id"] as string;
    await assertOfferInstitution(offerId, user.institutionId, supabaseAdmin);

    const { data, error } = await supabaseAdmin
      .from("offer_counter_history")
      .select("id, round, proposed_by, counter_terms, reason, status, created_at, responded_by, responded_at")
      .eq("offer_id", offerId)
      .order("round", { ascending: true });

    if (error) throw new AppError(500, "Failed to fetch counter history");

    res.status(200).json({ data: data ?? [] });
  }
);

// ─── Offer Signing Chain ──────────────────────────────────────────────────────

/**
 * POST /offers/:id/signing-chain
 * HR initialises the signing chain for an offer (candidate + optional HR steps).
 * Idempotent — returns existing chain if already created.
 */
export const initOfferSigningChain = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    if (!user.institutionId) throw new AppError(403, "Workspace context required");

    const offerId = req.params["id"] as string;
    await assertOfferInstitution(offerId, user.institutionId, supabaseAdmin);

    const { signers } = req.body as {
      signers: Array<{ signer_type: "CANDIDATE" | "HR"; signer_role?: string; signer_user_id?: string }>;
    };

    if (!Array.isArray(signers) || signers.length === 0) {
      throw new AppError(400, "At least one signer required");
    }

    // Idempotent: return existing chain.
    const { data: existing } = await supabaseAdmin
      .from("offer_signing_steps")
      .select("id, position, signer_type, signer_role, signer_user_id, status, signed_at, signature_token")
      .eq("offer_id", offerId)
      .order("position", { ascending: true });

    if (existing && existing.length > 0) {
      res.status(200).json({ data: existing });
      return;
    }

    const rows = signers.map((s, i) => ({
      offer_id: offerId,
      position: i + 1,
      signer_type: s.signer_type,
      signer_role: s.signer_role ?? null,
      signer_user_id: s.signer_user_id ?? null,
      status: "PENDING" as const,
      signature_token: s.signer_type === "CANDIDATE" ? `osign_${crypto.randomBytes(32).toString("hex")}` : null,
    }));

    const { data: created, error } = await supabaseAdmin
      .from("offer_signing_steps")
      .insert(rows)
      .select("id, position, signer_type, signer_role, signer_user_id, status, signed_at, signature_token");

    if (error || !created) throw new AppError(500, "Failed to create signing chain");

    // Send candidate signing link via email
    const candidateStep = created.find((s) => s.signer_type === "CANDIDATE" && s.signature_token);
    if (candidateStep?.signature_token) {
      const { data: offerRow } = await supabaseAdmin
        .from("offers")
        .select("application_id, offer_terms_json")
        .eq("id", offerId)
        .single();
      if (offerRow?.application_id) {
        const { data: appRow } = await supabaseAdmin
          .from("applications")
          .select("individual_id, applications_roles(title)")
          .eq("id", offerRow.application_id)
          .single();
        if (appRow?.individual_id) {
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("email, full_name")
            .eq("id", appRow.individual_id)
            .single();
          if (profile?.email) {
            const esc = (s: string) =>
              s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
               .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
            // signingUrl is server-generated (trusted); name/roleTitle from DB — escape both
            const signingUrl = `${env.FRONTEND_URL}/company/recruitment/offers/sign/${candidateStep.signature_token}`;
            const roleTitle = (appRow as any).applications_roles?.title ?? "votre poste";
            const name = profile.full_name ?? profile.email;
            void sendEmailDirect(
              profile.email,
              `Signature de votre offre d'emploi — ${roleTitle}`,
              `<p>Bonjour ${esc(name)},</p><p>Votre offre d'emploi est prête à être signée. Cliquez sur le lien ci-dessous pour signer :</p><p><a href="${esc(signingUrl)}">${esc(signingUrl)}</a></p><p>Ce lien est à usage unique et personnel.</p>`,
              `Bonjour ${name},\n\nVotre offre d'emploi est prête à être signée.\n\nLien de signature : ${signingUrl}\n\nCe lien est à usage unique et personnel.`
            );
          }
        }
      }
    }

    // Strip signature_token from POST response — candidate receives it via email only
    res.status(201).json({ data: created.map(({ signature_token: _t, ...rest }) => rest) });
  }
);

/**
 * GET /offers/:id/signing-chain
 * Get current signing chain status with signer profiles.
 */
export const getOfferSigningChain = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    if (!user.institutionId) throw new AppError(403, "Workspace context required");

    const offerId = req.params["id"] as string;
    await assertOfferInstitution(offerId, user.institutionId, supabaseAdmin);

    const { data, error } = await supabaseAdmin
      .from("offer_signing_steps")
      .select("id, position, signer_type, signer_role, signer_user_id, status, signed_at, rejected_at, reject_reason")
      .eq("offer_id", offerId)
      .order("position", { ascending: true });

    if (error) throw new AppError(500, "Failed to load signing chain");

    res.status(200).json({ data: data ?? [] });
  }
);

/**
 * POST /offers/:id/signing-chain/:position/sign
 * HR member signs their step (sequential — earlier steps must be SIGNED first).
 */
export const signOfferStep = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    if (!user.institutionId) throw new AppError(403, "Workspace context required");

    const offerId = req.params["id"] as string;
    const position = parseInt(req.params["position"] as string, 10);
    if (!Number.isFinite(position) || position < 1) throw new AppError(400, "Invalid position");

    await assertOfferInstitution(offerId, user.institutionId, supabaseAdmin);

    const { data: step, error: stepErr } = await supabaseAdmin
      .from("offer_signing_steps")
      .select("id, position, signer_type, signer_role, status")
      .eq("offer_id", offerId)
      .eq("position", position)
      .maybeSingle();

    if (stepErr || !step) throw new AppError(404, "Signing step not found");
    if (step.status !== "PENDING") throw new AppError(409, `Step already ${(step.status as string).toLowerCase()}`);
    if (step.signer_type !== "HR") throw new AppError(400, "This step requires candidate signature via public link");

    // Earlier steps must be signed.
    const { data: earlier } = await supabaseAdmin
      .from("offer_signing_steps")
      .select("position, status")
      .eq("offer_id", offerId)
      .lt("position", position);

    const blocked = (earlier ?? []).find((s) => s.status !== "SIGNED");
    if (blocked) throw new AppError(409, `Step ${blocked.position} must be signed first`);

    const { signatureData, signerName } = req.body as { signatureData?: string; signerName?: string };
    const signerIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket?.remoteAddress ?? null;

    const { error: updateErr } = await supabaseAdmin
      .from("offer_signing_steps")
      .update({
        status: "SIGNED",
        signer_user_id: user.id,
        signed_at: new Date().toISOString(),
        ...(signatureData ? { signature_data: signatureData } : {}),
        ...(signerName ? { signer_name: signerName } : {}),
        ...(signerIp ? { signed_ip: signerIp } : {}),
      })
      .eq("id", step.id);

    if (updateErr) throw new AppError(500, "Failed to record signature");

    res.status(200).json({ success: true });
  }
);

/**
 * POST /offers/sign/:token
 * Public route — candidate signs via unique token (no auth required).
 */
export const signOfferByToken = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const token = req.params["token"] as string;

    const { data: step, error: stepErr } = await supabaseAdmin
      .from("offer_signing_steps")
      .select("id, offer_id, position, signer_type, status")
      .eq("signature_token", token)
      .maybeSingle();

    if (stepErr || !step) throw new AppError(404, "Invalid or expired signing link");
    if (step.signer_type !== "CANDIDATE") throw new AppError(400, "This link is not for candidates");
    if (step.status !== "PENDING") throw new AppError(409, `Already ${(step.status as string).toLowerCase()}`);

    // Earlier steps must be signed.
    const { data: earlier } = await supabaseAdmin
      .from("offer_signing_steps")
      .select("position, status")
      .eq("offer_id", step.offer_id)
      .lt("position", step.position);

    const blocked = (earlier ?? []).find((s) => s.status !== "SIGNED");
    if (blocked) throw new AppError(409, `Previous step must be completed first`);

    const { signatureData, signerName } = req.body as { signatureData?: string; signerName?: string };
    const signerIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket?.remoteAddress ?? null;

    const { error: updateErr } = await supabaseAdmin
      .from("offer_signing_steps")
      .update({
        status: "SIGNED",
        signed_at: new Date().toISOString(),
        ...(signatureData ? { signature_data: signatureData } : {}),
        ...(signerName ? { signer_name: signerName } : {}),
        ...(signerIp ? { signed_ip: signerIp } : {}),
      })
      .eq("id", step.id);

    if (updateErr) throw new AppError(500, "Failed to record signature");

    res.status(200).json({ success: true, message: "Offer signed successfully." });
  }
);

/**
 * GET /offers/:id/signed-pdf
 * Generate and stream a signed offer PDF embedding both HR and candidate signatures.
 * Available once at least one signing step has a signature_data.
 */
export const getSignedOfferPdf = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    if (!user.institutionId) throw new AppError(403, "Workspace context required");

    const offerId = req.params["id"] as string;
    const offer = await assertOfferInstitution(offerId, user.institutionId, supabaseAdmin);

    // Load offer payload
    const { data: version } = await supabaseAdmin
      .from("offer_versions")
      .select("version_no, payload_json")
      .eq("offer_id", offerId)
      .eq("version_no", offer.current_version)
      .maybeSingle();

    const payload = (version?.payload_json as Record<string, unknown>) ?? {};

    // Load candidate info
    const { data: application } = await supabaseAdmin
      .from("applications")
      .select("profiles:candidate_id(full_name, email)")
      .eq("id", offer.application_id)
      .maybeSingle();
    const candidate = Array.isArray((application as any)?.profiles)
      ? (application as any).profiles[0]
      : (application as any)?.profiles;

    // Load all signing steps with signatures
    const { data: steps } = await supabaseAdmin
      .from("offer_signing_steps")
      .select("position, signer_type, signer_name, signed_at, signed_ip, signature_data, status")
      .eq("offer_id", offerId)
      .order("position");

    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 60, size: "A4" });
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // ── Header ──
      doc.fontSize(22).font("Helvetica-Bold").fillColor("#1a1a2e")
        .text("LETTRE D'OFFRE", { align: "center" });
      doc.moveDown(0.3);
      doc.moveTo(60, doc.y).lineTo(535, doc.y).strokeColor("#FF6B00").lineWidth(2).stroke();
      doc.moveDown(0.8);

      // ── Offer details ──
      if (candidate?.full_name) renderPdfField(doc, "Candidat", candidate.full_name, true);
      if (candidate?.email) renderPdfField(doc, "Email", candidate.email, true);
      renderPdfField(doc, "Poste", payload.position, true);
      renderPdfField(doc, "Rémunération", payload.compensation, true);
      renderPdfField(doc, "Date de début", payload.startDate, true);
      if (payload.benefits) renderPdfField(doc, "Avantages", payload.benefits, true);
      if (payload.notes) renderPdfField(doc, "Notes", payload.notes, true);

      doc.moveDown(1.5);
      doc.moveTo(60, doc.y).lineTo(535, doc.y).strokeColor("#e5e7eb").lineWidth(1).stroke();
      doc.moveDown(1);

      // ── Signatures ──
      doc.fontSize(13).font("Helvetica-Bold").fillColor("#1a1a2e").text("SIGNATURES", { align: "center" });
      doc.moveDown(1);

      const signatureBoxY = doc.y;
      const leftX = 60;
      const rightX = 310;

      for (const step of steps ?? []) {
        const x = step.signer_type === "HR" ? leftX : rightX;
        const label = step.signer_type === "HR" ? "Employeur (HR)" : "Candidat";

        doc.fontSize(10).font("Helvetica-Bold").fillColor("#666666").text(label, x, signatureBoxY, { width: 220 });
        doc.y = signatureBoxY + 15;

        if (step.signature_data && step.status === "SIGNED") {
          try {
            // strip data URL prefix if present
            const b64 = step.signature_data.replace(/^data:image\/\w+;base64,/, "");
            const imgBuf = Buffer.from(b64, "base64");
            doc.image(imgBuf, x, doc.y, { width: 180, height: 70 });
          } catch {
            doc.fontSize(9).fillColor("#999").text("(signature non disponible)", x, doc.y, { width: 220 });
          }
          doc.y = signatureBoxY + 95;
        } else {
          doc.fontSize(9).fillColor("#999").text("(non signé)", x, doc.y, { width: 220 });
          doc.y = signatureBoxY + 95;
        }

        if (step.signer_name) {
          doc.fontSize(9).font("Helvetica").fillColor("#333").text(step.signer_name, x, doc.y, { width: 220 });
          doc.y += 14;
        }
        if (step.signed_at) {
          doc.fontSize(8).fillColor("#888")
            .text(`Signé le ${new Date(step.signed_at).toLocaleString("fr-FR")}`, x, doc.y, { width: 220 });
          doc.y += 12;
        }
        if (step.signed_ip) {
          doc.fontSize(7).fillColor("#aaa")
            .text(`IP : ${step.signed_ip}`, x, doc.y, { width: 220 });
        }
      }

      // ── Footer ──
      doc.moveDown(3);
      doc.moveTo(60, doc.y).lineTo(535, doc.y).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
      doc.moveDown(0.4);
      doc.fontSize(8).font("Helvetica").fillColor("#aaa")
        .text(`Document généré par Aptely — ${new Date().toISOString()}`, { align: "center" });

      doc.end();
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="offre-signee-${offerId.slice(0, 8)}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.status(200).send(pdfBuffer);
  }
);

/**
 * GET /offers/:id/resolve-signers
 * Resolves the org-chart signers for an offer:
 * offer → application → role.department_id → departments.manager_user_id
 * Falls back to institution OWNER if no department/manager is set.
 */
export const resolveOfferSigners = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const offerId = req.params["id"] as string;
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Workspace context required");

    // Resolve chain: offer → application → role → department → manager
    const { data: offer } = await supabaseAdmin
      .from("offers")
      .select(`
        id,
        applications!inner(
          role_id,
          roles!inner(
            department_id,
            hiring_manager_user_id,
            departments(
              id,
              name,
              manager_user_id,
              profiles!departments_manager_user_id_fkey(id, full_name, email)
            )
          )
        )
      `)
      .eq("id", offerId)
      .eq("applications.roles.institution_id", institutionId)
      .maybeSingle();

    if (!offer) throw new AppError(404, "Offer not found");

    const appRaw = offer.applications as unknown;
    const app = Array.isArray(appRaw) ? appRaw[0] : appRaw;
    const roleRaw = app && typeof app === "object" ? (app as Record<string, unknown>).roles : undefined;
    const role = Array.isArray(roleRaw) ? roleRaw[0] : roleRaw;
    const dept = role && typeof role === "object" ? (role as Record<string, unknown>).departments : undefined;
    const managerFromDept = (dept && typeof dept === "object" ? (dept as Record<string, unknown>).profiles : null) ?? null;
    const hiringManagerId = (role && typeof role === "object" ? (role as Record<string, unknown>).hiring_manager_user_id : null) ?? null;

    let manager = null;

    // Priority: 1. hiring_manager on role, 2. department manager, 3. institution OWNER
    if (hiringManagerId) {
      const { data: hm } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", hiringManagerId)
        .maybeSingle();
      if (hm) manager = { source: "hiring_manager", ...hm };
    } else if (managerFromDept) {
      manager = { source: "department_manager", ...managerFromDept };
    } else {
      // Fallback: institution OWNER
      const { data: owner } = await supabaseAdmin
        .from("institution_members")
        .select("profiles!inner(id, full_name, email)")
        .eq("institution_id", institutionId)
        .eq("status", "OWNER")
        .limit(1)
        .maybeSingle();
      if (owner) {
        const p = (owner as any).profiles;
        manager = { source: "owner_fallback", id: p.id, full_name: p.full_name, email: p.email };
      }
    }

    const deptObj = dept && typeof dept === "object" ? dept as Record<string, unknown> : null;
    res.status(200).json({
      data: {
        department: deptObj ? { id: deptObj.id, name: deptObj.name } : null,
        manager,
        signers: [
          { signer_type: "CANDIDATE", signer_role: null },
          manager && "id" in manager
            ? { signer_type: "HR", signer_user_id: manager.id, signer_role: null }
            : { signer_type: "HR", signer_role: "OWNER" },
        ],
      },
    });
  }
);
