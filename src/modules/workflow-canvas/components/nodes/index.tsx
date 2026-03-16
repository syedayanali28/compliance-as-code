import { DropNode } from "./drop";
import { HkmaNode } from "./hkma";
import { TextNode } from "./text";

export const nodeTypes = {
  environment: HkmaNode,
  "zone-dmz": HkmaNode,
  "zone-oa": HkmaNode,
  "zone-internet": HkmaNode,
  "control-firewall": HkmaNode,
  "control-proxy": HkmaNode,
  "resource-app": HkmaNode,
  "resource-db": HkmaNode,
  text: TextNode,
  drop: DropNode,
};

