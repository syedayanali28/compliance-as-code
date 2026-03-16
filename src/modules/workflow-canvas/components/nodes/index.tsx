import { DropNode } from "./drop";
import { HkmaNode } from "./hkma";
import { ImageNode } from "./image";
import { TextNode } from "./text";
import { VideoNode } from "./video";

export const nodeTypes = {
  environment: HkmaNode,
  "zone-dmz": HkmaNode,
  "zone-oa": HkmaNode,
  "zone-internet": HkmaNode,
  "control-firewall": HkmaNode,
  "control-proxy": HkmaNode,
  "resource-app": HkmaNode,
  "resource-db": HkmaNode,
  image: ImageNode,
  text: TextNode,
  drop: DropNode,
  video: VideoNode,
};

