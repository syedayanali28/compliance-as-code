"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  Upload,
  GitBranch,
  FileCheck2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Spinner,
  EmptyState,
} from "@/components/ui/shared";

interface Submission {
  id: string;
  version: number;
  status: string;
  submitted_by: string | null;
  created_at: string;
  yaml_url: string | null;
  diagram_url: string | null;
}

interface ProjectDetail {
  id: string;
  name: string;
  project_code: string;
  description: string | null;
  environment: string;
  created_at: string;
  design_submissions: Submission[];
}

const STATUS_CONFIG: Record<string, { icon: React.ElementType; variant: "success" | "destructive" | "warning" | "secondary" | "default" }> = {
  draft: { icon: Clock, variant: "secondary" },
  submitted: { icon: Clock, variant: "default" },
  under_review: { icon: AlertTriangle, variant: "warning" },
  approved: { icon: CheckCircle2, variant: "success" },
  changes_requested: { icon: XCircle, variant: "destructive" },
  rejected: { icon: XCircle, variant: "destructive" },
};

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const { data: session } = useSession();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userRole = session?.user?.role;
  const canSubmit = userRole === "architect" || userRole === "admin";

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/projects/${code}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data.project);
      } else {
        setError("Project not found");
      }
      setLoading(false);
    }
    load();
  }, [code]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <EmptyState
          title="Project not found"
          description={`No project with code "${code}" exists.`}
          action={
            <Link href="/projects">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4" /> Back to Projects
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  const submissions = project.design_submissions ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
      {/* Breadcrumb */}
      <Link
        href="/projects"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Projects
      </Link>

      {/* Project info */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1>{project.name}</h1>
            <Badge variant="outline" className="font-mono">
              {project.project_code}
            </Badge>
          </div>
          {project.description && (
            <p className="text-muted-foreground mt-1">{project.description}</p>
          )}
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            <span>Environment: {project.environment}</span>
            <span>
              Created: {new Date(project.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
        {canSubmit && (
          <Link href={`/projects/${code}/submit`}>
            <Button>
              <Upload className="h-4 w-4" />
              New Submission
            </Button>
          </Link>
        )}
      </div>

      {/* Submissions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Design Submissions</CardTitle>
          <CardDescription>
            All IdaC design versions for this project
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submissions.length === 0 ? (
            <EmptyState
              icon={Upload}
              title="No submissions yet"
              description="Upload your first IdaC template to create a design submission"
              action={
                canSubmit ? (
                  <Link href={`/projects/${code}/submit`}>
                    <Button>
                      <Upload className="h-4 w-4" /> Upload Template
                    </Button>
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Git</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions
                  .sort((a, b) => b.version - a.version)
                  .map((sub) => {
                    const cfg = STATUS_CONFIG[sub.status] ?? STATUS_CONFIG.draft;
                    const StatusIcon = cfg.icon;
                    return (
                      <TableRow key={sub.id}>
                        <TableCell>
                          <span className="font-mono text-sm font-medium">
                            v{sub.version}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={cfg.variant} className="gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {sub.status.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(sub.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {sub.yaml_url ? (
                            <a
                              href={sub.yaml_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <GitBranch className="h-3 w-3" />
                              GitLab
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Link href={`/submissions/${sub.id}`}>
                              <Button variant="ghost" size="sm">
                                View
                              </Button>
                            </Link>
                            {sub.status === "approved" && (
                              <Link href={`/validations?submissionId=${sub.id}`}>
                                <Button variant="ghost" size="sm">
                                  <FileCheck2 className="h-3 w-3" />
                                  Validate
                                </Button>
                              </Link>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
