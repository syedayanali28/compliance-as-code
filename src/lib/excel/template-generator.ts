import ExcelJS from "exceljs";
import type {
  Zone,
  Direction,
  Protocol,
  Action,
  Environment,
  DataClassification,
} from "@/types";
import {
  ZONES,
  DIRECTIONS,
  PROTOCOLS,
  ACTIONS,
  ENVIRONMENTS,
  DATA_CLASSIFICATIONS,
} from "@/types";
import path from "path";
import { mkdir } from "fs/promises";

// Styling constants

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF003366" },
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: "FFFFFFFF" },
  size: 11,
};

const BORDER_THIN: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};

interface ColDef {
  header: string;
  key: string;
  width: number;
  validation?: ExcelJS.DataValidation;
}

const listValidation = (values: readonly string[]): ExcelJS.DataValidation => ({
  type: "list",
  allowBlank: false,
  formulae: [`"${values.join(",")}"`],
  showErrorMessage: true,
  errorTitle: "Invalid value",
  error: `Must be one of: ${values.join(", ")}`,
});

const SYSTEM_COLUMNS: ColDef[] = [
  { header: "Row #", key: "rowNumber", width: 8 },
  { header: "Source Component", key: "sourceComponent", width: 22 },
  { header: "Source Technology", key: "sourceTechnology", width: 20 },
  { header: "Source Zone", key: "sourceZone", width: 14, validation: listValidation(ZONES) },
  { header: "Source IP / Subnet", key: "sourceIpSubnet", width: 20 },
  { header: "Dest Component", key: "destComponent", width: 22 },
  { header: "Dest Technology", key: "destTechnology", width: 20 },
  { header: "Dest Zone", key: "destZone", width: 14, validation: listValidation(ZONES) },
  { header: "Dest IP / Subnet", key: "destIpSubnet", width: 20 },
  { header: "Direction", key: "direction", width: 14, validation: listValidation(DIRECTIONS) },
  { header: "Protocol", key: "protocol", width: 12, validation: listValidation(PROTOCOLS) },
  { header: "Port(s)", key: "ports", width: 16 },
  { header: "Action", key: "action", width: 10, validation: listValidation(ACTIONS) },
  { header: "Is Common Service?", key: "isCommonService", width: 18, validation: listValidation(["Yes", "No"]) },
  { header: "Justification", key: "justification", width: 36 },
  { header: "Environment", key: "environment", width: 14, validation: listValidation(ENVIRONMENTS) },
  { header: "Application ID", key: "applicationId", width: 18 },
  { header: "Data Classification", key: "dataClassification", width: 20, validation: listValidation(DATA_CLASSIFICATIONS) },
  { header: "Encryption Required?", key: "encryptionRequired", width: 20, validation: listValidation(["Yes", "No"]) },
  { header: "NAT Translation", key: "natTranslation", width: 20 },
  { header: "Gateway", key: "gateway", width: 16 },
];

const COMMON_SERVICE_COLUMNS: ColDef[] = [
  { header: "Service Name", key: "serviceName", width: 24 },
  { header: "Protocol", key: "protocol", width: 12, validation: listValidation(PROTOCOLS) },
  { header: "Port(s)", key: "ports", width: 16 },
  { header: "Destination", key: "destination", width: 24 },
  { header: "Description", key: "description", width: 40 },
];

const METADATA_COLUMNS: ColDef[] = [
  { header: "Field", key: "field", width: 30 },
  { header: "Value", key: "value", width: 50 },
];

const METADATA_ROWS = [
  { field: "Project Name", value: "" },
  { field: "Application ID", value: "" },
  { field: "Business Unit", value: "" },
  { field: "Contact Person", value: "" },
  { field: "Contact Email", value: "" },
  { field: "Target Environment", value: "" },
  { field: "Requested Date", value: "" },
  { field: "JIRA Ticket", value: "" },
  { field: "Change Request ID", value: "" },
  { field: "Approval Status", value: "" },
];

