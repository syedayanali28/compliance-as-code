// Core type definitions for Firewall Review System

export interface Meta {
  ticket_key: string;
  fetched_at: string;
  requester: {
    name: string | null;
    email: string | null;
  };
  responsible_manager: {
    name: string | null;
    email: string | null;
  };
  rules_category: string | null;
  rules_manager_approval: {
    status: 'APPROVED' | 'PENDING' | 'NOT_FOUND';
    approved_by: string | null;
    approved_at: string | null;
    comment_excerpt: string | null;
  };
  arb_required: boolean;
  arb_link: string | null;
  environment: string[];
  notes: string[];
  /** Raw JIRA fields for LLM context */
  raw_jira_fields?: Record<string, unknown>;
}

export interface RequestSummary {
  stated_purpose: string | null;
  business_justification_present: boolean;
  design_reference_present: boolean;
  sra_sdr_reference: string | null;
}

export interface NetworkObject {
  objects?: string[];
  ips?: string[];
  xlates?: string[];
  desc?: string;
  zone?: string | null;
  is_internet?: boolean;
}

export interface Service {
  proto: string;
  port: number | string;
}

export interface FirewallRule {
  category: string;
  user_ref: string;
  source: NetworkObject;
  destination: NetworkObject;
  services: Service[];
  action: string;
  gateway?: string;
  justification?: string;
  arb_reviewed?: boolean;
  common_service?: boolean;
  raw_fields?: Record<string, unknown>;
}

export interface CautionFinding {
  caution_id: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'VIOLATION' | 'WARNING' | 'INFO';
  rule_refs: string[];
  evidence: string[];
  required_action: 'REJECT' | 'REQUEST_INFO' | 'ALLOW_WITH_CONTROLS';
}

export interface LLMViolation {
  caution_id: string;
  explanation: string;
}

export interface LLMReview {
  decision: 'ACCEPT' | 'REJECT' | 'REQUEST_INFO';
  confidence: number;
  summary: string;
  violations: LLMViolation[];
  missing_info: string[];
  suggested_jira_comment: string;
}

export interface NormalizedFormat {
  meta: Meta;
  request_summary: RequestSummary;
  firewall_rules: FirewallRule[];
  extracted_risks: string[];
  guideline_findings: CautionFinding[];
  llm_review: LLMReview | null;
}

export interface JiraTicket {
  key: string;
  fields: {
    summary: string;
    description: string | null;
    reporter: {
      displayName: string;
      emailAddress: string;
    } | null;
    created: string;
    updated: string;
    status: {
      name: string;
    };
    customfield_10000?: string; // manager
    environment?: string;
    // Common JIRA workflow fields - actual field IDs may vary by instance
    priority?: { name: string };
    assignee?: { displayName: string; emailAddress: string } | null;
    labels?: string[];
    components?: { name: string }[];
    issuetype?: { name: string };
    project?: { key: string; name: string };
    resolution?: { name: string } | null;
    /** All fields for flexible access */
    [key: string]: unknown;
  };
  comments?: {
    body: string;
    author: {
      displayName: string;
      emailAddress?: string;
    };
    created: string;
  }[];
}

export interface JiraAttachment {
  id: string;
  filename: string;
  mimeType: string;
  content: string;
  size: number;
}

export interface AuditLogEntry {
  timestamp: string;
  user: string;
  ticket_key: string;
  action: string;
  artifacts: string[];
  final_decision: string;
  risk_score: number;
}

export interface CautionDefinition {
  id: string;
  title: string;
  description: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  check_function: (normalized: NormalizedFormat) => CautionFinding[];
}

export interface ReviewResult {
  normalized: NormalizedFormat;
  final_decision: 'ACCEPT' | 'REJECT' | 'REQUEST_INFO';
  risk_score: number;
  suggested_comment: string;
  artifacts: {
    normalized_json: string;
    findings_json: string;
    llm_response_json: string;
    attachments_parsed_dir?: string;
  };
}

// Re-export attachment processor types for convenience
export type {
  ParsedAttachment,
  ParsedContent,
  ExcelParsedContent,
  PdfParsedContent,
  WordParsedContent,
  ImageParsedContent,
  UnknownContent,
  AttachmentProcessingResult,
} from '../parsers/attachment-processor';

