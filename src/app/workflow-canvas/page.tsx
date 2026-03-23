import WorkflowCanvas from "@/modules/workflow-canvas/workflow-page";

export const maxDuration = 10;

export default async function WorkflowCanvasPage() {
  return (
    <div className="h-[calc(100dvh-2.5rem)] min-h-0 overflow-hidden">
      <WorkflowCanvas />
    </div>
  );
}