function applyHeaderStyle(row: ExcelJS.Row): void {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.border = BORDER_THIN;
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  row.height = 28;
}

function addSheet(
  wb: ExcelJS.Workbook,
  name: string,
  columns: ColDef[],
  dataRows?: Record<string, unknown>[],
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(name);

  ws.columns = columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width,
  }));

  const headerRow = ws.getRow(1);
  applyHeaderStyle(headerRow);

  for (const col of columns) {
    if (col.validation) {
      const colObj = ws.getColumn(col.key);
      for (let r = 2; r <= 201; r++) {
        ws.getCell(r, colObj.number).dataValidation = col.validation;
      }
    }
  }

  if (dataRows) {
    for (const row of dataRows) {
      const added = ws.addRow(row);
      added.eachCell((cell) => {
        cell.border = BORDER_THIN;
      });
    }
  }

  ws.views = [{ state: "frozen", ySplit: 1, xSplit: 0 }];
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };

  return ws;
}

function addInstructionsSheet(wb: ExcelJS.Workbook): void {
  const ws = wb.addWorksheet("Instructions");

  ws.columns = [
    { header: "Section", key: "section", width: 24 },
    { header: "Instruction", key: "instruction", width: 80 },
  ];

  applyHeaderStyle(ws.getRow(1));

  const instructions = [
    {
      section: "Overview",
      instruction:
        "This template captures Infrastructure-as-Code (IdaC) design information for HKMA compliance review. " +
        "Fill in the System Connections, Common Services, and Metadata sheets.",
    },
    {
      section: "System Connections",
      instruction:
        "One row per network connection. Source and Destination zones must be Internet, DMZ, or Intranet. " +
        "Provide justification for every rule, especially cross-zone connections.",
    },
    {
      section: "Common Services",
      instruction:
        "List shared services (DNS, NTP, AD, etc.) referenced by multiple connections. " +
        "These will be validated against the connection rules.",
    },
    {
      section: "Metadata",
      instruction:
        "Fill in all project metadata. This information is included in the compliance report header.",
    },
    {
      section: "Validation Rules",
      instruction:
        "After upload, the system will check: zone-crossing justification, protocol/port validity, " +
        "common service consistency, and policy compliance per HKMA guidelines.",
    },
    {
      section: "Drop-down Lists",
      instruction:
        "Zone, Direction, Protocol, Action, Environment, and Data Classification columns use drop-down lists. " +
        "Select valid values from the list to avoid validation errors.",
    },
  ];

  for (const row of instructions) {
    const added = ws.addRow(row);
    added.getCell("instruction").alignment = { wrapText: true };
    added.height = 30;
    added.eachCell((cell) => {
      cell.border = BORDER_THIN;
    });
  }

  ws.views = [{ state: "frozen", ySplit: 1, xSplit: 0 }];
}

// Public API

async function createWorkbook(): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "HKMA Compliance-as-Code Platform";
  wb.created = new Date();

  addInstructionsSheet(wb);
  addSheet(wb, "System Connections", SYSTEM_COLUMNS);
  addSheet(wb, "Common Services", COMMON_SERVICE_COLUMNS);
  addSheet(wb, "Metadata", METADATA_COLUMNS, METADATA_ROWS);

  return wb;
}

/**
 * Generate an IdaC Excel template and return as a Uint8Array buffer
 * (suitable for HTTP responses).
 */
export async function generateTemplateBuffer(): Promise<Uint8Array> {
  const wb = await createWorkbook();
  const arrayBuffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(arrayBuffer);
}

/**
 * Generate an IdaC Excel template and write to disk.
 * Returns the resolved output path.
 */
export async function generateTemplate(outputPath: string): Promise<string> {
  const resolved = path.resolve(outputPath);
  await mkdir(path.dirname(resolved), { recursive: true });
  const wb = await createWorkbook();
  await wb.xlsx.writeFile(resolved);
  return resolved;
}
