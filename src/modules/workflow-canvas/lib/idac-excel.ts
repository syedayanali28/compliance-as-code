import * as XLSX from "xlsx";
import { toIdaCExport, type IdaCExport } from "./idac-export";
import type { Edge, Node } from "@xyflow/react";

/**
 * Generates an IdAC-compliant Excel workbook from canvas data
 */
export const generateIdaCWorkbook = (
  edges: Edge[],
  nodes: Node[],
  metadata?: Record<string, string>
): XLSX.WorkBook => {
  const idacData = toIdaCExport(edges, nodes, metadata);
  const workbook = XLSX.utils.book_new();

  // Instructions sheet
  const instructionsData = [
    ["Section", "Instruction"],
    [
      "Overview",
      "This template captures Infrastructure-as-Code (IdaC) design information for HKMA compliance review. Fill in the System Connections, Common Services, and Metadata sheets."
    ],
    [
      "System Connections",
      "One row per network connection. Source and Destination zones must be Internet, DMZ, or Intranet. Provide justification for every rule, especially cross-zone connections."
    ],
    [
      "Common Services",
      "List shared services (DNS, NTP, AD, etc.) referenced by multiple connections. These will be validated against the connection rules."
    ],
    [
      "Metadata",
      "Fill in all project metadata. This information is included in the compliance report header."
    ],
    [
      "Validation Rules",
      "After upload, the system will check: zone-crossing justification, protocol/port validity, common service consistency, and policy compliance per HKMA guidelines."
    ]
  ];
  const instructionsSheet = XLSX.utils.aoa_to_sheet(instructionsData);
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Instructions");

  // System Connections sheet
  const connectionsData = [
    [
      "Row #",
      "Source Component",
      "Source Technology",
      "Source Zone",
      "Source IP / Subnet",
      "Dest Component",
      "Dest Technology",
      "Dest Zone",
      "Dest IP / Subnet",
      "Direction",
      "Protocol",
      "Port(s)",
      "Action",
      "Is Common Service?",
      "Justification",
      "Environment",
      "Application ID",
      "Data Classification",
      "Encryption Required?",
      "NAT Translation",
      "Gateway"
    ],
    ...idacData.systemConnections.map(conn => [
      conn.rowNumber,
      conn.sourceComponent,
      conn.sourceTechnology,
      conn.sourceZone,
      conn.sourceIP,
      conn.destComponent,
      conn.destTechnology,
      conn.destZone,
      conn.destIP,
      conn.direction,
      conn.protocol,
      conn.ports,
      conn.action,
      conn.isCommonService,
      conn.justification,
      conn.environment,
      conn.applicationId,
      conn.dataClassification,
      conn.encryptionRequired,
      conn.natTranslation,
      conn.gateway
    ])
  ];
  const connectionsSheet = XLSX.utils.aoa_to_sheet(connectionsData);
  XLSX.utils.book_append_sheet(workbook, connectionsSheet, "System Connections");

  // Common Services sheet
  const servicesData = [
    ["Service Name", "Protocol", "Port(s)", "Destination", "Description"],
    ...idacData.commonServices.map(svc => [
      svc.serviceName,
      svc.protocol,
      svc.ports,
      svc.destination,
      svc.description
    ])
  ];
  const servicesSheet = XLSX.utils.aoa_to_sheet(servicesData);
  XLSX.utils.book_append_sheet(workbook, servicesSheet, "Common Services");

  // Metadata sheet
  const metadataData = [
    ["Field", "Value"],
    ["Project Name", idacData.metadata.projectName],
    ["Application ID", idacData.metadata.applicationId],
    ["Business Unit", idacData.metadata.businessUnit],
    ["Contact Person", idacData.metadata.contactPerson],
    ["Contact Email", idacData.metadata.contactEmail]
  ];
  const metadataSheet = XLSX.utils.aoa_to_sheet(metadataData);
  XLSX.utils.book_append_sheet(workbook, metadataSheet, "Metadata");

  return workbook;
};

/**
 * Downloads the IdAC Excel file
 */
export const downloadIdaCExcel = (
  edges: Edge[],
  nodes: Node[],
  filename: string = "IdaC-Export.xlsx",
  metadata?: Record<string, string>
) => {
  const workbook = generateIdaCWorkbook(edges, nodes, metadata);
  XLSX.writeFile(workbook, filename);
};
