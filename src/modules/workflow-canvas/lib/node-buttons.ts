import type { LucideIcon } from "lucide-react";
import {
  ActivityIcon,
  BotIcon,
  BoxIcon,
  BracesIcon,
  BrainCircuitIcon,
  CloudIcon,
  ContainerIcon,
  CpuIcon,
  DatabaseIcon,
  FolderGitIcon,
  GaugeIcon,
  GlobeIcon,
  HardDriveIcon,
  KeyIcon,
  LayersIcon,
  LockIcon,
  MapPinIcon,
  MonitorIcon,
  NetworkIcon,
  PackageIcon,
  ServerIcon,
  ShieldCheckIcon,
  ShieldIcon,
  SquareStackIcon,
  WaypointsIcon,
  WrenchIcon,
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
  // Zones
  "zone-oa-baremetal": NetworkIcon,
  "zone-oa-private-cloud": CloudIcon,
  "zone-oa-app-dmz": ShieldIcon,
  "zone-dmz": ShieldIcon,
  "zone-aws-landing-zone": CloudIcon,

  // Regions
  "region-ifc": MapPinIcon,
  "region-kcc": MapPinIcon,

  // Environments
  "environment-box": SquareStackIcon,
  "environment-prod": SquareStackIcon,
  "environment-pre": SquareStackIcon,
  "environment-uat": SquareStackIcon,
  "environment-dev": SquareStackIcon,
  "environment-dr": SquareStackIcon,

  // Compute
  "compute-vm": MonitorIcon,
  "compute-k8s": ContainerIcon,

  // Databases
  "database-postgres": DatabaseIcon,
  "database-mysql": DatabaseIcon,
  "data-dremio": DatabaseIcon,

  // Backend
  "backend-nodejs": ServerIcon,
  "backend-fastapi": BracesIcon,
  "backend-flask": BracesIcon,
  "backend-dotnet": PackageIcon,
  "backend-express": ServerIcon,
  "backend-drizzle-orm": DatabaseIcon,
  "container-docker": BoxIcon,

  // Frontend
  "frontend-nextjs": LayersIcon,
  "frontend-gradio": LayersIcon,
  "frontend-axios": GlobeIcon,

  // IAM
  "iam-active-directory": KeyIcon,

  // Orchestration
  "orchestration-kubernetes": ContainerIcon,

  // AI/ML
  "ai-maas-genai": BrainCircuitIcon,
  "ai-rayserve": BotIcon,
  "ai-dify": BrainCircuitIcon,

  // Security
  "security-siem": ShieldCheckIcon,
  "security-edr": LockIcon,

  // Monitoring
  "monitoring-grafana": GaugeIcon,

  // Storage
  "storage-pure-storage": HardDriveIcon,
  "storage-filecloud": HardDriveIcon,

  // CI/CD
  "cicd-harbor": ContainerIcon,
  "cicd-jenkins": WrenchIcon,
  "cicd-ansible": WrenchIcon,
  "cicd-sonarqube": ActivityIcon,
  "cicd-gitlab": FolderGitIcon,

  // Integration / External
  "issue-tracking-jira": CpuIcon,
  "bi-tableau": GaugeIcon,
  "external-lseg-api": GlobeIcon,

  // Utility
  drop: WaypointsIcon,
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

