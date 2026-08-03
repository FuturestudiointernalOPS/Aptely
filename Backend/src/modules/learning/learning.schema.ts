export interface CreatePlanInput {
  employee_user_id: string;
  title?: string;
}

export interface UpdatePlanInput {
  title?: string;
  status?: "active" | "paused" | "completed";
}

export interface AddActivityInput {
  title: string;
  description?: string;
  type: "course" | "book" | "mentor" | "project" | "certification" | "other";
  provider?: string;
  url?: string;
  estimated_hours?: number;
  due_date?: string;
  skill_tags?: string[];
}

export interface UpdateActivityInput {
  title?: string;
  description?: string;
  type?: "course" | "book" | "mentor" | "project" | "certification" | "other";
  provider?: string;
  url?: string;
  estimated_hours?: number;
  status?: "assigned" | "in_progress" | "completed" | "skipped";
  due_date?: string;
  skill_tags?: string[];
  completed_at?: string | null;
}
