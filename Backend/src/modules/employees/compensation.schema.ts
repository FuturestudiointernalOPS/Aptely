export interface CreateSalaryBandInput {
  job_position_id?: string;
  level: string;
  band_min?: number;
  band_max?: number;
  band_median?: number;
  currency?: string;
  location?: string;
  effective_date?: string;
  source?: "internal" | "market_data";
}

export interface UpdateSalaryBandInput {
  level?: string;
  band_min?: number;
  band_max?: number;
  band_median?: number;
  currency?: string;
  location?: string;
  effective_date?: string;
  source?: "internal" | "market_data";
}

export interface CreateCompReviewInput {
  employee_user_id: string;
  effective_date: string;
  previous_salary?: number;
  new_salary: number;
  change_reason?: string;
  notes?: string;
}

export type CompReviewStatus =
  | "draft"
  | "submitted"
  | "hr_approved"
  | "finance_approved"
  | "ceo_approved"
  | "effective";
