import { Router } from "express";
import { authGuard } from "@/middleware/auth.middleware";
import { requirePermission } from "@/middleware/permissions.middleware";
import { validate } from "@/middleware/validate.middleware";
import {
  listPeriods,
  createPeriod,
  getPeriod,
  updatePeriod,
  deletePeriod,
  upsertEntry,
  updateEntry,
  deleteEntry,
  generateEntries,
} from "./payroll.controller";
import {
  createPeriodSchema,
  updatePeriodSchema,
  upsertEntrySchema,
  updateEntrySchema,
} from "./payroll.schema";

const router = Router();

router.get("/periods", authGuard, requirePermission("payroll.view"), listPeriods);
router.post("/periods", authGuard, requirePermission("payroll.manage"), validate(createPeriodSchema), createPeriod);
router.get("/periods/:periodId", authGuard, requirePermission("payroll.view"), getPeriod);
router.patch("/periods/:periodId", authGuard, requirePermission("payroll.manage"), validate(updatePeriodSchema), updatePeriod);
router.delete("/periods/:periodId", authGuard, requirePermission("payroll.manage"), deletePeriod);

router.post("/periods/:periodId/generate", authGuard, requirePermission("payroll.manage"), generateEntries);
router.post("/periods/:periodId/entries", authGuard, requirePermission("payroll.manage"), validate(upsertEntrySchema), upsertEntry);
router.patch("/periods/:periodId/entries/:entryId", authGuard, requirePermission("payroll.manage"), validate(updateEntrySchema), updateEntry);
router.delete("/periods/:periodId/entries/:entryId", authGuard, requirePermission("payroll.manage"), deleteEntry);

export default router;
