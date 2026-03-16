// Caution catalog - definitions of all security cautions

import type { CautionDefinition, CautionFinding, NormalizedFormat } from '../types';

export const CAUTIONS_CATALOG: Record<string, CautionDefinition> = {
  'C-IN-01': {
    id: 'C-IN-01',
    title: 'Incoming Internet Access',
    description: 'Reject unless sufficient security measures are evidenced in ticket/attachments.',
    severity: 'HIGH',
    check_function: checkIncomingInternet,
  },
  'C-VDI-01': {
    id: 'C-VDI-01',
    title: 'DEV VDI Access to Production',
    description: 'DEV VDI is not equivalent to ITA VDI. Admin access to prod/privileged systems from DEV VDI is high risk.',
    severity: 'HIGH',
    check_function: checkDevVdiAccess,
  },
  'C-OUT-01': {
    id: 'C-OUT-01',
    title: 'Direct Outgoing Internet Access',
    description: 'Direct outbound Internet access should use proxy where possible.',
    severity: 'MEDIUM',
    check_function: checkOutgoingInternet,
  },
  'C-SEC-01': {
    id: 'C-SEC-01',
    title: 'Privileged Ports & SSH',
    description: 'Privileged ports (SSH, RDP, LDAP, etc.) across zones or from weak zones require special attention.',
    severity: 'HIGH',
    check_function: checkPrivilegedPorts,
  },
  'C-SEC-02': {
    id: 'C-SEC-02',
    title: 'Unencrypted Traffic',
    description: 'Plaintext protocols (HTTP/80, FTP/21, Telnet/23) across zones should be rejected unless justified and compensated.',
    severity: 'MEDIUM',
    check_function: checkUnencryptedTraffic,
  },
  'C-DES-01': {
    id: 'C-DES-01',
    title: 'Missing Design Reference',
    description: 'Rule does not align with design. New rules require SDR/SRA/design reference.',
    severity: 'MEDIUM',
    check_function: checkDesignReference,
  },
  'C-RULE-01': {
    id: 'C-RULE-01',
    title: 'All Ports Not Allowed',
    description: 'Service "any", "all", or overly broad port ranges are not allowed.',
    severity: 'HIGH',
    check_function: checkAllPorts,
  },
  'C-ZONE-01': {
    id: 'C-ZONE-01',
    title: 'All Ports Across Zones',
    description: 'Broad service access across zones needs ITS endorsement.',
    severity: 'HIGH',
    check_function: checkCrossZoneAllPorts,
  },
  'C-OA-01': {
    id: 'C-OA-01',
    title: 'Internet to OA Access',
    description: 'Internet IP cannot access OA zone directly.',
    severity: 'HIGH',
    check_function: checkInternetToOA,
  },
  'C-MGMT-01': {
    id: 'C-MGMT-01',
    title: 'Any Internet to DMZ',
    description: 'Any Internet IP to DMZ needs management endorsement.',
    severity: 'HIGH',
    check_function: checkAnyInternetToDMZ,
  },
  // Mandatory workflow field checks
  'C-WF-01': {
    id: 'C-WF-01',
    title: 'Missing Rules Category',
    description: 'Request must specify the rules category (New, Modification, Deletion, etc.).',
    severity: 'MEDIUM',
    check_function: checkMissingRulesCategory,
  },
  'C-WF-02': {
    id: 'C-WF-02',
    title: 'Missing Responsible Manager',
    description: 'Request must have an identified responsible manager.',
    severity: 'MEDIUM',
    check_function: checkMissingResponsibleManager,
  },
  'C-WF-03': {
    id: 'C-WF-03',
    title: 'Missing Rules Manager Approval',
    description: 'Rules Manager approval is required for firewall rule changes.',
    severity: 'HIGH',
    check_function: checkMissingRulesManagerApproval,
  },
  'C-WF-04': {
    id: 'C-WF-04',
    title: 'Missing ARB Link',
    description: 'ARB review link is required when ARB review is needed.',
    severity: 'HIGH',
    check_function: checkMissingArbLink,
  },
};

// Check functions

