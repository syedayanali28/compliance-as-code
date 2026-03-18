import WorkflowCanvas from "@/modules/workflow-canvas/workflow-page";

export default async function WorkflowCanvasPage() {
  return (
    <div className="h-[calc(100dvh-3.5rem)] min-h-0 overflow-hidden">
      <WorkflowCanvas />
    </div>
  );
}
