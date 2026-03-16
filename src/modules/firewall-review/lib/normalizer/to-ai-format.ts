// Normalizer - converts JIRA ticket + attachments into AI-friendly format

import { logger } from '../logging/app-logger';
import type { 
  NormalizedFormat, 
  JiraTicket, 
  JiraAttachment, 
  FirewallRule 
} from '../types';
import { ExcelFirewallParser } from '../parsers/excel-firewall-rules';
import { JiraTextParser } from '../parsers/jira-text';

export class Normalizer {
  private excelParser: ExcelFirewallParser;
  private textParser: JiraTextParser;

  constructor() {
    this.excelParser = new ExcelFirewallParser();
    this.textParser = new JiraTextParser();
  }

  async normalize(
    ticket: JiraTicket,
    attachments: JiraAttachment[]
  ): Promise<NormalizedFormat> {
    logger.info(`Normalizing ticket ${ticket.key}`);

    // Parse text fields
    const textExtraction = this.textParser.parse(ticket);

    // Parse firewall rules from Excel attachments
    const firewallRules = await this.parseFirewallRules(attachments);

    // Extract raw JIRA fields for LLM context (sanitize large/binary fields)
    const rawJiraFields = this.extractRawFields(ticket);

    // Build normalized format
    const normalized: NormalizedFormat = {
      meta: {
        ticket_key: ticket.key,
        fetched_at: new Date().toISOString(),
        requester: {
          name: ticket.fields.reporter?.displayName || null,
          email: ticket.fields.reporter?.emailAddress || null,
        },
        responsible_manager: {
          name: textExtraction.responsibleManager,
          email: textExtraction.responsibleManagerEmail,
        },
        rules_category: textExtraction.rulesCategory,
        rules_manager_approval: textExtraction.rulesManagerApproval,
        arb_required: textExtraction.arbRequired,
        arb_link: textExtraction.arbLink,
        environment: textExtraction.environment,
        notes: textExtraction.notes,
        raw_jira_fields: rawJiraFields,
      },
      request_summary: {
        stated_purpose: textExtraction.statedPurpose,
        business_justification_present: textExtraction.businessJustificationPresent,
        design_reference_present: textExtraction.designReferencePresent,
        sra_sdr_reference: textExtraction.sraSdrReference,
      },
      firewall_rules: firewallRules,
      extracted_risks: this.extractRisks(firewallRules, textExtraction),
      guideline_findings: [], // Will be populated by guideline checker
      llm_review: null, // Will be populated by LLM reviewer
    };

    logger.info(
      `Normalized ticket ${ticket.key}: ${firewallRules.length} rules, ` +
      `${normalized.extracted_risks.length} initial risks`
    );

    return normalized;
  }

  /**
   * Extract raw JIRA fields for LLM context
   * Sanitizes/limits large fields to prevent context overflow
   */
  private extractRawFields(ticket: JiraTicket): Record<string, unknown> {
    const rawFields: Record<string, unknown> = {};
    
    // Fields to always include
    const includeFields = [
      'summary', 'description', 'status', 'priority', 'labels',
      'components', 'issuetype', 'project', 'resolution', 'environment',
      'created', 'updated', 'assignee', 'reporter',
    ];

    for (const [key, value] of Object.entries(ticket.fields)) {
      // Skip attachment data (already handled separately)
      if (key === 'attachment') continue;
      
      // Skip very large fields
      if (typeof value === 'string' && value.length > 10000) {
        rawFields[key] = `[Content truncated - ${value.length} chars]`;
        continue;
      }

      // Include known fields or custom fields
      if (includeFields.includes(key) || key.startsWith('customfield_')) {
        rawFields[key] = value;
      }
    }

    // Add comments summary
    if (ticket.comments && ticket.comments.length > 0) {
      rawFields['_comments_count'] = ticket.comments.length;
      rawFields['_recent_comments'] = ticket.comments.slice(-5).map(c => ({
        author: c.author.displayName,
        created: c.created,
        excerpt: c.body.substring(0, 500) + (c.body.length > 500 ? '...' : ''),
      }));
    }

    return rawFields;
  }

  private async parseFirewallRules(attachments: JiraAttachment[]): Promise<FirewallRule[]> {
    const allRules: FirewallRule[] = [];

    for (const attachment of attachments) {
      // Check if it's an Excel file
      if (
        !attachment.filename.match(/\.(xlsx?|xls)$/i) &&
        !attachment.mimeType.includes('spreadsheet') &&
        !attachment.mimeType.includes('excel')
      ) {
        logger.debug(`Skipping non-Excel attachment: ${attachment.filename}`);
        continue;
      }

      logger.info(`Parsing firewall rules from: ${attachment.filename}`);

      try {
        const rules = this.excelParser.parseFromBase64(attachment.content);
        allRules.push(...rules);
      } catch (error) {
        logger.error(`Failed to parse ${attachment.filename}`, { error });
      }
    }

    return allRules;
  }

  private extractRisks(
    rules: FirewallRule[],
    textExtraction: ReturnType<typeof import('../parsers/jira-text').JiraTextParser.prototype.parse>
  ): string[] {
    const risks: string[] = [];

    // Quick initial risk extraction (before detailed guideline checks)
    for (const rule of rules) {
      if (rule.source.is_internet) {
        risks.push(`Rule ${rule.user_ref}: Internet source detected`);
      }

      if (rule.services.some(s => s.proto === 'any' || s.port === 'any')) {
        risks.push(`Rule ${rule.user_ref}: 'Any' service detected`);
      }

      const privilegedPorts = [22, 23, 3389, 445, 389, 636];
      if (rule.services.some(s => 
        typeof s.port === 'number' && privilegedPorts.includes(s.port)
      )) {
        risks.push(`Rule ${rule.user_ref}: Privileged port detected`);
      }
    }

    // Check for missing justification
    if (!textExtraction.businessJustificationPresent) {
      risks.push('Missing business justification');
    }

    if (!textExtraction.designReferencePresent) {
      risks.push('Missing design reference');
    }

    return risks;
  }
}