function checkIncomingInternet(normalized: NormalizedFormat): CautionFinding[] {
  const findings: CautionFinding[] = [];

  for (const rule of normalized.firewall_rules) {
    if (rule.source.is_internet) {
      const evidence: string[] = [
        'Source indicates Internet',
      ];

      // Check if in POC environment
      if (normalized.meta.environment.includes('POC')) {
        evidence.push('POC system - requires hardening controls');
      }

      // Check for security measures mentioned
      const hasSecurityMeasures = 
        rule.justification?.toLowerCase().includes('waf') ||
        rule.justification?.toLowerCase().includes('hardening') ||
        rule.justification?.toLowerCase().includes('security');

      if (!hasSecurityMeasures) {
        evidence.push('No hardening controls mentioned');
      }

      const severity = hasSecurityMeasures ? 'MEDIUM' : 'HIGH';
      const status = hasSecurityMeasures ? 'WARNING' : 'VIOLATION';
      const action = hasSecurityMeasures ? 'ALLOW_WITH_CONTROLS' : 'REJECT';

      findings.push({
        caution_id: 'C-IN-01',
        severity,
        status,
        rule_refs: [rule.user_ref],
        evidence,
        required_action: action,
      });
    }
  }

  return findings;
}

function checkDevVdiAccess(normalized: NormalizedFormat): CautionFinding[] {
  const findings: CautionFinding[] = [];

  for (const rule of normalized.firewall_rules) {
    const sourceStr = JSON.stringify(rule.source).toLowerCase();
    const destStr = JSON.stringify(rule.destination).toLowerCase();

    const isDevVdi = sourceStr.includes('dev') && sourceStr.includes('vdi');
    const isProdDest = destStr.includes('prod') || normalized.meta.environment.includes('PROD');
    const isPrivilegedPort = rule.services.some(s => 
      typeof s.port === 'number' && [22, 23, 3389, 445, 389, 636].includes(s.port)
    );

    if (isDevVdi && isProdDest && isPrivilegedPort) {
      findings.push({
        caution_id: 'C-VDI-01',
        severity: 'HIGH',
        status: 'VIOLATION',
        rule_refs: [rule.user_ref],
        evidence: [
          'Source indicates DEV VDI',
          'Destination is production system',
          'Privileged port access',
        ],
        required_action: 'REJECT',
      });
    }
  }

  return findings;
}

function checkOutgoingInternet(normalized: NormalizedFormat): CautionFinding[] {
  const findings: CautionFinding[] = [];

  for (const rule of normalized.firewall_rules) {
    const destStr = JSON.stringify(rule.destination).toLowerCase();
    const isInternetDest = 
      destStr.includes('internet') || 
      destStr.includes('any') ||
      rule.destination.is_internet;

    if (isInternetDest) {
      const hasProxyMention = 
        rule.justification?.toLowerCase().includes('proxy') ||
        normalized.request_summary.stated_purpose?.toLowerCase().includes('proxy');

      findings.push({
        caution_id: 'C-OUT-01',
        severity: 'MEDIUM',
        status: hasProxyMention ? 'INFO' : 'WARNING',
        rule_refs: [rule.user_ref],
        evidence: [
          'Outbound Internet access',
          hasProxyMention ? 'Proxy mentioned' : 'No proxy mentioned',
        ],
        required_action: hasProxyMention ? 'ALLOW_WITH_CONTROLS' : 'REQUEST_INFO',
      });
    }
  }

  return findings;
}

function checkPrivilegedPorts(normalized: NormalizedFormat): CautionFinding[] {
  const findings: CautionFinding[] = [];
  const privilegedPorts = [22, 23, 3389, 445, 389, 636, 88, 135, 139, 5985, 5986];

  for (const rule of normalized.firewall_rules) {
    const hasPrivilegedPort = rule.services.some(s => 
      typeof s.port === 'number' && privilegedPorts.includes(s.port)
    );

    if (hasPrivilegedPort) {
      const srcZone = rule.source.zone?.toLowerCase() || '';
      const dstZone = rule.destination.zone?.toLowerCase() || '';
      const crossZone = srcZone && dstZone && srcZone !== dstZone;
      const fromInternet = rule.source.is_internet;

      if (crossZone || fromInternet) {
        findings.push({
          caution_id: 'C-SEC-01',
          severity: 'HIGH',
          status: 'WARNING',
          rule_refs: [rule.user_ref],
          evidence: [
            `Privileged ports: ${rule.services.filter(s => 
              typeof s.port === 'number' && privilegedPorts.includes(s.port)
            ).map(s => s.port).join(', ')}`,
            crossZone ? `Cross-zone: ${srcZone} -> ${dstZone}` : 'From Internet',
          ],
          required_action: 'REQUEST_INFO',
        });
      }
    }
  }

  return findings;
}

