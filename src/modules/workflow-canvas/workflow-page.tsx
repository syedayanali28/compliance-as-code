import type { Metadata } from "next";
import { Canvas } from "@/modules/workflow-canvas/components/canvas";
import { Controls } from "@/modules/workflow-canvas/components/controls";
import { LiveAuditTicker } from "@/modules/workflow-canvas/components/live-audit-ticker";
import { Reasoning } from "@/modules/workflow-canvas/components/reasoning";
import { Toolbar } from "@/modules/workflow-canvas/components/toolbar";
import { GatewayProvider } from "@/modules/workflow-canvas/providers/gateway";
import { ReactFlowProvider } from "@/modules/workflow-canvas/providers/react-flow";

export const metadata: Metadata = {
  title: "HKMA Compliance Graph Builder",
  description:
    "A visual network and policy topology builder for HKMA firewall compliance workflows.",
};

export const maxDuration = 10;

interface WorkflowCanvasPageProps {
  readonly initialDesignId?: string;
}

const Index = ({ initialDesignId }: WorkflowCanvasPageProps) => (
  <GatewayProvider>
    <ReactFlowProvider>
      <div className="flex h-full min-h-0 w-full items-stretch overflow-hidden">
        <div className="relative flex-1">
          <Canvas>
            <Controls />
            <Toolbar initialDesignId={initialDesignId} />
          </Canvas>
        </div>
        <Reasoning />
      </div>
      <LiveAuditTicker />
    </ReactFlowProvider>
  </GatewayProvider>
);

export default Index;

