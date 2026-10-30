export type ApplicationStatus =
  | "PENDING"
  | "ANALYSING"
  | "FINISHED"
  | "VALIDATED"
  | "REJECTED"
  | "STOPPED";

export type RoleStatus = "ACTIVE" | "DRAFT" | "CLOSED" | "CANCELLED";

export type MembershipStatus = "OWNER" | "ADMIN" | "ACTIVE" | "PENDING" | "SUSPENDED";

export interface DashboardStats {
  totalRoles: number;
  activeRoles: number;
  activeRolesWithoutApplications: number;
  totalApplications: number;
  pendingApplications: number;
  analyzingApplications: number;
  validatedApplications: number;
  rejectedApplications: number;
  activeHRMembers: number;
}

export interface Role {
  roleId: string;
  title: string;
  description?: string;
  status: RoleStatus;
  location: string | null;
  type: string;
  createdAt: string;
  endDate: string;
  applicationsCount: number;
  shareLink: string;
  metadataMissing?: boolean;
  applicationForm?: Array<Record<string, any>>;
  roleDna?: {
    mission90Days?: string;
    success6Months?: string;
    keyProblems?: Array<{ problem: string; priority: "HIGH" | "MEDIUM" | "LOW" }>;
    constraints?: {
      budget?: string;
      teamSize?: number;
      techStack?: string[];
      reportingTo?: string;
    };
    teamContext?: {
      size?: number;
      structure?: string;
      dynamics?: string;
      challenges?: string[];
    };
    candidateProfile?: {
      mustHave?: string[];
      niceToHave?: string[];
      culture?: string;
    };
    dealbreakers?: string[];
    evaluationContext?: string;
    fullFormSnapshot?: Record<string, any>;
  };
}

export interface Application {
  applicationId: string;
  candidateId: string;
  candidateName: string;
  roleId: string;
  roleTitle: string;
  status: ApplicationStatus;
  submittedAt: string;
  hasDocuments: boolean;
  matchScore?: number;
}

export interface Activity {
  activityId: string;
  type: "APPLICATION_REVIEW" | "APPLICATION_RECEIVED" | "ROLE_CREATED" | "HR_JOINED" | "HR_REMOVED";
  message: string;
  createdAt: string;
}

export interface ApplicationDocument {
  id: string;
  type: "CV" | "MOTIVATION_LETTER" | "OTHER";
  fileName: string;
  storagePath: string;
  url: string | null;
  createdAt: string;
}

export interface HRMember {
  userId: string;
  email: string;
  fullName?: string | null;
  membershipStatus: MembershipStatus;
  roleSpecialization?: string | null;
  roleCustomLabel?: string | null;
  customRoleId?: string | null;
  createdAt: string;
}

export interface JoinRequest {
  requestId: string;
  userId: string;
  email: string;
  requestedAt: string;
  status: "PENDING";
}

export interface InstitutionSettings {
  institutionId: string;
  name: string;
  website?: string;
  sector?: string;
  teamSize?: number;
  stage?: string;
  location?: string;
  description?: string;
  logoUrl?: string;
}

export interface PersonalSettings {
  timezone: string;
  language: "fr" | "en";
  emailNotifications: boolean;
  inAppNotifications: boolean;
  interviewReminders: boolean;
  defaultInterviewDuration: 30 | 45 | 60 | 90;
  interviewBufferMinutes: 0 | 10 | 15 | 30;
  workdayStart: string;
  workdayEnd: string;
  calcomLink?: string;
}

export interface SortedTalent {
  rank: number;
  talentId: string;
  name: string;
  score: number;
  approved: boolean | null;
  yearsExp: number;
  context: string;
  tags: string[];
}

export interface AptelyReport {
  roleId: string;
  roleTitle?: string;
  summary: {
    topCandidates: number;
    totalReviewed: number;
    aiConfidence: number;
    keySelectionFactors: string[];
  };
  results: AptelyReportResult[];
}

