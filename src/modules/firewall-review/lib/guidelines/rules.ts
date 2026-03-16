// Guideline rules engine - applies all caution checks

import { logger } from '../logging/app-logger';
import type { NormalizedFormat, CautionFinding } from '../types';
import { CAUTIONS_CATALOG } from './cautions-catalog';

export class GuidelinesEngine {
  applyAll(normalized: NormalizedFormat): NormalizedFormat {
    logger.info('Applying guideline checks');

    const allFindings: CautionFinding[] = [];

    // Run each caution check
    for (const [cautionId, caution] of Object.entries(CAUTIONS_CATALOG)) {
      logger.debug(`Running check: ${cautionId} - ${caution.title}`);
      
      try {
        const findings = caution.check_function(normalized);
        allFindings.push(...findings);
        
        if (findings.length > 0) {
          logger.info(
            `${cautionId}: ${findings.length} finding(s)`,
            { severity: findings[0].severity, status: findings[0].status }
          );
        }
      } catch (error) {
        logger.error(`Failed to run check ${cautionId}`, { error });
      }
    }

    // Sort findings by severity (HIGH > MEDIUM > LOW)
    const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    allFindings.sort((a, b) => 
      severityOrder[a.severity] - severityOrder[b.severity]
    );

    // Update normalized format with findings
    normalized.guideline_findings = allFindings;

    logger.info(
      `Guideline checks complete: ${allFindings.length} findings ` +
      `(HIGH: ${allFindings.filter(f => f.severity === 'HIGH').length}, ` +
      `MEDIUM: ${allFindings.filter(f => f.severity === 'MEDIUM').length}, ` +
      `LOW: ${allFindings.filter(f => f.severity === 'LOW').length})`
    );

    return normalized;
  }

  calculateRiskScore(normalized: NormalizedFormat): number {
    let score = 0;

    // Base score from findings
    for (const finding of normalized.guideline_findings) {
      if (finding.status === 'VIOLATION') {
        score += finding.severity === 'HIGH' ? 30 : finding.severity === 'MEDIUM' ? 15 : 5;
      } else if (finding.status === 'WARNING') {
        score += finding.severity === 'HIGH' ? 20 : finding.severity === 'MEDIUM' ? 10 : 3;
      } else {
        score += finding.severity === 'HIGH' ? 5 : 2;
      }
    }

    // Additional factors
    if (!normalized.request_summary.business_justification_present) {
      score += 10;
    }

    if (!normalized.request_summary.design_reference_present) {
      score += 10;
    }

    if (normalized.meta.environment.includes('PROD')) {
      score += 5;
    }

    // Count high-risk rules
    const internetRules = normalized.firewall_rules.filter(r => r.source.is_internet);
    score += internetRules.length * 5;

    // Cap at 100
    return Math.min(score, 100);
  }

  hasAutoRejectViolations(normalized: NormalizedFormat): boolean {
    return normalized.guideline_findings.some(
      f => f.status === 'VIOLATION' && f.required_action === 'REJECT'
    );
  }
}

