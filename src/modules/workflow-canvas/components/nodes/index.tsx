import { DropNode } from "./drop";
import { EnvironmentBoxNode } from "./environment-box";
import { HkmaNode } from "./hkma";
import { TextNode } from "./text";

export const nodeTypes = {
  // Zones (top-level containers)
  "zone-oa-baremetal": EnvironmentBoxNode,
  "zone-oa-private-cloud": EnvironmentBoxNode,
  "zone-oa-app-dmz": EnvironmentBoxNode,
  "zone-dmz": EnvironmentBoxNode,
  "zone-aws-landing-zone": EnvironmentBoxNode,
  
  // Regions
  "region-ifc": EnvironmentBoxNode,
  "region-kcc": EnvironmentBoxNode,
  
  // Environments
  "environment-box": EnvironmentBoxNode,
  "environment-prod": EnvironmentBoxNode,
  "environment-pre": EnvironmentBoxNode,
  "environment-uat": EnvironmentBoxNode,
  "environment-dev": EnvironmentBoxNode,
  "environment-dr": EnvironmentBoxNode,
  environment: HkmaNode,
  
  // Compute
  "compute-vm": EnvironmentBoxNode,
  "compute-k8s": EnvironmentBoxNode,
  
  // Legacy (backwards compatibility)
  "resource-app": HkmaNode,
  "resource-db": HkmaNode,
  
  // Databases
  "database-postgres": HkmaNode,
  "database-mysql": HkmaNode,
  "data-dremio": HkmaNode,
  
  // Backend
  "backend-nodejs": HkmaNode,
  "backend-fastapi": HkmaNode,
  "backend-flask": HkmaNode,
  "backend-dotnet": HkmaNode,
  "backend-express": HkmaNode,
  "backend-drizzle-orm": HkmaNode,
  "container-docker": HkmaNode,
  
  // Frontend
  "frontend-nextjs": HkmaNode,
  "frontend-gradio": HkmaNode,
  "frontend-axios": HkmaNode,
  
  // IAM
  "iam-active-directory": HkmaNode,
  
  // Orchestration
  "orchestration-kubernetes": HkmaNode,
  
  // AI/ML
  "ai-maas-genai": HkmaNode,
  "ai-rayserve": HkmaNode,
  "ai-dify": HkmaNode,
  
  // Security
  "security-siem": HkmaNode,
  "security-edr": HkmaNode,
  
  // Monitoring
  "monitoring-grafana": HkmaNode,
  
  // Storage
  "storage-pure-storage": HkmaNode,
  "storage-filecloud": HkmaNode,
  
  // CI/CD
  "cicd-harbor": HkmaNode,
  "cicd-jenkins": HkmaNode,
  "cicd-ansible": HkmaNode,
  "cicd-sonarqube": HkmaNode,
  "cicd-gitlab": HkmaNode,
  
  // Integration / External
  "issue-tracking-jira": HkmaNode,
  "bi-tableau": HkmaNode,
  "external-lseg-api": HkmaNode,
  
  // Utility
  text: TextNode,
  drop: DropNode,
};
