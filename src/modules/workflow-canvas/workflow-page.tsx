import { GatewayProvider } from "@/modules/workflow-canvas/providers/gateway";
import { WorkflowCanvasClient } from "@/modules/workflow-canvas/workflow-canvas-client";

interface WorkflowCanvasPageProps {
  readonly initialDesignId?: string;
}

export default async function WorkflowCanvas({ initialDesignId }: WorkflowCanvasPageProps) {
  return (
    <GatewayProvider>
      <WorkflowCanvasClient initialDesignId={initialDesignId} />
    </GatewayProvider>
  );
}
