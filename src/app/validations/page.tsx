"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  FileCheck2,
  Download,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
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
import { TriggerValidationDialog } from "@/components/validations/trigger-dialog";

interface Validation {
  id: string;
  submission_id: string;
  jira_ticket_key: string | null;
  status: string;
  summary: {
    total: number;
    approved: number;
    rejected: number;
    clarification: number;
  } | null;
  created_at: string;
  completed_at: string | null;
}

const STATUS_ICONS: Record<string, React.ElementType> = {
  completed: CheckCircle2,
  running: Clock,
  failed: XCircle,
};

function ValidationsContent() {
  const searchParams = useSearchParams();
  const submissionId = searchParams.get("submissionId");

  const [validations, setValidations] = useState<Validation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTrigger, setShowTrigger] = useState(!!submissionId);

  useEffect(() => {
    fetchValidations();
  }, []);

  async function fetchValidations() {
    setLoading(true);
    const url = submissionId
      ? `/api/validations?submissionId=${submissionId}`
      : "/api/validations";
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      setValidations(data.validations ?? []);
    }
    setLoading(false);
  }

  function handleValidationTriggered() {
    setShowTrigger(false);
    fetchValidations();
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1>Validation Results</h1>
          <p className="text-muted-foreground mt-1">
            Firewall request validations against approved designs
          </p>
        </div>
        <Button onClick={() => setShowTrigger(true)}>
          <Play className="h-4 w-4" />
          Run Validation
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-6 w-6" />
        </div>
      ) : validations.length === 0 ? (
        <EmptyState
          icon={FileCheck2}
          title="No validations yet"
          description="Run a validation to compare firewall requests against an approved design"
          action={
            <Button onClick={() => setShowTrigger(true)}>
              <Play className="h-4 w-4" />
              Run Validation
            </Button>
          }
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>JIRA Ticket</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Results</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {validations.map((v) => {
                const Icon = STATUS_ICONS[v.status] ?? Clock;
                return (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono text-sm">
                      {v.jira_ticket_key ?? "Manual"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          v.status === "completed"
                            ? "success"
                            : v.status === "failed"
                              ? "destructive"
                              : "secondary"
                        }
                        className="gap-1"
                      >
                        <Icon className="h-3 w-3" />
                        {v.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {v.summary ? (
                        <div className="flex items-center gap-3 text-xs">
                          <span className="flex items-center gap-0.5 text-green-700">
                            <CheckCircle2 className="h-3 w-3" />
                            {v.summary.approved}
                          </span>
                          <span className="flex items-center gap-0.5 text-amber-700">
                            <AlertTriangle className="h-3 w-3" />
                            {v.summary.clarification}
                          </span>
                          <span className="flex items-center gap-0.5 text-red-700">
                            <XCircle className="h-3 w-3" />
                            {v.summary.rejected}
                          </span>
                          <span className="text-muted-foreground">
                            / {v.summary.total}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(v.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Link href={`/validations/${v.id}`}>
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </Link>
                        {v.status === "completed" && (
                          <a href={`/api/validations/${v.id}/report`}>
                            <Button variant="ghost" size="sm">
                              <Download className="h-3 w-3" />
                            </Button>
                          </a>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {showTrigger && (
        <TriggerValidationDialog
          defaultSubmissionId={submissionId ?? undefined}
          onClose={() => setShowTrigger(false)}
          onTriggered={handleValidationTriggered}
        />
      )}
    </div>
  );
}

export default function ValidationsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-12"><Spinner /></div>}>
      <ValidationsContent />
    </Suspense>
  );
}
