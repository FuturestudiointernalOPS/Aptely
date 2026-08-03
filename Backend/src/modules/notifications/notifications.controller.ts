import { Response } from "express";
import { supabaseAdmin } from "@/config/supabase";
import { AppError } from "@/middleware/error.middleware";
import { asyncHandler } from "@/utils/helpers";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";

const PAGE_SIZE = 50;

// ─── GET /notifications ────────────────────────────────────────────────────────
export const listNotifications = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;

    const { data, error } = await supabaseAdmin
      .from("notifications")
      .select("id, type, title, body, link, is_read, created_at, institution_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (error) throw new AppError(500, "Failed to fetch notifications");

    const unread = (data ?? []).filter((n) => !n.is_read).length;
    res.status(200).json({ data: data ?? [], unread_count: unread });
  }
);

// ─── PATCH /notifications/read-all ─────────────────────────────────────────────
export const markAllRead = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;

    const { error } = await supabaseAdmin
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (error) throw new AppError(500, "Failed to mark notifications as read");

    res.status(200).json({ success: true });
  }
);

// ─── PATCH /notifications/:id/read ─────────────────────────────────────────────
export const markOneRead = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const { id } = req.params as { id: string };

    const { error } = await supabaseAdmin
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw new AppError(500, "Failed to mark notification as read");

    res.status(200).json({ success: true });
  }
);
