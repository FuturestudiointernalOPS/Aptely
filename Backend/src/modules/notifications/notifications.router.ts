import { Router } from "express";
import { authGuard } from "@/middleware/auth.middleware";
import { listNotifications, markAllRead, markOneRead } from "./notifications.controller";

const router = Router();

router.use(authGuard);

router.get("/",                  listNotifications);
router.patch("/read-all",        markAllRead);
router.patch("/:id/read",        markOneRead);

export default router;
