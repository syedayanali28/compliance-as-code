/**
 * Policy Compliance Checker
 *
 * Evaluates firewall rules against internal security policies
 * stored in the guidelines table. Returns per-rule violations.
 *
 * Ported from the existing cautions-catalog.ts with adaptation
 * for the new type system and database-driven guidelines.
 */

import type { FirewallRule, Guideline } from "@/types";
import { getSupabaseAdmin } from "../supabase";

export interface PolicyViolation {
  cautionId: string;
  title: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  reason: string;
}

export interface PolicyCheckResult {
  fwRuleRef: string;
  violations: PolicyViolation[];
  isCompliant: boolean;
}

// ── Hardcoded check functions (mapped by caution_id) ──

type CheckFn = (rule: FirewallRule) => PolicyViolation | null;

const PRIVILEGED_PORTS = new Set([22, 23, 3389, 445, 389, 636, 88, 135, 139, 5985, 5986]);
const UNENCRYPTED_PORTS = new Set([80, 21, 23, 69, 161]);

function normalizeZone(zone: string | null | undefined): string {
  if (!zone) return "";
  const lower = zone.toLowerCase();
  if (lower.includes("internet") || lower === "external" || lower === "any") return "internet";
  if (lower.includes("dmz")) return "dmz";
  if (lower.includes("intranet") || lower.includes("oa") || lower.includes("internal")) return "intranet";
  return lower;
}

function isInternetSource(rule: FirewallRule): boolean {
  return !!(
    rule.source.isInternet ||
    normalizeZone(rule.source.zone) === "internet"
  );
}

function getRulePorts(rule: FirewallRule): number[] {
  return rule.services
    .map((s) => (typeof s.port === "number" ? s.port : parseInt(String(s.port), 10)))
    .filter((p) => !isNaN(p));
}

function hasAnyService(rule: FirewallRule): boolean {
  return rule.services.some(
    (s) => String(s.port).toLowerCase() === "any" || String(s.port) === "0-65535"
  );
}

