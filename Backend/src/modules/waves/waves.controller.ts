import { Response } from "express";
import { AppError } from "@/middleware/error.middleware";
import { asyncHandler } from "@/utils/helpers";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import * as wavesService from "./waves.service";
import type {
  CreateWaveInput,
  UpdateWaveInput,
  GenerateWaveSlotsInput,
  CreateWaveSlotInput,
  InviteCandidatesInput,
  UpdateWaveCandidateStatusInput,
  ConfirmWaveBookingInput,
  CreateWaveTemplateInput,
} from "./waves.schema";

function requireInstitution(req: AuthenticatedRequest): string {
  const id = req.user?.institutionId;
  if (!id) throw new AppError(403, "You are not linked to any institution");
  return id;
}

// ─── Waves CRUD ───────────────────────────────────────────────────────────────

export const listWavesForRole = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const institutionId = requireInstitution(req);
  let { roleId } = req.params;
  if (Array.isArray(roleId)) roleId = roleId[0];
  const waves = await wavesService.listWavesForRole(roleId, institutionId);
  res.status(200).json({ data: waves });
});

export const createWave = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const institutionId = requireInstitution(req);
  const input = req.body as CreateWaveInput;
  const wave = await wavesService.createWave(input, institutionId, req.user!.id);
  res.status(201).json({ data: wave });
});

export const getWave = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const institutionId = requireInstitution(req);
  let { id } = req.params;
  if (Array.isArray(id)) id = id[0];
  const wave = await wavesService.getWave(id, institutionId);
  res.status(200).json({ data: wave });
});

export const updateWave = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const institutionId = requireInstitution(req);
  let { id } = req.params;
  if (Array.isArray(id)) id = id[0];
  const input = req.body as UpdateWaveInput;
  const wave = await wavesService.updateWave(id, institutionId, input);
  res.status(200).json({ data: wave });
});

export const deleteWave = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const institutionId = requireInstitution(req);
  let { id } = req.params;
  if (Array.isArray(id)) id = id[0];
  const result = await wavesService.deleteWave(id, institutionId);
  res.status(200).json(result);
});

// ─── Wave Slots ───────────────────────────────────────────────────────────────

export const listWaveSlots = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const institutionId = requireInstitution(req);
  let { id } = req.params;
  if (Array.isArray(id)) id = id[0];
  const slots = await wavesService.listWaveSlots(id, institutionId);
  res.status(200).json({ data: slots });
});

export const createWaveSlot = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const institutionId = requireInstitution(req);
  let { id } = req.params;
  if (Array.isArray(id)) id = id[0];
  const input = req.body as CreateWaveSlotInput;
  const slot = await wavesService.createWaveSlot(id, institutionId, input);
  res.status(201).json({ data: slot });
});

export const generateWaveSlots = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const institutionId = requireInstitution(req);
  let { id } = req.params;
  if (Array.isArray(id)) id = id[0];
  const input = req.body as GenerateWaveSlotsInput;
  const result = await wavesService.generateWaveSlots(id, institutionId, input);
  res.status(201).json({ data: result });
});

export const deleteWaveSlot = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const institutionId = requireInstitution(req);
  let { id, slotId } = req.params;
  if (Array.isArray(id)) id = id[0];
  if (Array.isArray(slotId)) slotId = slotId[0];
  const result = await wavesService.deleteWaveSlot(id, slotId, institutionId);
  res.status(200).json(result);
});

// ─── Wave Candidates ──────────────────────────────────────────────────────────

export const listWaveCandidates = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const institutionId = requireInstitution(req);
  let { id } = req.params;
  if (Array.isArray(id)) id = id[0];
  const candidates = await wavesService.listWaveCandidates(id, institutionId);
  res.status(200).json({ data: candidates });
});

export const inviteCandidates = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const institutionId = requireInstitution(req);
  let { id } = req.params;
  if (Array.isArray(id)) id = id[0];
  const input = req.body as InviteCandidatesInput;
  const result = await wavesService.inviteCandidatesToWave(id, institutionId, input, req.user!.id);
  res.status(200).json({ data: result });
});

export const updateWaveCandidateStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const institutionId = requireInstitution(req);
  let { id, waveCandidateId } = req.params;
  if (Array.isArray(id)) id = id[0];
  if (Array.isArray(waveCandidateId)) waveCandidateId = waveCandidateId[0];
  const input = req.body as UpdateWaveCandidateStatusInput;
  const result = await wavesService.updateWaveCandidateStatus(id, waveCandidateId, institutionId, input);
  res.status(200).json({ data: result });
});

export const removeWaveCandidate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const institutionId = requireInstitution(req);
  let { id, waveCandidateId } = req.params;
  if (Array.isArray(id)) id = id[0];
  if (Array.isArray(waveCandidateId)) waveCandidateId = waveCandidateId[0];
  const result = await wavesService.removeWaveCandidate(id, waveCandidateId, institutionId);
  res.status(200).json(result);
});

// ─── Public booking (no auth) ─────────────────────────────────────────────────

export const getWaveBookingByToken = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  let { token } = req.params;
  if (Array.isArray(token)) token = token[0];
  if (!token || token.length < 24) throw new AppError(400, "Invalid invite token");
  const booking = await wavesService.getWaveBookingByToken(token);
  res.status(200).json({ data: booking });
});

export const confirmWaveBooking = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  let { token } = req.params;
  if (Array.isArray(token)) token = token[0];
  const input = req.body as ConfirmWaveBookingInput;
  if (!token || token.length < 24) throw new AppError(400, "Invalid invite token");
  const result = await wavesService.confirmWaveBooking(token, input.slotId);
  res.status(200).json({ data: result });
});

// ─── Wave Analytics ───────────────────────────────────────────────────────────

export const getWaveAnalytics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const institutionId = requireInstitution(req);
  let { id } = req.params;
  if (Array.isArray(id)) id = id[0];
  const analytics = await wavesService.getWaveAnalytics(id, institutionId);
  res.status(200).json({ data: analytics });
});

// ─── Wave Templates ───────────────────────────────────────────────────────────

export const listWaveTemplates = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const institutionId = requireInstitution(req);
  const templates = await wavesService.listWaveTemplates(institutionId);
  res.status(200).json({ data: templates });
});

export const createWaveTemplate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const institutionId = requireInstitution(req);
  const input = req.body as CreateWaveTemplateInput;
  const template = await wavesService.createWaveTemplate(institutionId, req.user!.id, input);
  res.status(201).json({ data: template });
});