export interface AptelyReportResult {
  talentId: string;
  name: string;
  score: {
    roleFit: number;
    skillValidity: number;
    capabilityStrength: number;
    environmentFit: number;
    motivationFit: number;
    constraintFit: number;
    reliabilityIndex: number;
    finalScore: number;
  };
  aiExplanation: {
    whySelected: string[];
    evidenceUsed: {
      type: string;
      text?: string;
      url?: string;
      signal?: string;
      contact?: string;
    }[];
    riskFlags: {
      risk: string;
      impact: string;
    }[];
    tradeoffs: string[];
    alignmentWithRole: {
      mission90Days: string;
      success6Months: string;
      keyProblems: {
        problem: string;
        fit: string;
        proof: string;
      }[];
    };
  };
}

export interface Team {
  teamId: string;
  name: string;
  description: string;
  membersCount: number;
  logo?: string;
}

export interface CandidateProfile {
  candidateId: string;
  identity: {
    name: string;
    location: string;
    timezone: string;
    workAuth: string;
    availability: string;
    contracts: string[];
    salaryExpectation: string;
    links: {
      cv: string;
      linkedin: string;
      portfolio: string;
    };
  };
  snapshot: {
    primaryRole: string;
    secondarySkills: string[];
    yearsExp: number;
    experienceMix: string[];
    trustedProblemSolving: string;
  };
  capabilities: {
    skillName: string;
    yearsUsed: number;
    context: string[];
    ownership: "assisted" | "independently delivered" | "led others" | "architected systems";
    proofLink: string;
    explanation: {
      what: string;
      role: string;
      difficulty: string;
      outcome: string;
    };
  }[];
  workEvidence: {
    projectName: string;
    problemSolved: string;
    personalContribution: string;
    toolsUsed: string[];
    result: string;
    hardship: string;
    link: string;
  }[];
  scenarioJudgment: {
    difficultProblem: string;
    failedProject: string;
    approachToChallenges: string;
  };
  operatingStyle: {
    chaosVsStructure: number;
    speedVsQuality: number;
    autonomyVsGuidance: number;
    depthVsVariety: number;
    pressureComfort: number;
    struggleEnvironment: string;
    thriveEnvironment: string;
  };
  motivation: {
    growthGoals: string;
    excitementTriggers: string;
    threeYearVision: string;
    meaningfulProblems: string;
  };
}

