import { DropNode } from "./drop";
import { EnvironmentBoxNode } from "./environment-box";
import { HkmaNode } from "./hkma";
import { TextNode } from "./text";

export const nodeTypes = {
  "environment-box": EnvironmentBoxNode,
  "zone-box": EnvironmentBoxNode,
  "environment-prod": EnvironmentBoxNode,
  "environment-pre": EnvironmentBoxNode,
  "environment-uat": EnvironmentBoxNode,
  "environment-dev": EnvironmentBoxNode,
  "zone-public-network": EnvironmentBoxNode,
  "zone-dmz": EnvironmentBoxNode,
  "zone-private-network": EnvironmentBoxNode,
  "zone-public": EnvironmentBoxNode,
  "zone-internal": EnvironmentBoxNode,
  "zone-aws-private-cloud": EnvironmentBoxNode,
  "zone-oa": EnvironmentBoxNode,
  "zone-internet": EnvironmentBoxNode,
  "control-firewall-external": HkmaNode,
  "control-firewall-internal": HkmaNode,
  environment: HkmaNode,
  "control-firewall": HkmaNode,
  "control-proxy": HkmaNode,
  "control-proxy-public": HkmaNode,
  "control-proxy-internal": HkmaNode,
  "resource-app": HkmaNode,
  "resource-db": HkmaNode,
  "database-postgres": HkmaNode,
  "database-mysql": HkmaNode,
  "backend-nodejs": HkmaNode,
  "backend-fastapi": HkmaNode,
  "backend-flask": HkmaNode,
  "backend-dotnet": HkmaNode,
  "frontend-nextjs": HkmaNode,
  "frontend-gradio": HkmaNode,
  text: TextNode,
  drop: DropNode,
};

