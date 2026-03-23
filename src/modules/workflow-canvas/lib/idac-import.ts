import * as XLSX from "xlsx";
import type { Node, Edge } from "@xyflow/react";
import { nanoid } from "nanoid";

export interface IdaCImportResult {
  nodes: Node[];
  edges: Edge[];
  metadata: Record<string, string>;
  warnings: string[];
}

/**
 * Maps IdAC standard zone names back to internal zone types
 */
const mapStandardZoneToInternal = (zoneName: string): string => {
  const normalized = zoneName.toLowerCase().trim();
  
  const zoneMap: Record<string, string> = {
    "internet": "zone-public-network",
    "dmz": "zone-dmz",
    "intranet": "zone-private-network",
    "oa": "zone-private-network",
    "private network": "zone-private-network",
    "internal": "zone-internal"
  };

  return zoneMap[normalized] || "zone-private-network";
};

/**
 * Parse technology string to determine component type
 */
const parseComponentType = (technology: string): string => {
  const normalized = technology.toLowerCase();
  
  if (normalized.includes("postgres")) return "database-postgres";
  if (normalized.includes("mysql")) return "database-mysql";
  if (normalized.includes("database") || normalized.includes("db")) return "database-postgres";
  
  if (normalized.includes("nodejs") || normalized.includes("node.js")) return "backend-nodejs";
  if (normalized.includes("fastapi")) return "backend-fastapi";
  if (normalized.includes("flask")) return "backend-flask";
  if (normalized.includes(".net") || normalized.includes("dotnet")) return "backend-dotnet";
  if (normalized.includes("backend")) return "backend-nodejs";
  
  if (normalized.includes("nextjs") || normalized.includes("next.js")) return "frontend-nextjs";
  if (normalized.includes("gradio")) return "frontend-gradio";
  if (normalized.includes("frontend")) return "frontend-nextjs";
  
  return "resource-app";
};

/**
 * Imports an IdAC Excel file and reconstructs the canvas graph
 */
