import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import WorkflowCanvas from "@/modules/workflow-canvas/workflow-page";

const ALLOWED_ROLES = new Set(["admin", "architect", "project_team"]);

interface WorkflowCanvasDesignPageProps {
  params: Promise<{ id: string }>;
}

export default async function WorkflowCanvasDesignPage({
  params,
}: WorkflowCanvasDesignPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const role = (session.user.role ?? "").toLowerCase();
  if (!ALLOWED_ROLES.has(role)) {
    redirect("/unauthorized");
  }

  const { id } = await params;

  return (
    <div className="h-[calc(100dvh-3.5rem)] min-h-0 overflow-hidden">
      <WorkflowCanvas initialDesignId={id} />
    </div>
  );
}
