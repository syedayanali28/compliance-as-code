import {
  ACTIONS,
  DATA_CLASSIFICATIONS,
  DIRECTIONS,
  ENVIRONMENTS,
  PROTOCOLS,
  ZONES,
} from "@/types";

export interface IdacTemplateColumn {
  header: string;
  key: string;
  width: number;
  validationValues?: readonly string[];
}

export const IDAC_TEMPLATE_FILENAME = "IdaC-Template.xlsx";

export const IDAC_INSTRUCTION_COLUMNS: IdacTemplateColumn[] = [
  { header: "Section", key: "section", width: 24 },
  { header: "Instruction", key: "instruction", width: 80 },
];

export const IDAC_INSTRUCTION_ROWS = [
  {
    section: "Overview",
    instruction:
      "This template captures Infrastructure-as-Code (IdaC) design information for HKMA compliance review. Fill in the System Connections, Common Services, and Metadata sheets.",
  },
  {
    section: "System Connections",
    instruction:
      "One row per network connection. Source and Destination zones must be Internet, DMZ, or Intranet. Provide justification for every rule, especially cross-zone connections.",
  },
  {
    section: "Common Services",
    instruction:
      "List shared services (DNS, NTP, AD, etc.) referenced by multiple connections. These will be validated against the connection rules.",
  },
  {
    section: "Metadata",
    instruction:
      "Fill in all project metadata. This information is included in the compliance report header.",
  },
  {
    section: "Validation Rules",
    instruction:
      "After upload, the system will check: zone-crossing justification, protocol/port validity, common service consistency, and policy compliance per HKMA guidelines.",
  },
  {
    section: "Drop-down Lists",
    instruction:
      "Zone, Direction, Protocol, Action, Environment, and Data Classification columns use drop-down lists. Select valid values from the list to avoid validation errors.",
  },
] as const;

export const IDAC_SYSTEM_CONNECTION_COLUMNS: IdacTemplateColumn[] = [
  { header: "Row #", key: "rowNumber", width: 8 },
  { header: "Source Component", key: "sourceComponent", width: 22 },
  { header: "Source Technology", key: "sourceTechnology", width: 20 },
  { header: "Source Zone", key: "sourceZone", width: 14, validationValues: ZONES },
  { header: "Source IP / Subnet", key: "sourceIpSubnet", width: 20 },
  { header: "Dest Component", key: "destComponent", width: 22 },
  { header: "Dest Technology", key: "destTechnology", width: 20 },
  { header: "Dest Zone", key: "destZone", width: 14, validationValues: ZONES },
  { header: "Dest IP / Subnet", key: "destIpSubnet", width: 20 },
  { header: "Direction", key: "direction", width: 14, validationValues: DIRECTIONS },
  {
    header: "Arrow Directionality",
    key: "arrowDirectionality",
    width: 20,
    validationValues: ["one-way", "two-way"],
  },
  {
    header: "Line Style",
    key: "lineStyle",
    width: 14,
    validationValues: ["solid", "dotted"],
  },
  {
    header: "Connection Type",
    key: "connectionType",
    width: 18,
    validationValues: ["firewall-request", "data-flow", "management", "replication"],
  },
  { header: "Protocol", key: "protocol", width: 12, validationValues: PROTOCOLS },
  { header: "Port(s)", key: "ports", width: 16 },
  { header: "Action", key: "action", width: 10, validationValues: ACTIONS },
  {
    header: "Is Common Service?",
    key: "isCommonService",
    width: 18,
    validationValues: ["Yes", "No"],
  },
  { header: "Justification", key: "justification", width: 36 },
  {
    header: "Environment",
    key: "environment",
    width: 14,
    validationValues: ENVIRONMENTS,
  },
  { header: "Application ID", key: "applicationId", width: 18 },
  {
    header: "Data Classification",
    key: "dataClassification",
    width: 20,
    validationValues: DATA_CLASSIFICATIONS,
  },
  {
    header: "Encryption Required?",
    key: "encryptionRequired",
    width: 20,
    validationValues: ["Yes", "No"],
  },
  { header: "NAT Translation", key: "natTranslation", width: 20 },
  { header: "Gateway", key: "gateway", width: 16 },
];

export const IDAC_COMMON_SERVICE_COLUMNS: IdacTemplateColumn[] = [
  { header: "Service Name", key: "serviceName", width: 24 },
  { header: "Protocol", key: "protocol", width: 12, validationValues: PROTOCOLS },
  { header: "Port(s)", key: "ports", width: 16 },
  { header: "Destination", key: "destination", width: 24 },
  { header: "Description", key: "description", width: 40 },
];

export const IDAC_METADATA_COLUMNS: IdacTemplateColumn[] = [
  { header: "Field", key: "field", width: 30 },
  { header: "Value", key: "value", width: 50 },
];

export const IDAC_METADATA_ROWS = [
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
] as const;
