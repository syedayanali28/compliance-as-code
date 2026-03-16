// JIRA text field parser (extract manager, justification, environment)

import { logger } from '../logging/app-logger';
import type { JiraTicket } from '../types';

export interface RulesManagerApproval {
  status: 'APPROVED' | 'PENDING' | 'NOT_FOUND';
  approved_by: string | null;
  approved_at: string | null;
  comment_excerpt: string | null;
}

export interface JiraTextExtraction {
  responsibleManager: string | null;
  responsibleManagerEmail: string | null;
  rulesCategory: string | null;
  rulesManagerApproval: RulesManagerApproval;
  environment: string[];
  notes: string[];
  statedPurpose: string | null;
  businessJustificationPresent: boolean;
  designReferencePresent: boolean;
  sraSdrReference: string | null;
  arbRequired: boolean;
  arbLink: string | null;
}

export class JiraTextParser {
  parse(ticket: JiraTicket): JiraTextExtraction {
    logger.debug(`Parsing JIRA text fields for ${ticket.key}`);

    const description = ticket.fields.description || '';
    const summary = ticket.fields.summary || '';
    const comments = ticket.comments || [];

    // Extract manager (name and email)
    const { name: managerName, email: managerEmail } = this.extractManager(ticket);

    // Extract rules category
    const rulesCategory = this.extractRulesCategory(ticket);

    // Extract Rules Manager approval from comments
    const rulesManagerApproval = this.extractRulesManagerApproval(comments);

    // Extract environment
    const environment = this.extractEnvironment(ticket);

    // Extract notes from comments
    const notes = this.extractNotes(comments);

    // Extract purpose/justification
    const statedPurpose = this.extractPurpose(description, summary);

    // Check for business justification
    const businessJustificationPresent = this.hasBusinessJustification(description);

    // Check for design reference
    const designReferencePresent = this.hasDesignReference(description);

    // Extract SRA/SDR reference
    const sraSdrReference = this.extractSraSdrReference(description);

    // Check ARB requirement
    const arbRequired = this.isArbRequired(description);
    const arbLink = this.extractArbLink(description);

    return {
      responsibleManager: managerName,
      responsibleManagerEmail: managerEmail,
      rulesCategory,
      rulesManagerApproval,
      environment,
      notes,
      statedPurpose,
      businessJustificationPresent,
      designReferencePresent,
      sraSdrReference,
      arbRequired,
      arbLink,
    };
  }

  private extractManager(ticket: JiraTicket): { name: string | null; email: string | null } {
    // Try assignee first (often the responsible manager)
    if (ticket.fields.assignee) {
      return {
        name: ticket.fields.assignee.displayName,
        email: ticket.fields.assignee.emailAddress || null,
      };
    }

    // Try custom field for manager
    if (ticket.fields.customfield_10000) {
      const managerField = ticket.fields.customfield_10000;
      // Check if it's an object with displayName (user picker field)
      if (typeof managerField === 'object' && managerField !== null) {
        const mf = managerField as { displayName?: string; emailAddress?: string };
        return {
          name: mf.displayName || null,
          email: mf.emailAddress || null,
        };
      }
      // Otherwise it's a string
      return { name: String(managerField), email: null };
    }

    // Try to find in description
    const description = ticket.fields.description || '';
    const managerPatterns = [
      /(?:responsible\s*manager|manager|owner|approved\s*by)[\s:]+([A-Za-z\s,.-]+?)(?:\n|$|,\s*email)/i,
      /(?:manager|owner):\s*([A-Za-z\s,.-]+?)(?:\n|$)/i,
    ];
    
    for (const pattern of managerPatterns) {
      const match = description.match(pattern);
      if (match) {
        return { name: match[1].trim(), email: null };
      }
    }

    return { name: null, email: null };
  }

  /**
   * Extract Rules Category from ticket fields or description
   * Common categories: New, Modification, Deletion, Emergency
   */
  private extractRulesCategory(ticket: JiraTicket): string | null {
    // Common JIRA field names for category/type
    const categoryFields = [
      'customfield_10001', // Often used for request type
      'customfield_10100', // Another common one
    ];

    for (const fieldName of categoryFields) {
      const field = ticket.fields[fieldName];
      if (field) {
        if (typeof field === 'string') {
          return field;
        }
        if (typeof field === 'object' && field !== null) {
          const f = field as { value?: string; name?: string };
          return f.value || f.name || null;
        }
      }
    }

    // Check labels for category indicators
    if (ticket.fields.labels && Array.isArray(ticket.fields.labels)) {
      const categoryLabels = ticket.fields.labels.filter((label: string) =>
        /^(new|modify|modification|delete|deletion|emergency|urgent)$/i.test(label)
      );
      if (categoryLabels.length > 0) {
        return categoryLabels[0];
      }
    }

    // Try to extract from summary or description
    const combined = `${ticket.fields.summary} ${ticket.fields.description || ''}`.toLowerCase();
    
    if (combined.includes('new rule') || combined.includes('create rule') || combined.includes('add rule')) {
      return 'New';
    }
    if (combined.includes('modify') || combined.includes('change') || combined.includes('update')) {
      return 'Modification';
    }
    if (combined.includes('delete') || combined.includes('remove') || combined.includes('decommission')) {
      return 'Deletion';
    }
    if (combined.includes('emergency') || combined.includes('urgent')) {
      return 'Emergency';
    }

    // Check issue type
    if (ticket.fields.issuetype?.name) {
      return ticket.fields.issuetype.name;
    }

    return null;
  }