export interface Interview {
  id: string;
  applicationId: string;
  name: string;
  interviewType: string;
  status: string;
  scheduledAt?: string | null;
  meetingLink?: string | null;
  meetingLocation?: string | null;
  bookingToken?: string | null;
  notes?: string | null;
  participants?: Array<{
    userId: string;
    profileText?: string | null;
    evaluationWeight: number;
    role?: "MANDATORY" | "SECONDARY";
    weight?: number | null;
    confirmedSecondary?: boolean;
  }>;
  secondaryCollectiveWeight?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface InstitutionInterviewListItem {
  id: string;
  applicationId: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string | null;
  roleTitle: string;
  name: string;
  status: string;
  interviewType: string;
  scheduledAt: string | null;
  meetingLocation: string | null;
  interviewers: Array<{
    userId: string;
    email: string | null;
    fullName: string | null;
    evaluationWeight: number;
  }>;
}

export interface InterviewAvailabilityQuery {
  from: string;
  to: string;
  slotMinutes?: number;
  timezone?: string;
  workingHoursStart?: number;
  workingHoursEnd?: number;
}

export interface InterviewSlotParticipant {
  userId: string;
  email: string;
  name?: string;
}

export interface InterviewSlot {
  start: string;
  end: string;
  availableParticipants?: InterviewSlotParticipant[];
  unavailableParticipants?: InterviewSlotParticipant[];
  availableMandatory?: InterviewSlotParticipant[];
  unavailableMandatory?: InterviewSlotParticipant[];
  availableSecondary?: InterviewSlotParticipant[];
  unavailableSecondary?: InterviewSlotParticipant[];
  isValid?: boolean;
}

export interface InterviewGuideQuestion {
  id: string;
  question: string;
  objective: string;
  scoreHint: string;
}

export type QuestionType = "DURING_INTERVIEW" | "DEBRIEF" | "TEMPLATE";

export interface GeneratedQuestion {
  id: string;
  interviewId: string;
  interviewerId: string;
  questionType: QuestionType;
  questionText: string;
  source: string;
  createdAt: string;
}

export interface DebriefAnswer {
  id: string;
  questionKey: string;
  scoreOver10: number;
  comment: string | null;
  createdAt: string;
}

export interface InterviewQuestionTemplate {
  id: string;
  templateKey: string;
  title: string;
  markdownContent: string;
  isDefault: boolean;
  createdAt: string;
}

export interface InterviewerQuestionPack {
  interviewerId: string;
  duringQuestions: GeneratedQuestion[];
  debriefQuestions: GeneratedQuestion[];
  debriefAnswers: DebriefAnswer[];
  defaultTemplate: InterviewQuestionTemplate | null;
}

export interface ScorecardCriterionInput {
  criterion: string;
  scoreOver10: number;
  comment?: string;
}

export interface InterviewInterviewerScore {
  id: string;
  interviewId: string;
  interviewerId: string;
  globalScoreOver10: number;
  weightedContribution: number;
  comment: string | null;
  submittedAt: string;
}

export interface InterviewScoreContribution {
  interviewerId: string;
  weight: number;
  scoreOver10: number | null;
  weightedContribution: number;
  submitted: boolean;
}

export interface InterviewScoresSummary {
  interviewId: string;
  totalSubmitted: number;
  weightedScoreOver10: number;
  computedAt: string;
  contributions: InterviewScoreContribution[];
  details: {
    formula: string;
    totalParticipants: number;
  };
}

export type ScorecardStatus = "NONE" | "DRAFT" | "SUBMITTED" | "ARCHIVED";

export interface InterviewScorecardTemplateSnapshot {
  templateId: string | null;
  templateName: string;
  roleId: string | null;
  criteria: Array<{
    criterionKey: string;
    label: string;
    weight: number | null;
    position: number;
  }>;
}

export interface InterviewScorecardEntry {
  id: string;
  criterionKey: string;
  criterionLabel: string;
  weight: number | null;
  score: number | null;
  comment: string | null;
  redFlag: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewScorecard {
  id: string;
  interviewId: string;
  reviewerId: string;
  reviewerName: string;
  status: Exclude<ScorecardStatus, "NONE">;
  overallComment: string | null;
  submittedAt: string | null;
  isModifiedAfterSubmit: boolean;
  archivedAt: string | null;
  templateSnapshot: InterviewScorecardTemplateSnapshot;
  entries: InterviewScorecardEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface InterviewScorecardsList {
  scorecards: InterviewScorecard[];
  visibility: {
    myReviewerId: string;
    myScorecardStatus: ScorecardStatus;
    canViewOthers: boolean;
    canReview: boolean;
  };
}

export interface CandidateInterviewHistoryEnrichedItem {
  interview: Interview;
  scoreSummary: InterviewScoresSummary | null;
  myScorecardStatus: ScorecardStatus;
}

export interface InterviewActivityEvent {
  id: string;
  interviewId: string;
  eventType: string;
  actorId: string | null;
  payloadJson: Record<string, unknown>;
  createdAt: string;
}

export interface InterviewReminderStatus {
  totalJobs: number;
  pendingJobs: number;
  sentJobs: number;
  failedJobs: number;
  nextSendAt: string | null;
  lastSentAt: string | null;
}

export type RolePermissionsMap = Record<string, Record<string, boolean>>;

export type CustomRole = {
  id: string;
  name: string;
  rank: number;
  created_at: string;
  permissions: string[];
  member_count: number;
};
