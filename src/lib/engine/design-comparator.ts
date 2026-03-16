/**
 * Design-vs-Request Comparator
 *
 * For each firewall rule in a request, finds matching design rows
 * from the approved design submission and scores the match.
 */

import type { DesignRow, FirewallRule, Zone, Verdict } from "@/types";

export interface DesignMatchResult {
  fwRuleRef: string;
  verdict: Verdict;
  confidence: number;
  matchedDesignRowId?: string;
  matchedDesignRowNumber?: number;
  reason: string;
}

interface MatchScore {
  designRow: DesignRow;
  score: number;
  details: string[];
}

// ── Zone normalization ──

function normalizeZone(zone: string | null | undefined): Zone | null {
  if (!zone) return null;
  const lower = zone.toLowerCase().trim();
  if (lower.includes("internet") || lower === "external" || lower === "any") return "Internet";
  if (lower.includes("dmz") || lower.includes("demilitarized")) return "DMZ";
  if (lower.includes("intranet") || lower.includes("oa") || lower.includes("internal")) return "Intranet";
  return null;
}

// ── Port matching ──

function parsePorts(portStr: string): Set<number> {
  const ports = new Set<number>();
  const parts = portStr.split(/[,;\s]+/);
  for (const p of parts) {
    const num = parseInt(p.trim(), 10);
    if (!isNaN(num)) ports.add(num);
  }
  return ports;
}

function portsOverlap(designPorts: string, fwPorts: { proto: string; port: number | string }[]): number {
  const designSet = parsePorts(designPorts);
  if (designSet.size === 0) return 0;

  let matchCount = 0;
  for (const svc of fwPorts) {
    const port = typeof svc.port === "number" ? svc.port : parseInt(String(svc.port), 10);
    if (!isNaN(port) && designSet.has(port)) {
      matchCount++;
    }
  }

  return fwPorts.length > 0 ? matchCount / fwPorts.length : 0;
}

// ── Component name similarity (simple trigram-based) ──

function trigrams(str: string): Set<string> {
  const s = str.toLowerCase().replace(/[^a-z0-9]/g, "");
  const result = new Set<string>();
  for (let i = 0; i <= s.length - 3; i++) {
    result.add(s.substring(i, i + 3));
  }
  return result;
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const tA = trigrams(a);
  const tB = trigrams(b);
  if (tA.size === 0 || tB.size === 0) return 0;

  let intersection = 0;
  for (const t of tA) {
    if (tB.has(t)) intersection++;
  }
  return (2 * intersection) / (tA.size + tB.size);
}

// ── Scoring a single FW rule against a single design row ──

function scoreMatch(rule: FirewallRule, designRow: DesignRow): MatchScore {
  let score = 0;
  const details: string[] = [];

  // Zone match (most important — 40 points)
  const srcZone = normalizeZone(rule.source.zone);
  const dstZone = normalizeZone(rule.destination.zone);

  if (srcZone === designRow.sourceZone) {
    score += 20;
    details.push(`Source zone matches (${srcZone})`);
  }
  if (dstZone === designRow.destZone) {
    score += 20;
    details.push(`Destination zone matches (${dstZone})`);
  }

  // Port/protocol match (25 points)
  const protocolMatch =
    rule.services.some((s) => s.proto.toUpperCase() === designRow.protocol) ||
    designRow.protocol === "Any";
  if (protocolMatch) {
    score += 10;
    details.push("Protocol matches");
  }

  const portOverlap = portsOverlap(designRow.ports, rule.services);
  score += Math.round(portOverlap * 15);
  if (portOverlap > 0) {
    details.push(`Port overlap: ${Math.round(portOverlap * 100)}%`);
  }

  // Component name similarity (25 points)
  const srcObjects = (rule.source.objects ?? []).join(" ");
  const dstObjects = (rule.destination.objects ?? []).join(" ");
  const srcDesc = rule.source.desc ?? "";
  const dstDesc = rule.destination.desc ?? "";

  const srcSim = Math.max(
    similarity(srcObjects, designRow.sourceComponent),
    similarity(srcDesc, designRow.sourceComponent)
  );
  const dstSim = Math.max(
    similarity(dstObjects, designRow.destComponent),
    similarity(dstDesc, designRow.destComponent)
  );

  score += Math.round(srcSim * 12.5);
  score += Math.round(dstSim * 12.5);

  if (srcSim > 0.3) details.push(`Source component similarity: ${Math.round(srcSim * 100)}%`);
  if (dstSim > 0.3) details.push(`Dest component similarity: ${Math.round(dstSim * 100)}%`);

  // Action match (10 points)
  const actionNorm = rule.action.toLowerCase();
  if (
    (actionNorm.includes("allow") || actionNorm.includes("accept")) &&
    designRow.action === "Allow"
  ) {
    score += 10;
    details.push("Action matches (Allow)");
  } else if (actionNorm.includes("deny") && designRow.action === "Deny") {
    score += 10;
    details.push("Action matches (Deny)");
  }

  return { designRow, score, details };
}

// ── Main comparison function ──

/**
 * Compare a set of firewall rules against approved design rows.
 * Returns a match result for each firewall rule.
 */
export function compareRulesAgainstDesign(
  fwRules: FirewallRule[],
  designRows: DesignRow[]
): DesignMatchResult[] {
  return fwRules.map((rule) => {
    if (designRows.length === 0) {
      return {
        fwRuleRef: rule.userRef,
        verdict: "clarification_needed" as Verdict,
        confidence: 0.5,
        reason:
          "No approved design found for this project. Cannot validate firewall rule against design.",
      };
    }

    // Score against all design rows, pick best match
    const scores = designRows.map((dr) => scoreMatch(rule, dr));
    scores.sort((a, b) => b.score - a.score);
    const best = scores[0];

    // Determine verdict based on score thresholds
    const confidence = Math.min(best.score / 100, 1.0);

    if (best.score >= 70) {
      return {
        fwRuleRef: rule.userRef,
        verdict: "approved" as Verdict,
        confidence,
        matchedDesignRowNumber: best.designRow.rowNumber,
        reason: `Matches design row ${best.designRow.rowNumber} (${best.designRow.sourceComponent} → ${best.designRow.destComponent}). ${best.details.join("; ")}.`,
      };
    }

    if (best.score >= 40) {
      return {
        fwRuleRef: rule.userRef,
        verdict: "clarification_needed" as Verdict,
        confidence,
        matchedDesignRowNumber: best.designRow.rowNumber,
        reason: `Partial match with design row ${best.designRow.rowNumber} (${best.designRow.sourceComponent} → ${best.designRow.destComponent}). Differences found: ${best.details.join("; ")}. Please confirm this firewall rule corresponds to the intended design connection.`,
      };
    }

    return {
      fwRuleRef: rule.userRef,
      verdict: "rejected" as Verdict,
      confidence,
      reason: `No matching connection found in approved design. Best candidate was row ${best.designRow.rowNumber} (score: ${best.score}/100). This firewall rule does not appear in the ARB-approved system design.`,
    };
  });
}