  /**
   * Scan comments for Rules Manager approval status
   * Looks for approval patterns in comments
   */
  private extractRulesManagerApproval(comments: JiraTicket['comments']): RulesManagerApproval {
    if (!comments || comments.length === 0) {
      return {
        status: 'NOT_FOUND',
        approved_by: null,
        approved_at: null,
        comment_excerpt: null,
      };
    }

    // Patterns indicating approval
    const approvalPatterns = [
      /\b(?:approved|i\s*approve|rules?\s*(?:manager\s*)?approved|endorsement\s*given|endorsed|lgtm|looks?\s*good)\b/i,
      /\b(?:rm\s*approved|rules?\s*manager\s*(?:has\s*)?approved)\b/i,
      /\b(?:green\s*light|go\s*ahead|proceed)\b/i,
    ];

    // Patterns indicating rejection or pending
    const pendingPatterns = [
      /\b(?:pending|awaiting|waiting\s*for|need\s*(?:more\s*)?info|clarification\s*needed)\b/i,
      /\b(?:not\s*(?:yet\s*)?approved|rejected|declined|cannot\s*approve)\b/i,
    ];

    // Sort comments by date (newest first) to get most recent status
    const sortedComments = [...comments].sort((a, b) => 
      new Date(b.created).getTime() - new Date(a.created).getTime()
    );

    for (const comment of sortedComments) {
      const body = comment.body;

      // Check for approval
      for (const pattern of approvalPatterns) {
        if (pattern.test(body)) {
          logger.debug(`Found approval pattern in comment by ${comment.author.displayName}`);
          return {
            status: 'APPROVED',
            approved_by: comment.author.displayName,
            approved_at: comment.created,
            comment_excerpt: body.substring(0, 200) + (body.length > 200 ? '...' : ''),
          };
        }
      }

      // Check for pending/rejection (only if no approval found yet)
      for (const pattern of pendingPatterns) {
        if (pattern.test(body)) {
          logger.debug(`Found pending/rejection pattern in comment by ${comment.author.displayName}`);
          return {
            status: 'PENDING',
            approved_by: null,
            approved_at: null,
            comment_excerpt: body.substring(0, 200) + (body.length > 200 ? '...' : ''),
          };
        }
      }
    }

    return {
      status: 'NOT_FOUND',
      approved_by: null,
      approved_at: null,
      comment_excerpt: null,
    };
  }

  private extractEnvironment(ticket: JiraTicket): string[] {
    const environments = new Set<string>();
    
    // Check environment field
    if (ticket.fields.environment) {
      const envField = ticket.fields.environment.toLowerCase();
      if (envField.includes('prod')) environments.add('PROD');
      if (envField.includes('dr')) environments.add('DR');
      if (envField.includes('uat')) environments.add('UAT');
      if (envField.includes('sit')) environments.add('SIT');
      if (envField.includes('dev')) environments.add('DEV');
      if (envField.includes('poc')) environments.add('POC');
    }

    // Check description
    const description = (ticket.fields.description || '').toLowerCase();
    if (description.includes('prod')) environments.add('PROD');
    if (description.includes('dr')) environments.add('DR');
    if (description.includes('uat')) environments.add('UAT');
    if (description.includes('sit')) environments.add('SIT');
    if (description.includes('dev')) environments.add('DEV');
    if (description.includes('poc')) environments.add('POC');

    // Check summary
    const summary = (ticket.fields.summary || '').toLowerCase();
    if (summary.includes('prod')) environments.add('PROD');
    if (summary.includes('dr')) environments.add('DR');
    if (summary.includes('uat')) environments.add('UAT');

    return Array.from(environments);
  }

  private extractNotes(comments: JiraTicket['comments']): string[] {
    if (!comments || comments.length === 0) {
      return [];
    }

    const notes: string[] = [];

    for (const comment of comments) {
      const body = comment.body.trim();
      
      // Look for important notes/cautions
      const lowerBody = body.toLowerCase();
      if (
        lowerBody.includes('must not') ||
        lowerBody.includes('before') ||
        lowerBody.includes('confirm') ||
        lowerBody.includes('caution') ||
        lowerBody.includes('note:') ||
        lowerBody.includes('important')
      ) {
        notes.push(body);
      }
    }

    return notes;
  }

  private extractPurpose(description: string, summary: string): string | null {
    // Try to find purpose/justification section
    const purposeMatch = description.match(/(?:purpose|justification|reason)[\s:]+([^\n]+)/i);
    
    if (purposeMatch) {
      return purposeMatch[1].trim();
    }

    // Fall back to summary
    return summary.trim() || null;
  }

  private hasBusinessJustification(description: string): boolean {
    const lower = description.toLowerCase();
    return (
      lower.includes('business justification') ||
      lower.includes('business case') ||
      lower.includes('approved by') ||
      (lower.includes('purpose') && lower.length > 100)
    );
  }

  private hasDesignReference(description: string): boolean {
    const lower = description.toLowerCase();
    return (
      lower.includes('sdr') ||
      lower.includes('sra') ||
      lower.includes('design document') ||
      lower.includes('architecture') ||
      /design\s+ref/i.test(description)
    );
  }

  private extractSraSdrReference(description: string): string | null {
    // Look for document references
    const docMatch = description.match(/(SDR|SRA|ITPSM)[-\s]?\d+/i);
    return docMatch ? docMatch[0] : null;
  }

  private isArbRequired(description: string): boolean {
    const lower = description.toLowerCase();
    return (
      lower.includes('arb required') ||
      lower.includes('arb review') ||
      lower.includes('architecture review board')
    );
  }

  private extractArbLink(description: string): string | null {
    // Look for ARB confluence links or references
    const arbMatch = description.match(/(https?:\/\/[^\s]+arb[^\s]*)/i);
    return arbMatch ? arbMatch[1] : null;
  }
}

