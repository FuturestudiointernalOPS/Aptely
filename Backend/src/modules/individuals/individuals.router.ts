import { Router } from "express";
import multer from "multer";
import { authGuard, requirePersonalWorkspace } from "@/middleware/auth.middleware";
import { requirePermission } from "@/middleware/permissions.middleware";
import { validate } from "@/middleware/validate.middleware";
import { upsertIndividualProfileSchema } from "./individuals.schema";
import {
  getMyIndividualProfile,
  upsertMyIndividualProfile,
  getMyApplications,
  getMyApplicationInterview,
  getMyOffers,
  getMyOffer,
  createExportToken,
  getPublicProfile,
  getCandidateProfileForHR,
  uploadCv,
  deleteCv,
} from "./individuals.controller";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/me",               authGuard, requirePersonalWorkspace, getMyIndividualProfile);
router.put("/me",               authGuard, requirePersonalWorkspace, validate(upsertIndividualProfileSchema), upsertMyIndividualProfile);
router.get("/me/applications",  authGuard, requirePersonalWorkspace, getMyApplications);
router.get("/me/applications/:appId/interview", authGuard, requirePersonalWorkspace, getMyApplicationInterview);
router.get("/me/offers",        authGuard, requirePersonalWorkspace, getMyOffers);
router.get("/me/offers/:offerId", authGuard, requirePersonalWorkspace, getMyOffer);
router.post("/me/export",       authGuard, requirePersonalWorkspace, createExportToken);
router.post("/me/upload-cv",    authGuard, requirePersonalWorkspace, upload.single("file"), uploadCv);
router.delete("/me/cv",          authGuard, requirePersonalWorkspace, deleteCv);

// Public — no auth
router.get("/public/profile/:token", getPublicProfile);

router.get("/:userId/profile", authGuard, requirePermission("applications.view"), getCandidateProfileForHR);

export default router;