const CHECK_FUNCTIONS: Record<string, CheckFn> = {
  "C-IN-01": (rule) => {
    if (isInternetSource(rule) && normalizeZone(rule.destination.zone) !== "dmz") {
      return {
        cautionId: "C-IN-01",
        title: "Incoming Internet Access",
        severity: "HIGH",
        reason: `Rule ${rule.userRef}: Internet source to ${rule.destination.zone ?? "unknown zone"} — Internet traffic must terminate in DMZ.`,
      };
    }
    return null;
  },

  "C-VDI-01": (rule) => {
    const srcText = [rule.source.desc, ...(rule.source.objects ?? [])].join(" ").toLowerCase();
    const dstText = [rule.destination.desc, ...(rule.destination.objects ?? [])].join(" ").toLowerCase();
    if (
      srcText.includes("dev") &&
      (srcText.includes("vdi") || srcText.includes("desktop")) &&
      (dstText.includes("prod") || normalizeZone(rule.destination.zone) === "intranet")
    ) {
      const ports = getRulePorts(rule);
      if (ports.some((p) => PRIVILEGED_PORTS.has(p))) {
        return {
          cautionId: "C-VDI-01",
          title: "DEV VDI to Production Access",
          severity: "HIGH",
          reason: `Rule ${rule.userRef}: DEV VDI accessing production with privileged ports (${ports.filter((p) => PRIVILEGED_PORTS.has(p)).join(", ")}).`,
        };
      }
    }
    return null;
  },

  "C-OUT-01": (rule) => {
    if (
      normalizeZone(rule.source.zone) === "intranet" &&
      normalizeZone(rule.destination.zone) === "internet"
    ) {
      return {
        cautionId: "C-OUT-01",
        title: "Direct Outgoing Internet Access",
        severity: "MEDIUM",
        reason: `Rule ${rule.userRef}: Direct Intranet → Internet connection without proxy. Outbound traffic should go through DMZ proxy.`,
      };
    }
    return null;
  },

  "C-SEC-01": (rule) => {
    const srcZone = normalizeZone(rule.source.zone);
    const dstZone = normalizeZone(rule.destination.zone);
    if (srcZone === dstZone) return null;

    const ports = getRulePorts(rule);
    const privileged = ports.filter((p) => PRIVILEGED_PORTS.has(p));
    if (privileged.length > 0) {
      return {
        cautionId: "C-SEC-01",
        title: "Privileged Port Access Across Zones",
        severity: "HIGH",
        reason: `Rule ${rule.userRef}: Privileged ports (${privileged.join(", ")}) opened across zones (${srcZone} → ${dstZone}).`,
      };
    }
    return null;
  },

  "C-SEC-02": (rule) => {
    const srcZone = normalizeZone(rule.source.zone);
    const dstZone = normalizeZone(rule.destination.zone);
    if (srcZone === dstZone) return null;

    const ports = getRulePorts(rule);
    const unencrypted = ports.filter((p) => UNENCRYPTED_PORTS.has(p));
    if (unencrypted.length > 0) {
      return {
        cautionId: "C-SEC-02",
        title: "Unencrypted Traffic Across Zones",
        severity: "MEDIUM",
        reason: `Rule ${rule.userRef}: Unencrypted ports (${unencrypted.join(", ")}) across zones (${srcZone} → ${dstZone}). Use encrypted alternatives.`,
      };
    }
    return null;
  },

  "C-RULE-01": (rule) => {
    if (hasAnyService(rule)) {
      return {
        cautionId: "C-RULE-01",
        title: "All Ports / Any Service Not Allowed",
        severity: "HIGH",
        reason: `Rule ${rule.userRef}: "Any" or all-port service is prohibited. Specify exact protocols and ports.`,
      };
    }
    return null;
  },

  "C-ZONE-01": (rule) => {
    const srcZone = normalizeZone(rule.source.zone);
    const dstZone = normalizeZone(rule.destination.zone);
    if (srcZone === dstZone) return null;

    const ports = getRulePorts(rule);
    if (ports.length > 10) {
      return {
        cautionId: "C-ZONE-01",
        title: "Broad Port Access Across Zones",
        severity: "HIGH",
        reason: `Rule ${rule.userRef}: ${ports.length} ports opened across zones (${srcZone} → ${dstZone}). Overly broad access requires ITS endorsement.`,
      };
    }
    return null;
  },

  "C-OA-01": (rule) => {
    if (
      isInternetSource(rule) &&
      normalizeZone(rule.destination.zone) === "intranet"
    ) {
      return {
        cautionId: "C-OA-01",
        title: "Internet to OA/Intranet Access",
        severity: "HIGH",
        reason: `Rule ${rule.userRef}: Direct Internet → Intranet connection is strictly prohibited.`,
      };
    }
    return null;
  },

  "C-MGMT-01": (rule) => {
    if (
      isInternetSource(rule) &&
      normalizeZone(rule.destination.zone) === "dmz"
    ) {
      return {
        cautionId: "C-MGMT-01",
        title: "Any Internet Source to DMZ",
        severity: "HIGH",
        reason: `Rule ${rule.userRef}: Internet (any) → DMZ. Restrict source IPs where possible and ensure WAF/reverse proxy is in place.`,
      };
    }
    return null;
  },
};

/**
 * Load enabled guidelines from database
 */
export async function loadGuidelines(): Promise<Guideline[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("guidelines")
    .select("*")
    .eq("enabled", true)
    .order("caution_id");

  if (error) {
    console.error("Failed to load guidelines:", error);
    return [];
  }

  return (data ?? []).map((g) => ({
    id: g.id,
    cautionId: g.caution_id,
    title: g.title,
    description: g.description,
    category: g.category,
    severity: g.severity,
    requiredAction: g.required_action,
    context: g.context,
    exampleCompliant: g.example_compliant,
    exampleViolation: g.example_violation,
    checkLogic: g.check_logic,
    enabled: g.enabled,
    version: g.version,
    createdAt: g.created_at,
    updatedAt: g.updated_at,
  }));
}

/**
 * Check a single firewall rule against all enabled policies.
 */
export function checkRuleAgainstPolicies(
  rule: FirewallRule,
  guidelines: Guideline[]
): PolicyCheckResult {
  const violations: PolicyViolation[] = [];

  for (const guideline of guidelines) {
    if (!guideline.enabled) continue;

    const checkFn = CHECK_FUNCTIONS[guideline.cautionId];
    if (checkFn) {
      const violation = checkFn(rule);
      if (violation) {
        violations.push(violation);
      }
    }
  }

  return {
    fwRuleRef: rule.userRef,
    violations,
    isCompliant: violations.length === 0,
  };
}

/**
 * Check all firewall rules against all enabled policies.
 */
export function checkAllRules(
  rules: FirewallRule[],
  guidelines: Guideline[]
): PolicyCheckResult[] {
  return rules.map((rule) => checkRuleAgainstPolicies(rule, guidelines));
}
