/**
 * Mermaid Diagram Generator
 *
 * Converts DesignRow[] into a Mermaid.js flowchart that shows
 * components grouped by network zone with labeled connections.
 */

import type { DesignRow, Zone } from "@/types";

interface Component {
  id: string;
  label: string;
  technology: string;
  zone: Zone;
}

interface Connection {
  fromId: string;
  toId: string;
  label: string;
  direction: string;
  isCommonService: boolean;
}

/**
 * Generate a sanitized Mermaid node ID from component name
 */
function toNodeId(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();
}

/**
 * Escape special characters in Mermaid labels
 */
function escapeLabel(text: string): string {
  return text.replace(/"/g, "'").replace(/[[\]{}()]/g, "");
}

/**
 * Zone display config
 */
const ZONE_CONFIG: Record<Zone, { title: string; style: string }> = {
  Internet: {
    title: "Internet (External)",
    style: "fill:#FFE0E0,stroke:#CC0000,color:#333",
  },
  DMZ: {
    title: "DMZ (Demilitarized Zone)",
    style: "fill:#FFF3CD,stroke:#FFC107,color:#333",
  },
  Intranet: {
    title: "Intranet (OA Network)",
    style: "fill:#D4EDDA,stroke:#28A745,color:#333",
  },
};

/**
 * Generate Mermaid flowchart source from design rows
 */
export function generateMermaidDiagram(rows: DesignRow[]): string {
  // Collect unique components
  const componentMap = new Map<string, Component>();
  const connections: Connection[] = [];

  for (const row of rows) {
    const srcId = toNodeId(row.sourceComponent);
    const dstId = toNodeId(row.destComponent);

    if (!componentMap.has(srcId)) {
      componentMap.set(srcId, {
        id: srcId,
        label: row.sourceComponent,
        technology: row.sourceTechnology,
        zone: row.sourceZone,
      });
    }

    if (!componentMap.has(dstId)) {
      componentMap.set(dstId, {
        id: dstId,
        label: row.destComponent,
        technology: row.destTechnology,
        zone: row.destZone,
      });
    }

    const portLabel = row.ports.length > 20 ? row.ports.substring(0, 20) + "..." : row.ports;
    const label = `${row.protocol}/${portLabel}`;

    connections.push({
      fromId: srcId,
      toId: dstId,
      label,
      direction: row.direction,
      isCommonService: row.isCommonService,
    });
  }

  // Group components by zone
  const zoneGroups: Record<Zone, Component[]> = {
    Internet: [],
    DMZ: [],
    Intranet: [],
  };

  for (const comp of componentMap.values()) {
    zoneGroups[comp.zone].push(comp);
  }

  // Build Mermaid source
  const lines: string[] = [];
  lines.push("flowchart LR");
  lines.push("");

  // Zone subgraphs
  for (const zone of ["Internet", "DMZ", "Intranet"] as Zone[]) {
    const components = zoneGroups[zone];
    if (components.length === 0) continue;

    const config = ZONE_CONFIG[zone];
    lines.push(`  subgraph ${zone}["${config.title}"]`);

    for (const comp of components) {
      const label = escapeLabel(comp.label);
      const tech = escapeLabel(comp.technology);
      lines.push(`    ${comp.id}["${label}<br/><i>${tech}</i>"]`);
    }

    lines.push("  end");
    lines.push("");
  }

  // Proxy nodes between zones (if cross-zone connections exist)
  const hasCrossZone = connections.some(
    (c) =>
      componentMap.get(c.fromId)?.zone !==
      componentMap.get(c.toId)?.zone
  );

  if (hasCrossZone) {
    // Add proxy indicators
    const hasInternetDmz = connections.some((c) => {
      const srcZone = componentMap.get(c.fromId)?.zone;
      const dstZone = componentMap.get(c.toId)?.zone;
      return (
        (srcZone === "Internet" && dstZone === "DMZ") ||
        (srcZone === "DMZ" && dstZone === "Internet")
      );
    });
    const hasDmzIntranet = connections.some((c) => {
      const srcZone = componentMap.get(c.fromId)?.zone;
      const dstZone = componentMap.get(c.toId)?.zone;
      return (
        (srcZone === "DMZ" && dstZone === "Intranet") ||
        (srcZone === "Intranet" && dstZone === "DMZ")
      );
    });

    if (hasInternetDmz) {
      lines.push('  proxy_ext{{"Proxy/FW"}}');
    }
    if (hasDmzIntranet) {
      lines.push('  proxy_int{{"Proxy/FW"}}');
    }
    lines.push("");
  }

  // Connections
  for (const conn of connections) {
    const label = escapeLabel(conn.label);
    const style = conn.isCommonService ? "-.->" : "-->";
    const arrow =
      conn.direction === "Bidirectional"
        ? `${conn.fromId} <${style.replace(">", "")}> ${conn.toId}`
        : `${conn.fromId} ${style}|"${label}"| ${conn.toId}`;

    lines.push(`  ${arrow}`);
  }

  // Styling
  lines.push("");
  for (const zone of ["Internet", "DMZ", "Intranet"] as Zone[]) {
    if (zoneGroups[zone].length > 0) {
      lines.push(`  style ${zone} ${ZONE_CONFIG[zone].style}`);
    }
  }

  // Common service connections get dashed style
  const commonConns = connections.filter((c) => c.isCommonService);
  if (commonConns.length > 0) {
    lines.push("  %% Dashed lines indicate common/shared services");
  }

  return lines.join("\n");
}
