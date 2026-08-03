export interface CandidateAnalysis {
  role: string;
  score: number;
  fit: 'High Fit' | 'Moderate Fit' | 'Low Fit';
  risk: 'Faible' | 'Modéré' | 'Élevé';
  explanation: string;
  proofs: string[];
  softSkills: string[];
}
