// Review orchestrator - main pipeline coordinator

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { logger } from '../logging/app-logger';
import { AuditLogger } from '../logging/audit-logger';
import { JiraClient } from '../jira/client';
import { SSOAuthenticator } from '../jira/auth-sso';
import { Normalizer } from '../normalizer/to-ai-format';
import { GuidelinesEngine } from '../guidelines/rules';
import { LLMReviewer } from '../llm/reviewer';
import { AttachmentProcessor, AttachmentProcessingResult } from '../parsers/attachment-processor';
import type { Config } from '../config';
import type { ReviewResult, NormalizedFormat } from '../types';

export class ReviewOrchestrator {
  private config: Config;
  private jiraClient: JiraClient;
  private normalizer: Normalizer;
  private guidelines: GuidelinesEngine;
  private llmReviewer: LLMReviewer;
  private auditLogger: AuditLogger;
  private attachmentProcessor: AttachmentProcessor;

  constructor(config: Config) {
    this.config = config;

    // Initialize components
    // Check if using CLI cache (interactive auth) or regular SSO cache
    const tokenCachePath = config.jira.tokenCachePath.includes('cli') 
      ? config.jira.tokenCachePath 
      : config.jira.tokenCachePath;
    
    const authenticator = new SSOAuthenticator(tokenCachePath);
    this.jiraClient = new JiraClient(config.jira.baseUrl, authenticator);
    this.normalizer = new Normalizer();
    this.guidelines = new GuidelinesEngine();
    this.llmReviewer = new LLMReviewer({
      provider: config.llm.provider,
      model: config.llm.model,
      apiKey: config.llm.apiKey,
      endpoint: config.llm.endpoint,
      temperature: config.llm.temperature,
      maxTokens: config.llm.maxTokens,
    });
    this.auditLogger = new AuditLogger(config.logging.auditLogPath);
    this.attachmentProcessor = new AttachmentProcessor();
  }

  async reviewTicket(ticketKey: string, outputDir: string): Promise<ReviewResult> {
    logger.info(`Starting review pipeline for ${ticketKey}`);

    try {
      // Step 1: Fetch JIRA ticket and attachments
      logger.info('Step 1/7: Fetching JIRA ticket...');
      const ticket = await this.jiraClient.fetchIssue(ticketKey);
      const attachments = await this.jiraClient.fetchAttachments(ticketKey);

      // Step 2: Process and store attachments
      logger.info('Step 2/7: Processing and storing attachments...');
      const attachmentResult = await this.attachmentProcessor.processAndStore(
        ticketKey,
        attachments,
        outputDir
      );
      logger.info(`Processed ${attachmentResult.summary.successful}/${attachmentResult.summary.total} attachments`);

      // Step 3: Normalize to AI-friendly format
      logger.info('Step 3/7: Normalizing data...');
      let normalized = await this.normalizer.normalize(ticket, attachments);

      // Step 4: Apply guideline checks
      logger.info('Step 4/7: Applying guideline checks...');
      normalized = this.guidelines.applyAll(normalized);

      // Step 5: Calculate risk score
      logger.info('Step 5/7: Calculating risk score...');
      const riskScore = this.guidelines.calculateRiskScore(normalized);
      logger.info(`Risk score: ${riskScore}/100`);

      // Step 6: LLM review
      logger.info('Step 6/7: Requesting LLM review...');
      const llmReview = await this.llmReviewer.review(normalized);
      normalized.llm_review = llmReview;

      // Step 7: Make final decision
      logger.info('Step 7/7: Making final decision...');
      const finalDecision = this.makeFinalDecision(normalized, riskScore);
      const suggestedComment = this.buildSuggestedComment(
        normalized,
        riskScore,
        finalDecision
      );

      // Write artifacts
      const artifacts = this.writeArtifacts(normalized, outputDir, ticketKey, attachmentResult);

      // Log audit entry
      this.logAudit(ticketKey, artifacts, finalDecision, riskScore);

      // Build result
      const result: ReviewResult = {
        normalized,
        final_decision: finalDecision,
        risk_score: riskScore,
        suggested_comment: suggestedComment,
        artifacts,
      };

      logger.info(
        `Review complete for ${ticketKey}: ${finalDecision} (risk: ${riskScore})`
      );

      return result;
    } catch (error) {
      logger.error(`Review pipeline failed for ${ticketKey}`, { error });
      throw error;
    }
  }

  private makeFinalDecision(
    normalized: NormalizedFormat,
    riskScore: number
  ): 'ACCEPT' | 'REJECT' | 'REQUEST_INFO' {
    // Rule 1: Auto-reject if high-risk violations
    if (this.guidelines.hasAutoRejectViolations(normalized)) {
      logger.info('Decision: REJECT (auto-reject violations present)');
      return 'REJECT';
    }

    // Rule 2: If LLM says REJECT or REQUEST_INFO, follow it
    if (normalized.llm_review?.decision === 'REJECT') {
      logger.info('Decision: REJECT (LLM recommendation)');
      return 'REJECT';
    }

    if (normalized.llm_review?.decision === 'REQUEST_INFO') {
      logger.info('Decision: REQUEST_INFO (LLM recommendation)');
      return 'REQUEST_INFO';
    }

    // Rule 3: Check risk score threshold
    if (riskScore >= this.config.review.riskScoreThreshold) {
      logger.info(`Decision: REJECT (risk score ${riskScore} >= threshold)`);
      return 'REJECT';
    }

    // Rule 4: Check for HIGH severity warnings
    const hasHighWarnings = normalized.guideline_findings.some(
      (f) => f.severity === 'HIGH' && f.status === 'WARNING'
    );

    if (hasHighWarnings) {
      logger.info('Decision: REQUEST_INFO (HIGH severity warnings present)');
      return 'REQUEST_INFO';
    }

    // Accept if all checks pass
    logger.info('Decision: ACCEPT (all checks passed)');
    return 'ACCEPT';
  }

