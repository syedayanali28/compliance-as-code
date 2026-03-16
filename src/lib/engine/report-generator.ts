/**
 * Excel Report Generator
 *
 * Produces a color-coded Excel report with per-rule verdicts,
 * confidence scores, matching design rows, and policy violations.
 */

import ExcelJS from "exceljs";
import type { FirewallRule } from "@/types";
import type { EngineResult } from "./orchestrator";

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1F3864" },
};
const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: "FFFFFFFF" },
  size: 11,
};
const GREEN_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFD4EDDA" },
};
const RED_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF8D7DA" },
};
const YELLOW_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFF3CD" },
};
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  bottom: { style: "thin" },
  left: { style: "thin" },
  right: { style: "thin" },
};

function verdictFill(verdict: string): ExcelJS.Fill {
  switch (verdict) {
    case "approved":
      return GREEN_FILL;
    case "rejected":
      return RED_FILL;
    default:
      return YELLOW_FILL;
  }
}

function verdictLabel(verdict: string): string {
  switch (verdict) {
    case "approved":
      return "APPROVED";
    case "rejected":
      return "REJECTED";
    default:
      return "CLARIFICATION NEEDED";
  }
}

/**
 * Generate a validation report Excel workbook.
 */
export async function generateReport(
  jiraTicketKey: string,
  projectName: string,
  fwRules: FirewallRule[],
  engineResult: EngineResult
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "HKMA Compliance Platform - Validation Engine";
  workbook.created = new Date();

  // ── Sheet 1: Summary ──
  const summarySheet = workbook.addWorksheet("Summary", {
    properties: { tabColor: { argb: "FF4472C4" } },
  });

  summarySheet.getColumn(1).width = 30;
  summarySheet.getColumn(2).width = 50;

  const summaryRows = [
    ["Validation Report", ""],
    ["", ""],
    ["JIRA Ticket", jiraTicketKey],
    ["Project", projectName],
    ["Report Generated", new Date().toISOString()],
    ["", ""],
    ["Total Rules Analyzed", engineResult.summary.total],
    ["Approved", engineResult.summary.approved],
    ["Rejected", engineResult.summary.rejected],
    ["Clarification Needed", engineResult.summary.clarificationNeeded],
    ["", ""],
    [
      "Overall Recommendation",
      engineResult.summary.rejected > 0
        ? "ACTION REQUIRED — Some rules were rejected. Review reasons and resubmit."
        : engineResult.summary.clarificationNeeded > 0
          ? "REVIEW NEEDED — Some rules need clarification before approval."
          : "ALL RULES APPROVED — Firewall request aligns with design and policies.",
    ],
  ];

  summaryRows.forEach((rowData, idx) => {
    const row = summarySheet.getRow(idx + 1);
    row.getCell(1).value = rowData[0];
    row.getCell(2).value = rowData[1];

    if (idx === 0) {
      row.getCell(1).font = { bold: true, size: 16 };
      summarySheet.mergeCells(`A1:B1`);
    } else if (typeof rowData[0] === "string" && rowData[0] && idx >= 2) {
      row.getCell(1).font = { bold: true };
    }

    // Color-code the counts
    if (rowData[0] === "Approved") {
      row.getCell(2).fill = GREEN_FILL;
    } else if (rowData[0] === "Rejected") {
      row.getCell(2).fill = RED_FILL;
    } else if (rowData[0] === "Clarification Needed") {
      row.getCell(2).fill = YELLOW_FILL;
    }
  });

  // ── Sheet 2: Rule Verdicts ──
  const verdictsSheet = workbook.addWorksheet("Rule Verdicts", {
    properties: { tabColor: { argb: "FF70AD47" } },
  });

  const verdictHeaders = [
    { header: "Rule Ref", width: 10 },
    { header: "Source", width: 25 },
    { header: "Source Zone", width: 12 },
    { header: "Destination", width: 25 },
    { header: "Dest Zone", width: 12 },
    { header: "Services", width: 20 },
    { header: "Action", width: 10 },
    { header: "Justification", width: 30 },
    // Engine output columns
    { header: "VERDICT", width: 22 },
    { header: "Confidence %", width: 14 },
    { header: "Matched Design Row", width: 18 },
    { header: "Reason", width: 60 },
    { header: "Policy Violations", width: 30 },
  ];

  const headerRow = verdictsSheet.getRow(1);
  verdictHeaders.forEach((h, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = h.header;
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.border = THIN_BORDER;
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    verdictsSheet.getColumn(idx + 1).width = h.width;
  });
  headerRow.height = 30;

  // Data rows
  fwRules.forEach((rule, idx) => {
    const result = engineResult.results[idx];
    const designMatch = engineResult.designMatches[idx];
    const policyResult = engineResult.policyResults[idx];
    const row = verdictsSheet.getRow(idx + 2);

    const cells = [
      rule.userRef,
      (rule.source.objects ?? []).join(", ") || rule.source.desc || "",
      rule.source.zone ?? "",
      (rule.destination.objects ?? []).join(", ") || rule.destination.desc || "",
      rule.destination.zone ?? "",
      rule.services.map((s) => `${s.proto}/${s.port}`).join(", "),
      rule.action,
      rule.justification ?? "",
      // Engine output
      verdictLabel(result.verdict),
      `${Math.round(result.confidence * 100)}%`,
      designMatch.matchedDesignRowNumber
        ? `Row ${designMatch.matchedDesignRowNumber}`
        : "No match",
      result.reason,
      policyResult.violations.map((v) => v.cautionId).join(", ") || "None",
    ];

    cells.forEach((val, colIdx) => {
      const cell = row.getCell(colIdx + 1);
      cell.value = val;
      cell.border = THIN_BORDER;
      cell.alignment = { wrapText: true, vertical: "top" };
    });

    // Color-code the verdict cell and the entire row lightly
    const fill = verdictFill(result.verdict);
    row.getCell(9).fill = fill;
    row.getCell(9).font = { bold: true };
  });

  verdictsSheet.views = [{ state: "frozen", ySplit: 1, xSplit: 0 }];
  verdictsSheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: verdictHeaders.length },
  };

  // ── Sheet 3: Policy References ──
  const policySheet = workbook.addWorksheet("Policy References", {
    properties: { tabColor: { argb: "FFFFC000" } },
  });

  const policyHeaders = ["Policy ID", "Title", "Severity", "Description"];
  const policyWidths = [12, 30, 10, 80];

  const policyHeaderRow = policySheet.getRow(1);
  policyHeaders.forEach((h, idx) => {
    const cell = policyHeaderRow.getCell(idx + 1);
    cell.value = h;
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.border = THIN_BORDER;
    policySheet.getColumn(idx + 1).width = policyWidths[idx];
  });

  // Collect unique violations across all rules
  const uniqueViolations = new Map<string, { cautionId: string; title: string; severity: string; reason: string }>();
  for (const pr of engineResult.policyResults) {
    for (const v of pr.violations) {
      if (!uniqueViolations.has(v.cautionId)) {
        uniqueViolations.set(v.cautionId, {
          cautionId: v.cautionId,
          title: v.title,
          severity: v.severity,
          reason: v.reason,
        });
      }
    }
  }

  let policyRowIdx = 2;
  for (const v of uniqueViolations.values()) {
    const row = policySheet.getRow(policyRowIdx++);
    [v.cautionId, v.title, v.severity, v.reason].forEach((val, colIdx) => {
      const cell = row.getCell(colIdx + 1);
      cell.value = val;
      cell.border = THIN_BORDER;
      cell.alignment = { wrapText: true };
    });
  }

  if (uniqueViolations.size === 0) {
    const row = policySheet.getRow(2);
    row.getCell(1).value = "No policy violations found.";
    policySheet.mergeCells("A2:D2");
  }

  // Write to buffer
  const buf = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buf);
}
