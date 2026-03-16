import type { Metadata } from "next";
import { WorkflowManager } from "@/components/workflow/workflow-manager";

export const metadata: Metadata = {
  title: "Workflow Manager | IdaC Compliance Platform",
  description:
    "HKMA user workflow builder for network topology and firewall policy submission.",
};

export default function WorkflowManagerPage() {
  return <WorkflowManager />;
}
