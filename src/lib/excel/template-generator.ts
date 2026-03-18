import ExcelJS from "exceljs";
import {
  IDAC_COMMON_SERVICE_COLUMNS,
  IDAC_INSTRUCTION_COLUMNS,
  IDAC_INSTRUCTION_ROWS,
  IDAC_METADATA_COLUMNS,
  IDAC_METADATA_ROWS,
  IDAC_SYSTEM_CONNECTION_COLUMNS,
} from "@/lib/excel/idac-template-schema";
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

const toColDef = (columns: typeof IDAC_SYSTEM_CONNECTION_COLUMNS): ColDef[] =>
  columns.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width,
    validation: column.validationValues
      ? listValidation(column.validationValues)
      : undefined,
  }));

const SYSTEM_COLUMNS = toColDef(IDAC_SYSTEM_CONNECTION_COLUMNS);
const COMMON_SERVICE_COLUMNS = toColDef(IDAC_COMMON_SERVICE_COLUMNS);
const METADATA_COLUMNS = toColDef(IDAC_METADATA_COLUMNS);

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

  ws.columns = IDAC_INSTRUCTION_COLUMNS.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width,
  }));

  applyHeaderStyle(ws.getRow(1));

  for (const row of IDAC_INSTRUCTION_ROWS) {
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
  addSheet(wb, "Metadata", METADATA_COLUMNS, [...IDAC_METADATA_ROWS]);

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
