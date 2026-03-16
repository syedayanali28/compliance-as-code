import type { LucideIcon } from "lucide-react";
import {
  DatabaseIcon,
  GlobeIcon,
  NetworkIcon,
  ServerIcon,
  ShieldIcon,
  SquareStackIcon,
  WaypointsIcon,
} from "lucide-react";
import type { HkmaNodeData } from "@/modules/workflow-canvas/lib/hkma-graph";

export interface NodeButton {
  id: string;
  label: string;
  icon: LucideIcon;
  data: HkmaNodeData;
}

export const nodeButtons: NodeButton[] = [
  {
    id: "environment",
    label: "Environment",
    icon: SquareStackIcon,
    data: {
      label: "Environment",
      category: "environment",
      description: "Root scope for this firewall request.",
      componentType: "environment",
    },
  },
  {
    id: "zone-dmz",
    label: "Zone: DMZ",
    icon: ShieldIcon,
    data: {
      label: "DMZ Zone",
      category: "zone",
      zone: "dmz",
      description: "Perimeter network segment for externally exposed services.",
      componentType: "network-zone",
    },
  },
  {
    id: "zone-oa",
    label: "Zone: OA / Intranet",
    icon: NetworkIcon,
    data: {
      label: "OA / Intranet Zone",
      category: "zone",
      zone: "oa",
      description: "Internal office and business application network.",
      componentType: "network-zone",
    },
  },
  {
    id: "zone-internet",
    label: "Zone: Internet",
    icon: GlobeIcon,
    data: {
      label: "Internet Zone",
      category: "zone",
      zone: "internet",
      description: "External source or destination network.",
      componentType: "network-zone",
    },
  },
  {
    id: "control-firewall",
    label: "Control: Firewall",
    icon: WaypointsIcon,
    data: {
      label: "Firewall Control",
      category: "control",
      description: "Traffic enforcement point with explicit allow or deny policies.",
      componentType: "firewall",
    },
  },
  {
    id: "control-proxy",
    label: "Control: Proxy",
    icon: WaypointsIcon,
    data: {
      label: "Proxy Control",
      category: "control",
      description: "Application-layer mediation and filtering point.",
      componentType: "proxy",
    },
  },
  {
    id: "resource-app",
    label: "Resource: Application",
    icon: ServerIcon,
    data: {
      label: "Application Resource",
      category: "resource",
      description: "Target application service behind policy controls.",
      componentType: "application",
    },
  },
  {
    id: "resource-db",
    label: "Resource: Database",
    icon: DatabaseIcon,
    data: {
      label: "Database Resource",
      category: "resource",
      description: "Data persistence endpoint requiring strict ingress constraints.",
      componentType: "database",
    },
  },
];

