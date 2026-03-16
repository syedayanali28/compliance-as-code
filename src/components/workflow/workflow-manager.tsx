"use client";

import "@xyflow/react/dist/style.css";
import {
  addEdge,
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import {
  Database,
  Globe,
  Network,
  Plus,
  Save,
  Server,
  Shield,
  SquareStack,
  Waypoints,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Select,
} from "@/components/ui/shared";
import {
  canNodeBeSource,
  isValidWorkflowConnection,
  toWorkflowTopology,
  WORKFLOW_NODE_CATALOG,
  type WorkflowNodeData,
} from "@/lib/workflow/topology";

interface ProjectOption {
  id: string;
  name: string;
  project_code: string;
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  environment: SquareStack,
  "zone-internet": Globe,
  "zone-dmz": Shield,
  "zone-intranet": Network,
  "control-firewall": Waypoints,
  "control-proxy": Waypoints,
  "resource-app": Server,
  "resource-db": Database,
};

const initialNodes: Node[] = [
  {
    id: "env-1",
    type: "default",
    position: { x: 60, y: 220 },
    data: {
      label: "Environment",
      category: "environment",
      componentType: "environment",
    } satisfies WorkflowNodeData,
  },
];

export function WorkflowManager() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectId, setProjectId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    policyViolations: number;
    submissionId: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProjects = async () => {
      const response = await fetch("/api/projects");
      const json = await response.json();
      if (response.ok && Array.isArray(json.projects)) {
        setProjects(json.projects);
        if (json.projects.length > 0) {
          setProjectId(json.projects[0].id);
        }
      }
    };

    void loadProjects();
  }, []);

  const onConnect = (connection: Connection) => {
    const source = nodes.find((node) => node.id === connection.source);
    const target = nodes.find((node) => node.id === connection.target);

    if (!(source && target)) {
      return;
    }

    if (!isValidWorkflowConnection(source, target)) {
      setError("Invalid connection: use Environment -> Zone -> Control -> Resource flow.");
      return;
    }

    setError(null);
    setEdges((eds) => addEdge({ ...connection, animated: true }, eds));
  };

  const addNode = (catalogId: string) => {
    const def = WORKFLOW_NODE_CATALOG.find((node) => node.id === catalogId);
    if (!def) {
      return;
    }

    const newNode: Node = {
      id: crypto.randomUUID(),
      type: "default",
      position: {
        x: 160 + Math.random() * 520,
        y: 120 + Math.random() * 360,
      },
      data: {
        ...def.data,
        label: def.data.label,
      } satisfies WorkflowNodeData,
    };

    setNodes((prev) => [...prev, newNode]);
  };

  const submitTopology = async () => {
    if (!projectId) {
      setError("Select a project before submitting.");
      return;
    }

    setError(null);
    setResult(null);
    setIsSubmitting(true);

    try {
      const topology = toWorkflowTopology(nodes, edges);
      const response = await fetch("/api/workflow/topology", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, topology }),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error ?? "Failed to submit topology");
      }

      setResult({
        policyViolations: json.summary?.policyViolations ?? 0,
        submissionId: json.submissionId,
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Failed to submit topology"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const nodesWithStyle = useMemo(
    () =>
      nodes.map((node) => {
        const data = node.data as WorkflowNodeData;

        return {
          ...node,
          data: {
            ...node.data,
            label: (
              <div className="rounded-md border border-border bg-card px-3 py-2 text-xs">
                <p className="font-semibold">{data.label}</p>
                <p className="text-muted-foreground">{data.category}</p>
              </div>
            ),
          },
          sourcePosition: "right" as const,
          targetPosition: "left" as const,
          draggable: true,
          deletable: true,
          connectable: true,
        };
      }),
    [nodes]
  );

  return (
    <div className="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-[300px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Workflow Manager</CardTitle>
          <CardDescription>
            HKMA user-facing builder. Topology is submitted to compliance backend APIs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Project</p>
            <Select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.project_code} - {project.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Add Node</p>
            <div className="grid gap-2">
              {WORKFLOW_NODE_CATALOG.map((item) => {
                const Icon = ICONS[item.id] ?? Plus;
                return (
                  <Button
                    className="justify-start"
                    key={item.id}
                    onClick={() => addNode(item.id)}
                    size="sm"
                    variant="outline"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </Button>
                );
              })}
            </div>
          </div>

          <Button className="w-full" disabled={isSubmitting} onClick={submitTopology}>
            <Save className="h-4 w-4" />
            {isSubmitting ? "Submitting..." : "Submit Topology"}
          </Button>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {result && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <p className="font-medium">Submission Created</p>
              <p className="text-muted-foreground">ID: {result.submissionId}</p>
              <Badge className="mt-2" variant={result.policyViolations ? "warning" : "success"}>
                Policy violations: {result.policyViolations}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="h-[calc(100vh-8rem)]">
        <CardContent className="h-full p-0">
          <ReactFlow
            edges={edges}
            fitView
            isValidConnection={(connection) => {
              const source = nodes.find((node) => node.id === connection.source);
              const target = nodes.find((node) => node.id === connection.target);

              if (!(source && target)) {
                return false;
              }

              const sourceData = source.data as WorkflowNodeData;
              if (!canNodeBeSource(sourceData)) {
                return false;
              }

              return isValidWorkflowConnection(source, target);
            }}
            nodes={nodesWithStyle}
            onConnect={onConnect}
            onEdgesChange={onEdgesChange}
            onNodesChange={onNodesChange}
          >
            <Background />
            <MiniMap />
            <Controls />
          </ReactFlow>
        </CardContent>
      </Card>
    </div>
  );
}