function checkUnencryptedTraffic(normalized: NormalizedFormat): CautionFinding[] {
  const findings: CautionFinding[] = [];
  const unencryptedPorts = [80, 21, 23, 69, 161];

  for (const rule of normalized.firewall_rules) {
    const hasUnencrypted = rule.services.some(s => 
      typeof s.port === 'number' && unencryptedPorts.includes(s.port)
    );

    if (hasUnencrypted) {
      const srcZone = rule.source.zone?.toLowerCase() || '';
      const dstZone = rule.destination.zone?.toLowerCase() || '';
      const crossZone = srcZone && dstZone && srcZone !== dstZone;

      if (crossZone) {
        findings.push({
          caution_id: 'C-SEC-02',
          severity: 'MEDIUM',
          status: 'WARNING',
          rule_refs: [rule.user_ref],
          evidence: [
            `Unencrypted protocols: ${rule.services.filter(s => 
              typeof s.port === 'number' && unencryptedPorts.includes(s.port)
            ).map(s => `${s.proto}/${s.port}`).join(', ')}`,
            `Cross-zone: ${srcZone} -> ${dstZone}`,
          ],
          required_action: 'REQUEST_INFO',
        });
      }
    }
  }

  return findings;
}

function checkDesignReference(normalized: NormalizedFormat): CautionFinding[] {
  const findings: CautionFinding[] = [];

  if (!normalized.request_summary.design_reference_present) {
    const allRefs = normalized.firewall_rules.map(r => r.user_ref);
    
    findings.push({
      caution_id: 'C-DES-01',
      severity: 'MEDIUM',
      status: 'WARNING',
      rule_refs: allRefs.slice(0, 5), // Limit to first 5
      evidence: [
        'No SDR/SRA/design reference found in ticket',
        'Cannot verify alignment with approved design',
      ],
      required_action: 'REQUEST_INFO',
    });
  }

  return findings;
}

function checkAllPorts(normalized: NormalizedFormat): CautionFinding[] {
  const findings: CautionFinding[] = [];

  for (const rule of normalized.firewall_rules) {
    const hasAllPorts = rule.services.some(s => 
      s.port === 'any' || 
      s.port === 'all' ||
      s.proto === 'any' ||
      (typeof s.port === 'string' && s.port.includes('*'))
    );

    if (hasAllPorts) {
      findings.push({
        caution_id: 'C-RULE-01',
        severity: 'HIGH',
        status: 'VIOLATION',
        rule_refs: [rule.user_ref],
        evidence: [
          '"Any" or "all" service specified',
          'Violates least privilege principle',
        ],
        required_action: 'REJECT',
      });
    }
  }

  return findings;
}

function checkCrossZoneAllPorts(normalized: NormalizedFormat): CautionFinding[] {
  const findings: CautionFinding[] = [];

  for (const rule of normalized.firewall_rules) {
    const srcZone = rule.source.zone?.toLowerCase() || '';
    const dstZone = rule.destination.zone?.toLowerCase() || '';
    const crossZone = srcZone && dstZone && srcZone !== dstZone;
    
    const hasBroadService = 
      rule.services.length > 5 || 
      rule.services.some(s => s.port === 'any' || s.proto === 'any');

    if (crossZone && hasBroadService) {
      // Check for ITS endorsement
      const hasEndorsement = 
        normalized.meta.notes.some(n => n.toLowerCase().includes('its')) ||
        rule.justification?.toLowerCase().includes('its endorsed');

      if (!hasEndorsement) {
        findings.push({
          caution_id: 'C-ZONE-01',
          severity: 'HIGH',
          status: 'VIOLATION',
          rule_refs: [rule.user_ref],
          evidence: [
            `Cross-zone: ${srcZone} -> ${dstZone}`,
            'Broad service access',
            'No ITS endorsement found',
          ],
          required_action: 'REJECT',
        });
      }
    }
  }

  return findings;
}

