// LLM prompt builder - constructs the review prompt

import type { NormalizedFormat } from '../types';
import { CAUTIONS_CATALOG } from '../guidelines/cautions-catalog';

export class PromptBuilder {
  buildReviewPrompt(normalized: NormalizedFormat): string {
    const sections: string[] = [];

    // System context
    sections.push(
      '# Firewall Rule Review Task\n\n' +
      'You are a senior security engineer reviewing a firewall rule request from HKMA JIRA. ' +
      'Your task is to analyze the request and provide a recommendation: ACCEPT, REJECT, or REQUEST_INFO.\n\n' +
      'You must respond with ONLY valid JSON following this exact schema:\n' +
      '```json\n' +
      '{\n' +
      '  "decision": "ACCEPT|REJECT|REQUEST_INFO",\n' +
      '  "confidence": 0.0,\n' +
      '  "summary": "one paragraph explanation",\n' +
      '  "violations": [\n' +
      '    {"caution_id": "C-XX-XX", "explanation": "detailed explanation"}\n' +
      '  ],\n' +
      '  "missing_info": ["list of missing information"],\n' +
      '  "suggested_jira_comment": "Draft comment text to post to JIRA ticket"\n' +
      '}\n' +
      '```\n'
    );

    // Ticket metadata
    sections.push(
      '## Ticket Information\n\n' +
      `- **Ticket**: ${normalized.meta.ticket_key}\n` +
      `- **Requester**: ${normalized.meta.requester.name || 'Unknown'}\n` +
      `- **Manager**: ${normalized.meta.responsible_manager.name || 'Not specified'}\n` +
      `- **Environment**: ${normalized.meta.environment.join(', ') || 'Not specified'}\n` +
      `- **ARB Required**: ${normalized.meta.arb_required ? 'Yes' : 'No'}\n`
    );

    if (normalized.meta.notes.length > 0) {
      sections.push(
        '### Important Notes\n' +
        normalized.meta.notes.map(note => `- ${note}`).join('\n')
      );
    }

    // Request summary
    sections.push(
      '\n## Request Summary\n\n' +
      `- **Purpose**: ${normalized.request_summary.stated_purpose || 'Not specified'}\n` +
      `- **Business Justification**: ${normalized.request_summary.business_justification_present ? 'Present' : 'Missing'}\n` +
      `- **Design Reference**: ${normalized.request_summary.design_reference_present ? 'Present' : 'Missing'}\n` +
      `- **SRA/SDR Reference**: ${normalized.request_summary.sra_sdr_reference || 'None'}\n`
    );

    // Firewall rules
    sections.push(
      '\n## Firewall Rules (' + normalized.firewall_rules.length + ' total)\n'
    );

    for (const rule of normalized.firewall_rules.slice(0, 20)) { // Limit to 20 for prompt size
      sections.push(
        `\n### Rule ${rule.user_ref}\n` +
        `- **Category**: ${rule.category}\n` +
        `- **Source**: ${this.formatNetworkObject(rule.source)}\n` +
        `- **Destination**: ${this.formatNetworkObject(rule.destination)}\n` +
        `- **Services**: ${rule.services.map(s => `${s.proto}/${s.port}`).join(', ')}\n` +
        `- **Action**: ${rule.action}\n` +
        `- **Gateway**: ${rule.gateway || 'N/A'}\n` +
        `- **Justification**: ${rule.justification || 'None provided'}\n` +
        `- **ARB Reviewed**: ${rule.arb_reviewed ? 'Yes' : 'No'}\n`
      );
    }

    if (normalized.firewall_rules.length > 20) {
      sections.push(`\n_...and ${normalized.firewall_rules.length - 20} more rules_\n`);
    }

    // Guideline findings
    if (normalized.guideline_findings.length > 0) {
      sections.push(
        '\n## Guideline Check Results\n\n' +
        'The following automated checks have been performed:\n'
      );

      for (const finding of normalized.guideline_findings) {
        const caution = CAUTIONS_CATALOG[finding.caution_id];
        sections.push(
          `\n### ${finding.caution_id}: ${caution?.title || 'Unknown'}\n` +
          `- **Severity**: ${finding.severity}\n` +
          `- **Status**: ${finding.status}\n` +
          `- **Rules Affected**: ${finding.rule_refs.join(', ')}\n` +
          `- **Evidence**:\n${finding.evidence.map(e => `  - ${e}`).join('\n')}\n` +
          `- **Required Action**: ${finding.required_action}\n`
        );
      }
    }

    // Caution reference
    sections.push(
      '\n## Security Cautions Reference\n\n' +
      'Consider these security guidelines:\n'
    );

    for (const [id, caution] of Object.entries(CAUTIONS_CATALOG)) {
      sections.push(
        `- **${id}**: ${caution.title} (${caution.severity})\n` +
        `  ${caution.description}\n`
      );
    }

    // Instructions
    sections.push(
      '\n## Review Instructions\n\n' +
      '1. Review all firewall rules and check for security risks\n' +
      '2. Consider the guideline findings above\n' +
      '3. Evaluate if sufficient justification and security measures are present\n' +
      '4. Make a decision:\n' +
      '   - **ACCEPT**: Rules are safe and properly justified\n' +
      '   - **REJECT**: Critical security violations or missing requirements\n' +
      '   - **REQUEST_INFO**: Need additional information or clarification\n' +
      '5. Provide a professional JIRA comment explaining your decision\n\n' +
      '**Important**: Respond with ONLY the JSON object, no additional text.'
    );

    return sections.join('\n');
  }

  private formatNetworkObject(obj: { objects?: string[]; ips?: string[]; zone?: string | null; desc?: string; is_internet?: boolean }): string {
    const parts: string[] = [];
    
    if (obj.objects && obj.objects.length > 0) {
      parts.push(`Objects: ${obj.objects.join(', ')}`);
    }
    
    if (obj.ips && obj.ips.length > 0) {
      parts.push(`IPs: ${obj.ips.join(', ')}`);
    }
    
    if (obj.zone) {
      parts.push(`Zone: ${obj.zone}`);
    }
    
    if (obj.desc) {
      parts.push(`(${obj.desc})`);
    }
    
    if (obj.is_internet) {
      parts.push('[INTERNET]');
    }
    
    return parts.join(' | ') || 'N/A';
  }
}

