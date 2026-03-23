import type { LucideIcon } from "lucide-react";
import {
  BracesIcon,
  CloudIcon,
  DatabaseIcon,
  GlobeIcon,
  LayersIcon,
  LockIcon,
  PackageIcon,
  ShieldCheckIcon,
  NetworkIcon,
  ServerIcon,
  ShieldIcon,
  SquareStackIcon,
  WaypointsIcon,
} from "lucide-react";
import type { HkmaNodeData } from "@/modules/workflow-canvas/lib/hkma-graph";
import {
  createDefaultCatalog,
  type RuntimePolicyCatalog,
  toPolicyPayload,
} from "@/modules/workflow-canvas/lib/policy-catalog";

export interface NodeButton {
  id: string;
  label: string;
  icon: LucideIcon;
  data: HkmaNodeData & Record<string, unknown>;
}

const iconByNodeType: Record<string, LucideIcon> = {
  "environment-box": SquareStackIcon,
  "zone-box": GlobeIcon,
  "zone-public": GlobeIcon,
  "zone-dmz": ShieldIcon,
  "zone-internal": NetworkIcon,
  "zone-internet": GlobeIcon,
  "zone-oa": NetworkIcon,
  "zone-aws-private-cloud": CloudIcon,
  "control-proxy-public": ShieldCheckIcon,
  "control-proxy-internal": LockIcon,
  "database-postgres": DatabaseIcon,
  "database-mysql": DatabaseIcon,
  "backend-nodejs": ServerIcon,
  "backend-fastapi": BracesIcon,
  "backend-flask": BracesIcon,
  "backend-dotnet": PackageIcon,
  "frontend-nextjs": LayersIcon,
  "frontend-gradio": LayersIcon,
  drop: WaypointsIcon,
  "environment-prod": SquareStackIcon,
  "environment-pre": SquareStackIcon,
  "environment-uat": SquareStackIcon,
  "environment-dev": SquareStackIcon,
  "zone-public-network": GlobeIcon,
  "zone-private-network": NetworkIcon,
  "control-firewall-external": ShieldCheckIcon,
  "control-firewall-internal": LockIcon,
};

export const buildNodeButtons = (catalog: RuntimePolicyCatalog): NodeButton[] => {
  return toPolicyPayload(catalog).map((item) => ({
    id: item.id,
    label: item.label,
    icon: iconByNodeType[item.nodeType] ?? ServerIcon,
    data: item.data as HkmaNodeData & Record<string, unknown>,
  }));
};

export const nodeButtons: NodeButton[] = buildNodeButtons(createDefaultCatalog());

