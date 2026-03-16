"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
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

interface ValidationResult {
  id: string;
  firewall_rule_index: number;
  verdict: string;
  confidence: number;
  matched_design_row_id: string | null;
  reason: string;
  policy_violations: string[];
}

interface ValidationDetail {
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
  validation_results: ValidationResult[];
}

const VERDICT_CONFIG: Record<
  string,
  {
    icon: React.ElementType;
    variant: "success" | "destructive" | "warning";
    bg: string;
  }
> = {
  approved: {
    icon: CheckCircle2,
    variant: "success",
    bg: "bg-green-50",
  },
  rejected: {
    icon: XCircle,
    variant: "destructive",
    bg: "bg-red-50",
  },
  clarification_needed: {
    icon: AlertTriangle,
    variant: "warning",
    bg: "bg-amber-50",
  },
};

export default function ValidationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [validation, setValidation] = useState<ValidationDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/validations/${id}`);
      if (res.ok) {
        const data = await res.json();
        setValidation(data.validation);
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

  if (!validation) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <EmptyState title="Validation not found" />
      </div>
    );
  }

  const results = validation.validation_results ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
      {/* Breadcrumb */}
      <Link
        href="/validations"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Validations
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1>
            Validation {validation.jira_ticket_key ?? "Manual"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {new Date(validation.created_at).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {validation.status === "completed" && (
            <a href={`/api/validations/${id}/report`}>
              <Button>
                <Download className="h-4 w-4" />
                Download Report
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* Summary cards */}
      {validation.summary && (
        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold">{validation.summary.total}</p>
              <p className="text-xs text-muted-foreground">Total Rules</p>
            </CardContent>
          </Card>
          <Card className="border-green-200">
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-green-700">
                {validation.summary.approved}
              </p>
              <p className="text-xs text-muted-foreground">Approved</p>
            </CardContent>
          </Card>
          <Card className="border-amber-200">
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-amber-700">
                {validation.summary.clarification}
              </p>
              <p className="text-xs text-muted-foreground">Clarification</p>
            </CardContent>
          </Card>
          <Card className="border-red-200">
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-red-700">
                {validation.summary.rejected}
              </p>
              <p className="text-xs text-muted-foreground">Rejected</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rule-by-Rule Results</CardTitle>
          <CardDescription>
            Each firewall rule validated against the approved design
          </CardDescription>
        </CardHeader>
        <CardContent>
          {results.length === 0 ? (
            <EmptyState title="No results" />
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Verdict</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Policy Violations</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results
                    .sort((a, b) => a.firewall_rule_index - b.firewall_rule_index)
                    .map((r) => {
                      const vcfg =
                        VERDICT_CONFIG[r.verdict] ?? VERDICT_CONFIG.clarification_needed;
                      const VIcon = vcfg.icon;
                      return (
                        <TableRow key={r.id} className={vcfg.bg}>
                          <TableCell className="text-xs text-muted-foreground">
                            {r.firewall_rule_index + 1}
                          </TableCell>
                          <TableCell>
                            <Badge variant={vcfg.variant} className="gap-1">
                              <VIcon className="h-3 w-3" />
                              {r.verdict.replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    r.confidence >= 70
                                      ? "bg-green-500"
                                      : r.confidence >= 40
                                        ? "bg-amber-500"
                                        : "bg-red-500"
                                  }`}
                                  style={{ width: `${r.confidence}%` }}
                                />
                              </div>
                              <span className="text-xs font-mono">
                                {r.confidence}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs max-w-xs">
                            {r.reason}
                          </TableCell>
                          <TableCell>
                            {r.policy_violations.length > 0 ? (
                              <div className="space-y-0.5">
                                {r.policy_violations.map((pv, i) => (
                                  <Badge
                                    key={i}
                                    variant="destructive"
                                    className="text-[10px] mr-1"
                                  >
                                    {pv}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                None
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
