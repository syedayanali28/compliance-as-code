"use client";

import { useEffect, useState, useCallback } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Send,
  Network,
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
  Textarea,
  Select,
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
  data_classification: string | null;
}

interface SubmissionForReview {
  id: string;
  version: number;
  status: string;
  notes: string | null;
  mermaid_source: string | null;
  created_at: string;
  project: {
    name: string;
    project_code: string;
  };
  design_rows: DesignRow[];
}

interface RowFeedbackDraft {
  designRowId: string;
  status: "approved" | "changes_requested" | "rejected";
  comment: string;
}

export default function ReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [submission, setSubmission] = useState<SubmissionForReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [overallComment, setOverallComment] = useState("");
  const [overallStatus, setOverallStatus] = useState<string>("approved");
  const [rowFeedback, setRowFeedback] = useState<Map<string, RowFeedbackDraft>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [showDiagram, setShowDiagram] = useState(false);

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

  const updateRowFeedback = useCallback(
    (rowId: string, updates: Partial<RowFeedbackDraft>) => {
      setRowFeedback((prev) => {
        const next = new Map(prev);
        const existing = next.get(rowId) ?? {
          designRowId: rowId,
          status: "approved" as const,
          comment: "",
        };
        next.set(rowId, { ...existing, ...updates });
        return next;
      });
    },
    []
  );

  async function handleSubmitReview() {
    setSubmitting(true);
    setError(null);

    try {
      const feedbackArray = Array.from(rowFeedback.values()).filter(
        (fb) => fb.comment || fb.status !== "approved"
      );

      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: id,
          status: overallStatus,
          overallComment,
          rowFeedback: feedbackArray,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to submit review");
        setSubmitting(false);
        return;
      }

      router.push("/reviews");
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  // Auto-derive overall status from row feedback
  const deriveOverallStatus = useCallback(() => {
    const feedbackValues = Array.from(rowFeedback.values());
    if (feedbackValues.length === 0) return;

    const hasRejected = feedbackValues.some((fb) => fb.status === "rejected");
    const hasChanges = feedbackValues.some(
      (fb) => fb.status === "changes_requested"
    );

    if (hasRejected) {
      setOverallStatus("rejected");
    } else if (hasChanges) {
      setOverallStatus("changes_requested");
    } else {
      setOverallStatus("approved");
    }
  }, [rowFeedback]);

  useEffect(() => {
    deriveOverallStatus();
  }, [deriveOverallStatus]);

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

  const isReviewable = ["submitted", "under_review"].includes(submission.status);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
      {/* Breadcrumb */}
      <Link
        href="/reviews"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Reviews
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1>
            Review: {submission.project.name} v{submission.version}
          </h1>
          <p className="text-muted-foreground mt-1">
            {submission.design_rows.length} connections to review
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDiagram(!showDiagram)}
        >
          <Network className="h-4 w-4" />
          {showDiagram ? "Hide" : "Show"} Diagram
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Diagram */}
      {showDiagram && submission.mermaid_source && (
        <Card>
          <CardContent className="pt-4">
            <MermaidViewer source={submission.mermaid_source} />
          </CardContent>
        </Card>
      )}

      {/* Row-by-row review table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connection Review</CardTitle>
          <CardDescription>
            Review each connection and provide feedback. Use the dropdowns to
            approve, request changes, or reject individual rows.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Port/Proto</TableHead>
                  <TableHead>Classification</TableHead>
                  {isReviewable && (
                    <>
                      <TableHead className="w-36">Verdict</TableHead>
                      <TableHead className="w-48">Comment</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {submission.design_rows
                  .sort((a, b) => a.row_number - b.row_number)
                  .map((row) => {
                    const fb = rowFeedback.get(row.id);
                    return (
                      <TableRow
                        key={row.id}
                        className={
                          fb?.status === "rejected"
                            ? "bg-red-50"
                            : fb?.status === "changes_requested"
                              ? "bg-amber-50"
                              : undefined
                        }
                      >
                        <TableCell className="text-xs text-muted-foreground">
                          {row.row_number}
                        </TableCell>
                        <TableCell>
                          <div className="text-xs">
                            <Badge variant="outline" className="text-[10px] mb-0.5">
                              {row.source_zone}
                            </Badge>
                            <p className="font-medium">{row.source_component}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs">
                            <Badge variant="outline" className="text-[10px] mb-0.5">
                              {row.destination_zone}
                            </Badge>
                            <p className="font-medium">{row.destination_component}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className="font-mono">{row.port}</span> / {row.protocol}
                          <br />
                          <span className="text-muted-foreground">{row.direction}</span>
                        </TableCell>
                        <TableCell className="text-xs">
                          {row.data_classification ?? "—"}
                        </TableCell>
                        {isReviewable && (
                          <>
                            <TableCell>
                              <Select
                                className="text-xs h-7"
                                value={fb?.status ?? "approved"}
                                onChange={(e) =>
                                  updateRowFeedback(row.id, {
                                    designRowId: row.id,
                                    status: e.target.value as RowFeedbackDraft["status"],
                                  })
                                }
                              >
                                <option value="approved">✓ Approve</option>
                                <option value="changes_requested">⚠ Changes</option>
                                <option value="rejected">✗ Reject</option>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <input
                                type="text"
                                className="w-full text-xs rounded border border-input px-2 py-1"
                                placeholder="Optional comment…"
                                value={fb?.comment ?? ""}
                                onChange={(e) =>
                                  updateRowFeedback(row.id, {
                                    designRowId: row.id,
                                    comment: e.target.value,
                                  })
                                }
                              />
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Submit review */}
      {isReviewable && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Submit Review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Overall Verdict</label>
                <Select
                  value={overallStatus}
                  onChange={(e) => setOverallStatus(e.target.value)}
                >
                  <option value="approved">Approved</option>
                  <option value="changes_requested">Changes Requested</option>
                  <option value="rejected">Rejected</option>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Overall Comment</label>
                <Textarea
                  placeholder="Summary comment for the design team…"
                  value={overallComment}
                  onChange={(e) => setOverallComment(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            {/* Summary */}
            <div className="flex items-center gap-4 rounded-md bg-muted p-3 text-sm">
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                {Array.from(rowFeedback.values()).filter(
                  (fb) => fb.status === "approved"
                ).length || submission.design_rows.length - rowFeedback.size}{" "}
                approved
              </div>
              <div className="flex items-center gap-1">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                {Array.from(rowFeedback.values()).filter(
                  (fb) => fb.status === "changes_requested"
                ).length}{" "}
                changes
              </div>
              <div className="flex items-center gap-1">
                <XCircle className="h-4 w-4 text-red-600" />
                {Array.from(rowFeedback.values()).filter(
                  (fb) => fb.status === "rejected"
                ).length}{" "}
                rejected
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSubmitReview} disabled={submitting}>
                {submitting ? (
                  <>
                    <Spinner /> Submitting…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" /> Submit Review
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