export const importIdaCExcel = async (file: File): Promise<IdaCImportResult> => {
  const warnings: string[] = [];
  
  // Read the file
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer);

  // Parse metadata
  const metadataSheet = workbook.Sheets["Metadata"];
  const metadataRows = XLSX.utils.sheet_to_json<[string, string]>(metadataSheet, { header: 1 });
  const metadata: Record<string, string> = {};
  
  for (let i = 1; i < metadataRows.length; i++) {
    const [field, value] = metadataRows[i];
    if (field && value) {
      metadata[field] = String(value);
    }
  }

  // Parse system connections
  const connectionsSheet = workbook.Sheets["System Connections"];
  const connections = XLSX.utils.sheet_to_json<Record<string, string>>(connectionsSheet);

  // Track unique components, zones, environments, and firewalls
  const componentMap = new Map<string, Node>();
  const zoneMap = new Map<string, Node>();
  const environmentMap = new Map<string, Node>();
  const firewallMap = new Map<string, Node>();
  const edges: Edge[] = [];

  // Helper to get or create environment
  const getOrCreateEnvironment = (envLabel: string): Node => {
    if (environmentMap.has(envLabel)) {
      return environmentMap.get(envLabel)!;
    }

    const envNode: Node = {
      id: nanoid(),
      type: "environment-prod",
      position: { x: 100 + environmentMap.size * 600, y: 100 },
      data: {
        label: envLabel || "Production Environment",
        category: "environment",
        componentType: "environment:prod",
        componentKey: `environment-${envLabel.toLowerCase().replace(/\s+/g, "-")}`,
        isZone: true
      },
      style: { width: 490, height: 310 }
    };

    environmentMap.set(envLabel, envNode);
    return envNode;
  };

  // Helper to get or create zone
  const getOrCreateZone = (zoneName: string, envNode: Node): Node => {
    const zoneKey = `${envNode.id}-${zoneName}`;
    
    if (zoneMap.has(zoneKey)) {
      return zoneMap.get(zoneKey)!;
    }

    const zoneType = mapStandardZoneToInternal(zoneName);
    const zoneIndex = zoneMap.size % 3;

    const zoneNode: Node = {
      id: nanoid(),
      type: zoneType,
      parentId: envNode.id,
      position: { x: 20 + zoneIndex * 160, y: 40 },
      extent: "parent" as const,
      data: {
        label: `${zoneName} Zone`,
        category: "zone",
        zone: zoneName.toLowerCase(),
        componentType: `zone:${zoneName.toLowerCase()}`,
        componentKey: zoneType,
        isZone: true,
        environmentId: envNode.id,
        environmentLabel: envNode.data.label
      },
      style: { width: 150, height: 120, zIndex: 1001 }
    };

    zoneMap.set(zoneKey, zoneNode);
    return zoneNode;
  };

  // Helper to get or create firewall
  const getOrCreateFirewall = (firewallName: string, envNode: Node): Node => {
    const firewallKey = `${envNode.id}-${firewallName}`;
    
    if (firewallMap.has(firewallKey)) {
      return firewallMap.get(firewallKey)!;
    }

    const isExternal = firewallName.toLowerCase().includes("external");
    const firewallType = isExternal ? "control-firewall-external" : "control-firewall-internal";
    const firewallIndex = firewallMap.size;

    const firewallNode: Node = {
      id: nanoid(),
      type: firewallType,
      parentId: envNode.id,
      position: { x: 200, y: 140 + firewallIndex * 60 },
      extent: "parent" as const,
      data: {
        label: firewallName,
        category: "control",
        componentType: isExternal ? "firewall:external-facing" : "firewall:internal-facing",
        componentKey: isExternal ? "firewall-external-facing" : "firewall-internal-facing",
        environmentId: envNode.id,
        environmentLabel: envNode.data.label,
        isUnique: true
      },
      style: { zIndex: 1001 }
    };

    firewallMap.set(firewallKey, firewallNode);
    return firewallNode;
  };

  // Process each connection
  for (const conn of connections) {
    if (!conn["Source Component"] || !conn["Dest Component"]) {
      continue;
    }

    const environment = conn["Environment"] || "Production";
    const envNode = getOrCreateEnvironment(environment);

    const sourceZoneName = conn["Source Zone"] || "Intranet";
    const destZoneName = conn["Dest Zone"] || "Intranet";

    const sourceZone = getOrCreateZone(sourceZoneName, envNode);
    const destZone = getOrCreateZone(destZoneName, envNode);

    // Create source component
    const sourceKey = `${sourceZone.id}-${conn["Source Component"]}`;
    if (!componentMap.has(sourceKey)) {
      const componentType = parseComponentType(conn["Source Technology"] || "");
      const compIndex = Array.from(componentMap.values()).filter(
        n => n.parentId === sourceZone.id
      ).length;

      const sourceNode: Node = {
        id: nanoid(),
        type: componentType,
        parentId: sourceZone.id,
        position: { x: 15, y: 15 + compIndex * 50 },
        extent: "parent" as const,
        data: {
          label: conn["Source Component"],
          category: componentType.split("-")[0] as any,
          componentType: componentType.replace("-", ":"),
          componentKey: componentType,
          zoneId: sourceZone.id,
          zoneLabel: sourceZone.data.label,
          environmentId: envNode.id,
          environmentLabel: envNode.data.label,
          customFields: {
            "IP Address": conn["Source IP / Subnet"] || "",
            "Protocol": conn["Protocol"] || "",
            "Port": conn["Port(s)"] || ""
          }
        }
      };

      componentMap.set(sourceKey, sourceNode);
    }

    // Create destination component
    const destKey = `${destZone.id}-${conn["Dest Component"]}`;
    if (!componentMap.has(destKey)) {
      const componentType = parseComponentType(conn["Dest Technology"] || "");
      const compIndex = Array.from(componentMap.values()).filter(
        n => n.parentId === destZone.id
      ).length;

      const destNode: Node = {
        id: nanoid(),
        type: componentType,
        parentId: destZone.id,
        position: { x: 15, y: 15 + compIndex * 50 },
        extent: "parent" as const,
        data: {
          label: conn["Dest Component"],
          category: componentType.split("-")[0] as any,
          componentType: componentType.replace("-", ":"),
          componentKey: componentType,
          zoneId: destZone.id,
          zoneLabel: destZone.data.label,
          environmentId: envNode.id,
          environmentLabel: envNode.data.label,
          customFields: {
            "IP Address": conn["Dest IP / Subnet"] || "",
            "Protocol": conn["Protocol"] || "",
            "Port": conn["Port(s)"] || ""
          }
        }
      };

      componentMap.set(destKey, destNode);
    }

    // Create or get firewall
    const firewallName = conn["Gateway"] || "Firewall";
    const firewall = getOrCreateFirewall(firewallName, envNode);

    // Create edges: Source → Firewall → Dest
    const sourceNode = componentMap.get(sourceKey)!;
    const destNode = componentMap.get(destKey)!;

    edges.push({
      id: nanoid(),
      source: sourceNode.id,
      target: firewall.id,
      type: "animated",
      data: {
        label: "",
        protocol: conn["Protocol"] || "HTTPS",
        port: conn["Port(s)"] || "443",
        justification: conn["Justification"] || ""
      }
    });

    edges.push({
      id: nanoid(),
      source: firewall.id,
      target: destNode.id,
      type: "animated",
      data: {
        label: "",
        protocol: conn["Protocol"] || "HTTPS",
        port: conn["Port(s)"] || "443",
        justification: conn["Justification"] || ""
      }
    });
  }

  const allNodes = [
    ...Array.from(environmentMap.values()),
    ...Array.from(zoneMap.values()),
    ...Array.from(firewallMap.values()),
    ...Array.from(componentMap.values())
  ];

  return {
    nodes: allNodes,
    edges,
    metadata,
    warnings
  };
};
