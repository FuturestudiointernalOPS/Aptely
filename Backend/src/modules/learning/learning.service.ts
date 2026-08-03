import { supabaseAdmin } from "../../config/supabase";

/**
 * Compute skill gaps for an employee by comparing their DNA snapshot
 * against their current job position requirements.
 * Results are upserted into skill_gaps table.
 */
export async function computeSkillGaps(
  userId: string,
  institutionId: string
): Promise<void> {
  // Fetch employee's job_position from employee_records
  const { data: empRecord } = await supabaseAdmin
    .from("employee_records")
    .select("job_position_id")
    .eq("user_id", userId)
    .eq("institution_id", institutionId)
    .maybeSingle();

  if (!empRecord?.job_position_id) return;

  // Fetch role DNA requirements (must_have skills from candidateProfile)
  const { data: jobPos } = await supabaseAdmin
    .from("job_positions")
    .select("role_id")
    .eq("id", empRecord.job_position_id)
    .maybeSingle();

  if (!jobPos?.role_id) return;

  const { data: roleDna } = await supabaseAdmin
    .from("roles")
    .select("role_dna")
    .eq("id", jobPos.role_id)
    .maybeSingle();

  const requirements: string[] = (roleDna?.role_dna as any)?.candidateProfile?.mustHave ?? [];
  if (!requirements.length) return;

  // Fetch employee's current skills from their latest dna_snapshot
  const { data: appRecord } = await supabaseAdmin
    .from("applications")
    .select("dna_snapshot")
    .eq("candidate_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const employeeSkills: string[] = (appRecord?.dna_snapshot as any)?.talent_skills ?? [];

  // Delete existing gaps for this employee/institution
  await supabaseAdmin
    .from("skill_gaps")
    .delete()
    .eq("employee_user_id", userId)
    .eq("institution_id", institutionId);

  // Build gaps
  const gaps = requirements
    .filter(req => !employeeSkills.some(s => s.toLowerCase().includes(req.toLowerCase())))
    .map(req => ({
      institution_id: institutionId,
      employee_user_id: userId,
      skill_name: req,
      current_level: 0,
      required_level: 3,
      gap_priority: "MEDIUM" as const,
      role_id: jobPos.role_id,
    }));

  if (gaps.length > 0) {
    await supabaseAdmin.from("skill_gaps").insert(gaps);
  }
}
