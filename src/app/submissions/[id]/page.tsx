"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  GitBranch,
  Network,
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
import { MermaidViewer } from "@/components/ui/mermaid-viewer";

interface DesignRow {
  id: string;
  row_number: number;
  source_zone: string;
  source_component: string;
  destination_zone: string;
  destination_component: string;
  port: string;
  protocol: string;
  direction: string;
  action: string;
  service_name: string | null;
  description: string | null;
}

interface RowFeedback {
  id: string;
  design_row_id: string;
  status: string;
  comment: string;
}

interface Review {
  id: string;
  reviewer_id: string;
  reviewer_team: string | null;
  status: string;
  overall_comment: string | null;
  reviewed_at: string;
  arb_row_feedback: RowFeedback[];
}

interface SubmissionDetail {
  id: string;
  version: number;
  status: string;
  notes: string | null;
  yaml_url: string | null;
  diagram_url: string | null;
  mermaid_source: string | null;
  created_at: string;
  project: {
    name: string;
    project_code: string;
  };
  design_rows: DesignRow[];
  arb_reviews: Review[];
}

const STATUS_CONFIG: Record<string, { icon: React.ElementType; variant: "success" | "destructive" | "warning" | "secondary" | "default" }> = {
  draft: { icon: Clock, variant: "secondary" },
  submitted: { icon: Clock, variant: "default" },
  under_review: { icon: AlertTriangle, variant: "warning" },
  approved: { icon: CheckCircle2, variant: "success" },
  changes_requested: { icon: XCircle, variant: "destructive" },
  rejected: { icon: XCircle, variant: "destructive" },
};

export default function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"connections" | "diagram" | "reviews">("connections");

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/submissions/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSubmission(data.submission);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <EmptyState title="Submission not found" />
      </div>
    );
  }

  const cfg = STATUS_CONFIG[submission.status] ?? STATUS_CONFIG.draft;
  const StatusIcon = cfg.icon;

  // Build row feedback map from all reviews
  const feedbackMap = new Map<string, RowFeedback[]>();
  for (const review of submission.arb_reviews) {
    for (const fb of review.arb_row_feedback) {
      const existing = feedbackMap.get(fb.design_row_id) ?? [];
      existing.push(fb);
      feedbackMap.set(fb.design_row_id, existing);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
      {/* Breadcrumb */}
      <Link
        href={`/projects/${submission.project.project_code}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {submission.project.project_code}
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1>v{submission.version}</h1>
            <Badge variant={cfg.variant} className="gap-1">
              <StatusIcon className="h-3 w-3" />
              {submission.status.replace(/_/g, " ")}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            {submission.project.name} •{" "}
            {new Date(submission.created_at).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {submission.yaml_url && (
            <a href={submission.yaml_url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <GitBranch className="h-3.5 w-3.5" />
                View in GitLab
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* Notes */}
      {submission.notes && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">{submission.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {[
          { key: "connections" as const, label: `Connections (${submission.design_rows.length})` },
          { key: "diagram" as const, label: "Diagram" },
          { key: "reviews" as const, label: `Reviews (${submission.arb_reviews.length})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Connections tab */}
      {activeTab === "connections" && (
        <Card>
          <CardContent className="pt-4">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Source Zone</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Dest Zone</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Port</TableHead>
                    <TableHead>Protocol</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Feedback</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submission.design_rows
                    .sort((a, b) => a.row_number - b.row_number)
                    .map((row) => {
                      const fb = feedbackMap.get(row.id);
                      return (
                        <TableRow key={row.id}>
                          <TableCell className="text-xs text-muted-foreground">
                            {row.row_number}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {row.source_zone}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">{row.source_component}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {row.destination_zone}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">{row.destination_component}</TableCell>
                          <TableCell className="font-mono text-xs">{row.port}</TableCell>
                          <TableCell className="text-xs">{row.protocol}</TableCell>
                          <TableCell className="text-xs">{row.direction}</TableCell>
                          <TableCell className="text-xs">{row.action}</TableCell>
                          <TableCell>
                            {fb ? (
                              <div className="space-y-1">
                                {fb.map((f) => (
                                  <div key={f.id} className="text-xs">
                                    <Badge
                                      variant={
                                        f.status === "approved"
                                          ? "success"
                                          : f.status === "rejected"
                                            ? "destructive"
                                            : "warning"
                                      }
                                      className="text-[10px]"
                                    >
                                      {f.status}
                                    </Badge>
                                    {f.comment && (
                                      <p className="text-muted-foreground mt-0.5">{f.comment}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Diagram tab */}
      {activeTab === "diagram" && (
        <Card>
          <CardContent className="pt-4">
            {submission.mermaid_source ? (
              <MermaidViewer source={submission.mermaid_source} />
            ) : (
              <EmptyState
                icon={Network}
                title="No diagram available"
                description="The system diagram was not generated for this submission"
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Reviews tab */}
      {activeTab === "reviews" && (
        <div className="space-y-4">
          {submission.arb_reviews.length === 0 ? (
            <EmptyState
              title="No reviews yet"
              description="This submission is awaiting ARB review"
            />
          ) : (
            submission.arb_reviews.map((review) => (
              <Card key={review.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">
                        {review.reviewer_team ?? "Reviewer"}
                      </CardTitle>
                      <CardDescription>
                        {new Date(review.reviewed_at).toLocaleString()}
                      </CardDescription>
                    </div>
                    <Badge
                      variant={
                        review.status === "approved"
                          ? "success"
                          : review.status === "rejected"
                            ? "destructive"
                            : "warning"
                      }
                    >
                      {review.status}
                    </Badge>
                  </div>
                </CardHeader>
                {review.overall_comment && (
                  <CardContent>
                    <p className="text-sm">{review.overall_comment}</p>
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
