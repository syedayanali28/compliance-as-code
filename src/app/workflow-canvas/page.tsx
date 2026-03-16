import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import WorkflowCanvas from "@/modules/workflow-canvas/workflow-page";

const ALLOWED_ROLES = new Set(["admin", "architect", "project_team"]);

export default async function WorkflowCanvasPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const role = (session.user.role ?? "").toLowerCase();
  if (!ALLOWED_ROLES.has(role)) {
    redirect("/unauthorized");
  }

  return (
    <div className="h-[calc(100dvh-3.5rem)] min-h-0 overflow-hidden">
      <WorkflowCanvas />
    </div>
  );
}
