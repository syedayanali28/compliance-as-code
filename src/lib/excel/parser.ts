/**
 * IdaC Excel Parser
 *
 * Parses a filled IdaC Excel template back into structured DesignRow[]
 * and TemplateMetadata. Performs validation and returns errors for
 * any rows that don't meet schema requirements.
 */

import ExcelJS from "exceljs";
import {
  type DesignRow,
  type TemplateMetadata,
  ZONES,
  type Zone,
  DIRECTIONS,
  type Direction,
  PROTOCOLS,
  type Protocol,
  ACTIONS,
  type Action,
  ENVIRONMENTS,
  type Environment,
  DATA_CLASSIFICATIONS,
  type DataClassification,
} from "@/types";

export interface ParseError {
  row: number;
  column: string;
  message: string;
}

export interface ParseResult {
  metadata: TemplateMetadata | null;
  rows: DesignRow[];
  errors: ParseError[];
  warnings: string[];
}

// ── Column mapping (case-insensitive header matching) ──

const HEADER_MAP: Record<string, string> = {
  "row #": "rowNumber",
  "row": "rowNumber",
  "#": "rowNumber",
  "source component": "sourceComponent",
  "source technology": "sourceTechnology",
  "source zone": "sourceZone",
  "source ip/subnet": "sourceIpSubnet",
  "source ip": "sourceIpSubnet",
  "destination component": "destComponent",
  "dest component": "destComponent",
  "destination technology": "destTechnology",
  "dest technology": "destTechnology",
  "destination zone": "destZone",
  "dest zone": "destZone",
  "destination ip/subnet": "destIpSubnet",
  "dest ip/subnet": "destIpSubnet",
  "dest ip": "destIpSubnet",
  "direction": "direction",
  "protocol": "protocol",
  "port(s)": "ports",
  "ports": "ports",
  "port": "ports",
  "action": "action",
  "common service": "isCommonService",
  "is common service": "isCommonService",
  "justification": "justification",
  "environment": "environment",
  "application id": "applicationId",
  "data classification": "dataClassification",
  "encryption required": "encryptionRequired",
  "nat/translation": "natTranslation",
  "gateway/firewall": "gateway",
  "gateway": "gateway",
  "notes": "notes",
};

function normalizeHeader(header: string): string | undefined {
  const lower = header.toLowerCase().trim();
  return HEADER_MAP[lower];
}

function cellAsString(cell: ExcelJS.Cell): string {
  if (cell.value === null || cell.value === undefined) return "";
  if (typeof cell.value === "object" && "text" in cell.value) {
    return String(cell.value.text).trim();
  }
  return String(cell.value).trim();
}

function isValidEnum<T extends string>(
  value: string,
  options: readonly T[]
): value is T {
  return options.includes(value as T);
}

function toBool(value: string): boolean {
  const lower = value.toLowerCase();
  return lower === "yes" || lower === "true" || lower === "1";
}

// ── Parse Metadata Sheet ──

function parseMetadata(workbook: ExcelJS.Workbook): TemplateMetadata | null {
  const ws = workbook.getWorksheet("Metadata");
  if (!ws) return null;

  const fields: Record<string, string> = {};
  ws.eachRow((row, rowNumber) => {
    if (rowNumber <= 3) return; // skip title + header
    const label = cellAsString(row.getCell(1))
      .replace(" *", "")
      .trim();
    const value = cellAsString(row.getCell(2));
    if (label && value) {
      fields[label] = value;
    }
  });

  return {
    projectName: fields["Project Name"] ?? "",
    architectName: fields["Architect Name"] ?? "",
    submissionDate: fields["Submission Date"] ?? new Date().toISOString().split("T")[0],
    version: parseInt(fields["Version"] ?? "1", 10) || 1,
    environment: (fields["Environment"] as Environment) || undefined,
    jiraTicketRef: fields["JIRA Ticket Reference"] || undefined,
  };
}

// ── Parse System Connections Sheet ──

