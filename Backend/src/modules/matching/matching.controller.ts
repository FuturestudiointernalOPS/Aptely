import { supabaseAdmin } from "@/config/supabase";
import { Response } from "express";
import { asyncHandler } from "@/utils/helpers";
import { AppError } from "@/middleware/error.middleware";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import type { MatchRoleInput } from "./matching.schema";
import { runMatching } from "./matching.service";

// ─── POST /match/role ─────────────────────────────────────────────────────────

export const matchRole = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) {
      throw new AppError(403, "You are not linked to any institution");
    }

    const { roleId, maxResults } = req.body as MatchRoleInput;

    const { data: role, error: roleError } = await supabaseAdmin
      .from("roles")
      .select("id, institution_id")
      .eq("id", roleId)
      .single();

    if (roleError || !role) throw new AppError(404, "Role not found");
    if (role.institution_id !== institutionId) {
      throw new AppError(403, "You do not have access to this role");
    }

    const { count, error: countError } = await supabaseAdmin
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("role_id", roleId)
      .eq("status", "ANALYSING");

    if (countError) throw new AppError(500, "Failed to check applications");
    if (!count || count === 0) {
      throw new AppError(
        422,
        "No applications in ANALYSING status. Run /roles/:id/evaluate first."
      );
    }

    const locale = req.headers["x-locale"] === "en" ? "en" : "fr";
    runMatching(roleId, maxResults ?? 10, locale).catch((err) => {
      console.error("[matching.controller] Background matching failed:", err);
    });

    res.status(202).json({
      roleId,
      message: "AI matching engine has been started in the background.",
      summary: {
        totalReviewed: count,
        status: "PROCESSING",
      },
    });
  }
);
