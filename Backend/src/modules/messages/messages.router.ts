import { Router } from "express";
import { authGuard } from "@/middleware/auth.middleware";
import { validate } from "@/middleware/validate.middleware";
import { sendMessageSchema } from "./messages.schema";
import { listThreads, getMessages, sendMessage, markRead } from "./messages.controller";

const router = Router();

// All message routes require authentication (both CANDIDATE and HR can message)
router.get("/",                          authGuard, listThreads);
router.get("/:applicationId",            authGuard, getMessages);
router.post("/:applicationId",           authGuard, validate(sendMessageSchema), sendMessage);
router.patch("/:applicationId/read",     authGuard, markRead);

export default router;