export async function parseIdacExcel(
  buffer: Buffer | Uint8Array
): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  // ExcelJS types expect older Buffer without generic; Node 25 returns Buffer<ArrayBufferLike>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any);

  const errors: ParseError[] = [];
  const warnings: string[] = [];
  const rows: DesignRow[] = [];

  // Parse metadata
  const metadata = parseMetadata(workbook);
  if (!metadata?.projectName) {
    warnings.push("Metadata sheet missing or incomplete — project name not found.");
  }

  // Find System Connections sheet
  const ws =
    workbook.getWorksheet("System Connections") ??
    workbook.getWorksheet(2); // fallback to second sheet

  if (!ws) {
    errors.push({ row: 0, column: "", message: "System Connections sheet not found" });
    return { metadata, rows, errors, warnings };
  }

  // Detect header row (look in first 5 rows for our column names)
  let headerRowIndex = 0;
  let columnMap: Map<number, string> = new Map();

  for (let i = 1; i <= 5; i++) {
    const row = ws.getRow(i);
    const tempMap = new Map<number, string>();
    let matchCount = 0;

    row.eachCell((cell, colNumber) => {
      const header = cellAsString(cell);
      const field = normalizeHeader(header);
      if (field) {
        tempMap.set(colNumber, field);
        matchCount++;
      }
    });

    if (matchCount >= 5) {
      // Found header row (at least 5 recognized columns)
      headerRowIndex = i;
      columnMap = tempMap;
      break;
    }
  }

  if (headerRowIndex === 0) {
    errors.push({ row: 0, column: "", message: "Could not detect header row in System Connections sheet" });
    return { metadata, rows, errors, warnings };
  }

  // Skip the "Required/Optional" sub-header row if present
  const dataStartRow = headerRowIndex + 2; // +1 for sub-header, +1 for first data

  // Parse data rows
  for (let i = dataStartRow; i <= ws.rowCount; i++) {
    const row = ws.getRow(i);
    const values: Record<string, string> = {};
    let hasData = false;

    columnMap.forEach((field, colNumber) => {
      const val = cellAsString(row.getCell(colNumber));
      if (val) {
        values[field] = val;
        if (field !== "rowNumber") hasData = true;
      }
    });

    // Skip empty rows
    if (!hasData) continue;

    const rowNum = parseInt(values.rowNumber ?? String(rows.length + 1), 10);

    // Validate required fields
    const requiredFields = [
      "sourceComponent",
      "sourceTechnology",
      "sourceZone",
      "destComponent",
      "destTechnology",
      "destZone",
      "direction",
      "protocol",
      "ports",
      "action",
      "justification",
    ];

    let hasError = false;
    for (const field of requiredFields) {
      if (!values[field]) {
        errors.push({
          row: rowNum,
          column: field,
          message: `Missing required field: ${field}`,
        });
        hasError = true;
      }
    }

    // Validate enums
    if (values.sourceZone && !isValidEnum(values.sourceZone, ZONES)) {
      errors.push({ row: rowNum, column: "sourceZone", message: `Invalid zone: "${values.sourceZone}". Must be one of: ${ZONES.join(", ")}` });
      hasError = true;
    }
    if (values.destZone && !isValidEnum(values.destZone, ZONES)) {
      errors.push({ row: rowNum, column: "destZone", message: `Invalid zone: "${values.destZone}". Must be one of: ${ZONES.join(", ")}` });
      hasError = true;
    }
    if (values.direction && !isValidEnum(values.direction, DIRECTIONS)) {
      errors.push({ row: rowNum, column: "direction", message: `Invalid direction: "${values.direction}". Must be one of: ${DIRECTIONS.join(", ")}` });
      hasError = true;
    }
    if (values.protocol && !isValidEnum(values.protocol, PROTOCOLS)) {
      errors.push({ row: rowNum, column: "protocol", message: `Invalid protocol: "${values.protocol}". Must be one of: ${PROTOCOLS.join(", ")}` });
      hasError = true;
    }
    if (values.action && !isValidEnum(values.action, ACTIONS)) {
      errors.push({ row: rowNum, column: "action", message: `Invalid action: "${values.action}". Must be one of: ${ACTIONS.join(", ")}` });
      hasError = true;
    }

    if (hasError) continue;

    // Build DesignRow
    const designRow: DesignRow = {
      rowNumber: rowNum,
      sourceComponent: values.sourceComponent,
      sourceTechnology: values.sourceTechnology,
      sourceZone: values.sourceZone as Zone,
      sourceIpSubnet: values.sourceIpSubnet || undefined,
      destComponent: values.destComponent,
      destTechnology: values.destTechnology,
      destZone: values.destZone as Zone,
      destIpSubnet: values.destIpSubnet || undefined,
      direction: values.direction as Direction,
      protocol: values.protocol as Protocol,
      ports: values.ports,
      action: values.action as Action,
      isCommonService: toBool(values.isCommonService ?? "no"),
      justification: values.justification,
      environment: values.environment && isValidEnum(values.environment, ENVIRONMENTS)
        ? (values.environment as Environment)
        : undefined,
      applicationId: values.applicationId || undefined,
      dataClassification:
        values.dataClassification &&
        isValidEnum(values.dataClassification, DATA_CLASSIFICATIONS)
          ? (values.dataClassification as DataClassification)
          : undefined,
      encryptionRequired: values.encryptionRequired
        ? toBool(values.encryptionRequired)
        : undefined,
      natTranslation: values.natTranslation || undefined,
      gateway: values.gateway || undefined,
      notes: values.notes || undefined,
    };

    rows.push(designRow);
  }

  if (rows.length === 0 && errors.length === 0) {
    warnings.push("No data rows found in System Connections sheet.");
  }

  return { metadata, rows, errors, warnings };
}
