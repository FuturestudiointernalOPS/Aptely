// Retention Risk module — types & constants

export interface RetentionSignalInput {
  employee_user_id: string;
  perf_trend?: number;           // -2 to +2
  goal_alignment_score?: number; // 0-100
  ld_inactive_days?: number;
  comp_gap_pct?: number;
  tenure_months?: number;
  peer_departures?: number;
  feedback_sentiment?: number;   // -1 to 1
}

// Signal weights for risk score computation
const SIGNAL_WEIGHTS = {
  perf_trend_decline: 25,       // perf_trend < -1
  goal_misaligned: 20,           // goal_alignment_score < 50
  ld_inactive: 15,               // ld_inactive_days > 60
  comp_gap: 20,                  // comp_gap_pct > 15
  peer_departures: 10,           // peer_departures > 2
  feedback_negative: 10,         // feedback_sentiment < -0.3
} as const;

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export function computeRiskScore(signals: RetentionSignalInput): { score: number; level: RiskLevel; flags: string[] } {
  let score = 0;
  const flags: string[] = [];

  if ((signals.perf_trend ?? 0) < -1) {
    score += SIGNAL_WEIGHTS.perf_trend_decline;
    flags.push("perf_decline");
  }
  if ((signals.goal_alignment_score ?? 100) < 50) {
    score += SIGNAL_WEIGHTS.goal_misaligned;
    flags.push("goal_misaligned");
  }
  if ((signals.ld_inactive_days ?? 0) > 60) {
    score += SIGNAL_WEIGHTS.ld_inactive;
    flags.push("ld_inactive");
  }
  if ((signals.comp_gap_pct ?? 0) > 15) {
    score += SIGNAL_WEIGHTS.comp_gap;
    flags.push("comp_gap");
  }
  if ((signals.peer_departures ?? 0) > 2) {
    score += SIGNAL_WEIGHTS.peer_departures;
    flags.push("peer_departures");
  }
  if ((signals.feedback_sentiment ?? 0) < -0.3) {
    score += SIGNAL_WEIGHTS.feedback_negative;
    flags.push("negative_feedback");
  }

  const level: RiskLevel = score >= 61 ? "HIGH" : score >= 31 ? "MEDIUM" : "LOW";
  return { score: Math.min(score, 100), level, flags };
}
