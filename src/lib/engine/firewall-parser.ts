/**
 * Firewall Request Parser
 *
 * Parses firewall request Excel attachments from JIRA tickets.
 * Ported and adapted from the existing firewall-request codebase.
 */

import ExcelJS from "exceljs";
import type { FirewallRule, FirewallRuleService, NetworkObject } from "@/types";

// ── Header detection patterns (case-insensitive substring match) ──

interface HeaderMapping {
  field: string;
  patterns: string[];
}

const HEADER_MAPPINGS: HeaderMapping[] = [
  { field: "ref", patterns: ["ref", "rule", "no", "#"] },
  { field: "category", patterns: ["category", "type"] },
  { field: "sourceObject", patterns: ["source object", "source", "src"] },
  { field: "sourceDesc", patterns: ["source desc", "src desc"] },
  { field: "sourceZone", patterns: ["source zone", "src zone"] },
  { field: "destObject", patterns: ["destination object", "destination", "dst", "dest"] },
  { field: "destIp", patterns: ["destination ip", "dst ip", "dest ip"] },
  { field: "xlate", patterns: ["xlate", "nat", "translation"] },
  { field: "destDesc", patterns: ["destination desc", "dst desc", "dest desc"] },
  { field: "destZone", patterns: ["destination zone", "dst zone", "dest zone"] },
  { field: "service", patterns: ["service", "port", "protocol"] },
  { field: "action", patterns: ["action"] },
  { field: "gateway", patterns: ["gateway", "firewall"] },
  { field: "justification", patterns: ["justification", "purpose", "remarks", "comment"] },
  { field: "arb", patterns: ["arb", "reviewed"] },
  { field: "common", patterns: ["common"] },
];

function cellToString(cell: ExcelJS.Cell): string {
  if (cell.value === null || cell.value === undefined) return "";
  if (typeof cell.value === "object" && "text" in cell.value) {
    return String(cell.value.text).trim();
  }
  return String(cell.value).trim();
}

function detectHeaders(
  row: ExcelJS.Row
): Map<string, number> | null {
  const map = new Map<string, number>();
  let matchCount = 0;

  row.eachCell((cell, colNumber) => {
    const text = cellToString(cell).toLowerCase();
    if (!text) return;

    for (const mapping of HEADER_MAPPINGS) {
      if (map.has(mapping.field)) continue;
      for (const pattern of mapping.patterns) {
        if (text.includes(pattern)) {
          map.set(mapping.field, colNumber);
          matchCount++;
          break;
        }
      }
    }
  });

  return matchCount >= 3 ? map : null;
}

function parseServices(serviceStr: string): FirewallRuleService[] {
  if (!serviceStr) return [];

  const services: FirewallRuleService[] = [];
  // Split on commas, semicolons, newlines
  const parts = serviceStr.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);

  for (const part of parts) {
    // Match patterns: "TCP/443", "UDP 53", "tcp:8080", "443"
    const match = part.match(/^(tcp|udp|icmp)[/:\s]+(\d+(?:\s*-\s*\d+)?)/i);
    if (match) {
      services.push({ proto: match[1].toUpperCase(), port: parseInt(match[2], 10) });
    } else {
      const portMatch = part.match(/^(\d+)$/);
      if (portMatch) {
        services.push({ proto: "TCP", port: parseInt(portMatch[1], 10) });
      } else {
        services.push({ proto: "unknown", port: part });
      }
    }
  }

  return services;
}

function parseNetworkObject(
  objectStr: string,
  descStr: string,
  zoneStr: string,
  ipStr?: string,
  xlateStr?: string
): NetworkObject {
  const objects = objectStr
    ? objectStr.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean)
    : undefined;
  const ips = ipStr
    ? ipStr.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean)
    : undefined;
  const xlates = xlateStr
    ? xlateStr.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean)
    : undefined;

  // Detect Internet source
  const allText = [objectStr, descStr, zoneStr, ipStr ?? ""].join(" ").toLowerCase();
  const isInternet =
    allText.includes("internet") ||
    allText.includes("0.0.0.0") ||
    allText.includes("any") ||
    /\b(?:(?:1\d{2}|2[0-4]\d|25[0-5])\.){3}/.test(objectStr); // crude public IP check

  return {
    objects,
    ips,
    xlates,
    desc: descStr || undefined,
    zone: zoneStr || null,
    isInternet: isInternet || undefined,
  };
}

/**
 * Parse a firewall request Excel file into FirewallRule[]
 */
export async function parseFirewallExcel(
  buffer: Buffer | Uint8Array
): Promise<{ rules: FirewallRule[]; errors: string[] }> {
  const workbook = new ExcelJS.Workbook();
  // ExcelJS types expect older Buffer without generic; Node 25 returns Buffer<ArrayBufferLike>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any);

  const rules: FirewallRule[] = [];
  const errors: string[] = [];

  for (const ws of workbook.worksheets) {
    let headerMap: Map<string, number> | null = null;
    let headerRow = 0;

    // Search first 20 rows for headers
    for (let i = 1; i <= Math.min(ws.rowCount, 20); i++) {
      headerMap = detectHeaders(ws.getRow(i));
      if (headerMap) {
        headerRow = i;
        break;
      }
    }

    if (!headerMap) continue;

    const getCell = (row: ExcelJS.Row, field: string): string => {
      const col = headerMap!.get(field);
      return col ? cellToString(row.getCell(col)) : "";
    };

    // Parse data rows
    for (let i = headerRow + 1; i <= ws.rowCount; i++) {
      const row = ws.getRow(i);
      const refStr = getCell(row, "ref");
      const sourceStr = getCell(row, "sourceObject");
      const destStr = getCell(row, "destObject");
      const serviceStr = getCell(row, "service");

      // Skip empty or NA rows
      if (!sourceStr && !destStr && !serviceStr) continue;
      if (
        sourceStr.toLowerCase() === "na" &&
        destStr.toLowerCase() === "na"
      )
        continue;

      const source = parseNetworkObject(
        sourceStr,
        getCell(row, "sourceDesc"),
        getCell(row, "sourceZone")
      );

      const destination = parseNetworkObject(
        destStr,
        getCell(row, "destDesc"),
        getCell(row, "destZone"),
        getCell(row, "destIp"),
        getCell(row, "xlate")
      );

      const rule: FirewallRule = {
        category: getCell(row, "category") || "Unknown",
        userRef: refStr || String(rules.length + 1),
        source,
        destination,
        services: parseServices(serviceStr),
        action: getCell(row, "action") || "accept",
        gateway: getCell(row, "gateway") || undefined,
        justification: getCell(row, "justification") || undefined,
        arbReviewed: ["yes", "true"].includes(
          getCell(row, "arb").toLowerCase()
        ),
        commonService: ["yes", "true"].includes(
          getCell(row, "common").toLowerCase()
        ),
      };

      rules.push(rule);
    }
  }

  if (rules.length === 0) {
    errors.push("No valid firewall rules found in the Excel file.");
  }

  return { rules, errors };
}
