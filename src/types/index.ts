// ── Network Zones ──

export const ZONES = ["Internet", "DMZ", "Intranet"] as const;
export type Zone = (typeof ZONES)[number];

export const DIRECTIONS = ["Inbound", "Outbound", "Bidirectional"] as const;
export type Direction = (typeof DIRECTIONS)[number];

export const PROTOCOLS = ["TCP", "UDP", "ICMP", "Any"] as const;
export type Protocol = (typeof PROTOCOLS)[number];

export const ACTIONS = ["Allow", "Deny"] as const;
export type Action = (typeof ACTIONS)[number];

export const ENVIRONMENTS = ["DEV", "UAT", "PROD"] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

export const DATA_CLASSIFICATIONS = [
  "Public",
  "Internal",
  "Confidential",
  "Restricted",
] as const;
export type DataClassification = (typeof DATA_CLASSIFICATIONS)[number];

// ── Design Row (single connection in IdaC template) ──

export interface DesignRow {
  rowNumber: number;
  sourceComponent: string;
  sourceTechnology: string;
  sourceZone: Zone;
  sourceIpSubnet?: string;
  destComponent: string;
  destTechnology: string;
  destZone: Zone;
  destIpSubnet?: string;
  direction: Direction;
  protocol: Protocol;
  ports: string; // comma-separated, e.g. "443, 8443"
  action: Action;
  isCommonService: boolean;
  justification: string;
  // Optional columns
  environment?: Environment;
  applicationId?: string;
  dataClassification?: DataClassification;
  encryptionRequired?: boolean;
  natTranslation?: string;
  gateway?: string;
  notes?: string;
}

// ── Project ──

export interface Project {
  id: string;
  name: string;
  code: string;
  description?: string;
  gitlabRepoPath?: string;
  jiraProjectKey?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Design Submission ──

export const SUBMISSION_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "changes_requested",
  "approved",
  "superseded",
] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export interface DesignSubmission {
  id: string;
  projectId: string;
  version: number;
  status: SubmissionStatus;
  submittedBy: string;
  submittedAt?: string;
  excelFileUrl?: string;
  idacYaml?: string;
  gitlabCommitSha?: string;
  mermaidDiagram?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // Relations
  rows?: DesignRow[];
  project?: Project;
}

// ── ARB Review ──

export const REVIEW_STATUSES = [
  "pending",
  "in_progress",
  "approved",
  "changes_requested",
] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const ROW_FEEDBACK_STATUSES = [
  "approved",
  "flagged",
  "rejected",
] as const;
export type RowFeedbackStatus = (typeof ROW_FEEDBACK_STATUSES)[number];

export const REVIEWER_TEAMS = ["ITS", "ITIS", "PSM", "BSA"] as const;
export type ReviewerTeam = (typeof REVIEWER_TEAMS)[number];

export interface ArbReview {
  id: string;
  submissionId: string;
  reviewerId: string;
  reviewerTeam?: ReviewerTeam;
  status: ReviewStatus;
  overallComment?: string;
  reviewedAt?: string;
  createdAt: string;
}

export interface ArbRowFeedback {
  id: string;
  reviewId: string;
  designRowId: string;
  status: RowFeedbackStatus;
  comment: string;
  createdAt: string;
}

// ── Firewall Validation (Engine output) ──

export const VALIDATION_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
] as const;
export type ValidationStatus = (typeof VALIDATION_STATUSES)[number];

export const VERDICTS = [
  "approved",
  "rejected",
  "clarification_needed",
] as const;
export type Verdict = (typeof VERDICTS)[number];

export interface FirewallValidation {
  id: string;
  projectId: string;
  jiraTicketKey: string;
  designSubmissionId?: string;
  status: ValidationStatus;
  reportUrl?: string;
  totalRules: number;
  approvedCount: number;
  rejectedCount: number;
  clarificationCount: number;
  triggeredAt: string;
  completedAt?: string;
}

export interface ValidationResult {
  id: string;
  validationId: string;
  fwRuleRef: string;
  verdict: Verdict;
  confidence: number;
  matchedDesignRowId?: string;
  policyViolations: string[];
  reason: string;
  createdAt: string;
}

// ── Common Services ──

export interface CommonService {
  id: string;
  name: string;
  protocol: Protocol;
  port: string;
  sourceZone?: Zone;
  destZone?: Zone;
  description?: string;
  providedBy?: string;
  enabled: boolean;
  createdAt: string;
}

// ── Guidelines / Knowledge Base ──

export interface Guideline {
  id: string;
  cautionId: string;
  title: string;
  description: string;
  category: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  requiredAction: "REJECT" | "REQUEST_INFO" | "ALLOW_WITH_CONTROLS";
  context?: string;
  exampleCompliant?: string;
  exampleViolation?: string;
  checkLogic?: string;
  enabled: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

// ── Firewall Rule (from JIRA request - reused from existing codebase) ──

export interface FirewallRuleService {
  proto: string;
  port: number | string;
}

export interface NetworkObject {
  objects?: string[];
  ips?: string[];
  xlates?: string[];
  desc?: string;
  zone?: string | null;
  isInternet?: boolean;
}

export interface FirewallRule {
  category: string;
  userRef: string;
  source: NetworkObject;
  destination: NetworkObject;
  services: FirewallRuleService[];
  action: string;
  gateway?: string;
  justification?: string;
  arbReviewed?: boolean;
  commonService?: boolean;
  rawFields?: Record<string, unknown>;
}

// ── User / Auth ──

export const USER_ROLES = [
  "architect",
  "project_team",
  "arb_reviewer",
  "admin",
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  team?: ReviewerTeam;
}

// ── IdaC YAML format ──

export interface IdacDocument {
  project: string;
  version: number;
  submittedBy: string;
  submittedAt: string;
  environment?: string;
  connections: IdacConnection[];
}

export interface IdacConnection {
  row: number;
  source: {
    component: string;
    technology: string;
    zone: Zone;
    ipSubnet?: string;
  };
  destination: {
    component: string;
    technology: string;
    zone: Zone;
    ipSubnet?: string;
  };
  direction: Direction;
  protocol: Protocol;
  ports: number[];
  action: Action;
  isCommonService: boolean;
  justification: string;
}

// ── Excel Metadata Sheet ──

export interface TemplateMetadata {
  projectName: string;
  architectName: string;
  submissionDate: string;
  version: number;
  environment?: Environment;
  jiraTicketRef?: string;
}