  private buildSuggestedComment(
    normalized: NormalizedFormat,
    riskScore: number,
    decision: string
  ): string {
    const lines: string[] = [];

    lines.push('# Automated Firewall Rule Review\n');
    lines.push(`**Ticket**: ${normalized.meta.ticket_key}`);
    lines.push(`**Decision**: ${decision}`);
    lines.push(`**Risk Score**: ${riskScore}/100\n`);

    // Use LLM's comment if available
    if (normalized.llm_review?.suggested_jira_comment) {
      lines.push('## Review Summary\n');
      lines.push(normalized.llm_review.suggested_jira_comment);
      lines.push('');
    }

    // Add guideline findings
    if (normalized.guideline_findings.length > 0) {
      lines.push('## Guideline Check Results\n');

      const violations = normalized.guideline_findings.filter(
        (f) => f.status === 'VIOLATION'
      );
      const warnings = normalized.guideline_findings.filter(
        (f) => f.status === 'WARNING'
      );

      if (violations.length > 0) {
        lines.push('### ??Violations\n');
        for (const v of violations) {
          lines.push(`- **${v.caution_id}** (${v.severity}): ${v.evidence.join('; ')}`);
        }
        lines.push('');
      }

      if (warnings.length > 0) {
        lines.push('### ?ая? Warnings\n');
        for (const w of warnings) {
          lines.push(`- **${w.caution_id}** (${w.severity}): ${w.evidence.join('; ')}`);
        }
        lines.push('');
      }
    }

    // Add next steps
    if (decision === 'REJECT') {
      lines.push('## Next Steps\n');
      lines.push('Please address the violations listed above and resubmit the request.');
    } else if (decision === 'REQUEST_INFO') {
      lines.push('## Additional Information Required\n');
      if (normalized.llm_review?.missing_info) {
        for (const info of normalized.llm_review.missing_info) {
          lines.push(`- ${info}`);
        }
      }
    } else {
      lines.push('## Next Steps\n');
      lines.push('This request has passed automated review. Proceeding to manual verification.');
    }

    lines.push('\n---');
    lines.push('_This is an automated review. Manual verification may still be required._');

    return lines.join('\n');
  }

  private writeArtifacts(
    normalized: NormalizedFormat,
    outputDir: string,
    ticketKey: string,
    attachmentResult?: AttachmentProcessingResult
  ): { normalized_json: string; findings_json: string; llm_response_json: string; attachments_parsed_dir?: string } {
    // Ensure output directory exists
    const ticketDir = join(outputDir, ticketKey);
    if (!existsSync(ticketDir)) {
      mkdirSync(ticketDir, { recursive: true });
    }

    const normalizedPath = join(ticketDir, 'normalized.json');
    const findingsPath = join(ticketDir, 'findings.json');
    const llmPath = join(ticketDir, 'llm_response.json');

    // Write normalized data
    writeFileSync(normalizedPath, JSON.stringify(normalized, null, 2), 'utf-8');
    logger.debug(`Wrote normalized data to ${normalizedPath}`);

    // Write findings
    writeFileSync(
      findingsPath,
      JSON.stringify(
        {
          guideline_findings: normalized.guideline_findings,
          extracted_risks: normalized.extracted_risks,
        },
        null,
        2
      ),
      'utf-8'
    );
    logger.debug(`Wrote findings to ${findingsPath}`);

    // Write LLM response
    if (normalized.llm_review) {
      writeFileSync(
        llmPath,
        JSON.stringify(normalized.llm_review, null, 2),
        'utf-8'
      );
      logger.debug(`Wrote LLM response to ${llmPath}`);
    }

    return {
      normalized_json: normalizedPath,
      findings_json: findingsPath,
      llm_response_json: llmPath,
      attachments_parsed_dir: attachmentResult?.outputDirectory,
    };
  }

  private logAudit(
    ticketKey: string,
    artifacts: { normalized_json: string; findings_json: string; llm_response_json: string; attachments_parsed_dir?: string },
    decision: string,
    riskScore: number
  ): void {
    const user = process.env.USER || process.env.USERNAME || 'unknown';
    
    const artifactPaths = [
      artifacts.normalized_json,
      artifacts.findings_json,
      artifacts.llm_response_json,
    ];
    
    if (artifacts.attachments_parsed_dir) {
      artifactPaths.push(artifacts.attachments_parsed_dir);
    }
    
    const entry = this.auditLogger.createEntry(
      user,
      ticketKey,
      'fw_review_phase1',
      artifactPaths,
      decision,
      riskScore
    );

    this.auditLogger.log(entry);
    logger.info('Audit log entry written');
  }
}