function checkInternetToOA(normalized: NormalizedFormat): CautionFinding[] {
  const findings: CautionFinding[] = [];

  for (const rule of normalized.firewall_rules) {
    const isInternet = rule.source.is_internet;
    const destStr = JSON.stringify(rule.destination).toLowerCase();
    const isOA = destStr.includes('oa') && !destStr.includes('dmz');

    if (isInternet && isOA) {
      findings.push({
        caution_id: 'C-OA-01',
        severity: 'HIGH',
        status: 'VIOLATION',
        rule_refs: [rule.user_ref],
        evidence: [
          'Internet source',
          'OA zone destination',
          'Direct Internet to OA is prohibited',
        ],
        required_action: 'REJECT',
      });
    }
  }

  return findings;
}

function checkAnyInternetToDMZ(normalized: NormalizedFormat): CautionFinding[] {
  const findings: CautionFinding[] = [];

  for (const rule of normalized.firewall_rules) {
    const srcStr = JSON.stringify(rule.source).toLowerCase();
    const isAnyInternet = 
      (srcStr.includes('any') || srcStr.includes('0.0.0.0')) && 
      rule.source.is_internet;
    
    const destStr = JSON.stringify(rule.destination).toLowerCase();
    const isDMZ = destStr.includes('dmz');

    if (isAnyInternet && isDMZ) {
      // Check for management endorsement
      const hasEndorsement = 
        normalized.meta.notes.some(n => 
          n.toLowerCase().includes('approved') || 
          n.toLowerCase().includes('endorsed')
        ) ||
        normalized.meta.responsible_manager.name !== null;

      if (!hasEndorsement) {
        findings.push({
          caution_id: 'C-MGMT-01',
          severity: 'HIGH',
          status: 'WARNING',
          rule_refs: [rule.user_ref],
          evidence: [
            'Any Internet IP (unrestricted)',
            'DMZ destination',
            'No management endorsement found',
          ],
          required_action: 'REQUEST_INFO',
        });
      }
    }
  }

  return findings;
}

// Workflow mandatory field checks

function checkMissingRulesCategory(normalized: NormalizedFormat): CautionFinding[] {
  const findings: CautionFinding[] = [];

  if (!normalized.meta.rules_category) {
    findings.push({
      caution_id: 'C-WF-01',
      severity: 'MEDIUM',
      status: 'WARNING',
      rule_refs: [],
      evidence: [
        'Rules category not specified',
        'Unable to determine if request is New, Modification, or Deletion',
      ],
      required_action: 'REQUEST_INFO',
    });
  }

  return findings;
}

function checkMissingResponsibleManager(normalized: NormalizedFormat): CautionFinding[] {
  const findings: CautionFinding[] = [];

  if (!normalized.meta.responsible_manager.name) {
    findings.push({
      caution_id: 'C-WF-02',
      severity: 'MEDIUM',
      status: 'WARNING',
      rule_refs: [],
      evidence: [
        'Responsible manager not identified',
        'Manager approval required for firewall changes',
      ],
      required_action: 'REQUEST_INFO',
    });
  }

  return findings;
}

function checkMissingRulesManagerApproval(normalized: NormalizedFormat): CautionFinding[] {
  const findings: CautionFinding[] = [];

  const approval = normalized.meta.rules_manager_approval;

  if (approval.status === 'NOT_FOUND') {
    findings.push({
      caution_id: 'C-WF-03',
      severity: 'HIGH',
      status: 'WARNING',
      rule_refs: [],
      evidence: [
        'No Rules Manager approval found in comments',
        'Rules Manager endorsement required before implementation',
      ],
      required_action: 'REQUEST_INFO',
    });
  } else if (approval.status === 'PENDING') {
    findings.push({
      caution_id: 'C-WF-03',
      severity: 'MEDIUM',
      status: 'INFO',
      rule_refs: [],
      evidence: [
        'Rules Manager approval is pending',
        approval.comment_excerpt ? `Last comment: "${approval.comment_excerpt}"` : '',
      ].filter(Boolean),
      required_action: 'REQUEST_INFO',
    });
  }
  // If APPROVED, no finding needed

  return findings;
}

function checkMissingArbLink(normalized: NormalizedFormat): CautionFinding[] {
  const findings: CautionFinding[] = [];

  // Only check if ARB is required
  if (normalized.meta.arb_required && !normalized.meta.arb_link) {
    findings.push({
      caution_id: 'C-WF-04',
      severity: 'HIGH',
      status: 'VIOLATION',
      rule_refs: [],
      evidence: [
        'ARB review is indicated as required',
        'No ARB review link provided',
        'ARB approval must be documented before implementation',
      ],
      required_action: 'REJECT',
    });
  }

  return findings;
}

