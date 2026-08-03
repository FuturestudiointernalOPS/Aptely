import { CandidateAnalysis } from "@/types/landing";

export const analyzeCandidate = async (
  role: string,
  stack: string,
  seniority: string,
  context: string
): Promise<CandidateAnalysis> => {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, stack, seniority, context }),
  });

  if (!response.ok) {
    throw new Error(`Analysis request failed: ${response.status}`);
  }

  return response.json() as Promise<CandidateAnalysis>;
};
