"use client";

import { Canvas } from "@/modules/workflow-canvas/components/canvas";
import { Reasoning } from "@/modules/workflow-canvas/components/reasoning";
import { Toolbar } from "@/modules/workflow-canvas/components/toolbar";
import { CanvasPreferencesProvider } from "@/modules/workflow-canvas/providers/canvas-preferences";
import { ReactFlowProvider } from "@/modules/workflow-canvas/providers/react-flow";

interface WorkflowCanvasClientProps {
  readonly initialDesignId?: string;
}

export function WorkflowCanvasClient({ initialDesignId }: WorkflowCanvasClientProps) {
  return (
    <ReactFlowProvider>
      <CanvasPreferencesProvider>
        <div className="flex h-screen w-full flex-col overflow-hidden bg-muted/30">
          <div className="flex flex-1 items-stretch overflow-hidden">
            <div className="relative flex-1">
              <Canvas>
                <Toolbar initialDesignId={initialDesignId} />
              </Canvas>
            </div>
            <Reasoning />
          </div>
        </div>
      </CanvasPreferencesProvider>
    </ReactFlowProvider>
  );
}
