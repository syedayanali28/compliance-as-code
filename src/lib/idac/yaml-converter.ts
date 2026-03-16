/**
 * IdaC YAML Converter
 *
 * Converts parsed DesignRow[] into a deterministic YAML format
 * suitable for version control in GitLab.
 */

import yaml from "js-yaml";
import type {
  DesignRow,
  TemplateMetadata,
  IdacDocument,
  IdacConnection,
} from "@/types";

/**
 * Parse port string "443, 8080" into number array [443, 8080]
 */
function parsePorts(portStr: string): number[] {
  return portStr
    .split(/[,;\s]+/)
    .map((p) => parseInt(p.trim(), 10))
    .filter((p) => !isNaN(p))
    .sort((a, b) => a - b);
}

/**
 * Convert DesignRow[] to IdacDocument for YAML serialization
 */
export function toIdacDocument(
  rows: DesignRow[],
  metadata: TemplateMetadata
): IdacDocument {
  const connections: IdacConnection[] = rows.map((row) => ({
    row: row.rowNumber,
    source: {
      component: row.sourceComponent,
      technology: row.sourceTechnology,
      zone: row.sourceZone,
      ...(row.sourceIpSubnet && { ipSubnet: row.sourceIpSubnet }),
    },
    destination: {
      component: row.destComponent,
      technology: row.destTechnology,
      zone: row.destZone,
      ...(row.destIpSubnet && { ipSubnet: row.destIpSubnet }),
    },
    direction: row.direction,
    protocol: row.protocol,
    ports: parsePorts(row.ports),
    action: row.action,
    isCommonService: row.isCommonService,
    justification: row.justification,
  }));

  return {
    project: metadata.projectName || "Unknown",
    version: metadata.version,
    submittedBy: metadata.architectName || "Unknown",
    submittedAt: metadata.submissionDate || new Date().toISOString(),
    ...(metadata.environment && { environment: metadata.environment }),
    connections,
  };
}

/**
 * Serialize IdacDocument to YAML string
 */
export function toYaml(doc: IdacDocument): string {
  return yaml.dump(doc, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
  });
}

/**
 * Full pipeline: DesignRow[] + metadata → YAML string
 */
export function convertToYaml(
  rows: DesignRow[],
  metadata: TemplateMetadata
): string {
  const doc = toIdacDocument(rows, metadata);
  return toYaml(doc);
}
