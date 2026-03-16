"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ClipboardCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
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
  created_at: string;
  project: {
    name: string;
    project_code: string;
  };
  _reviewCount?: number;
}

export default function ReviewsPage() {
  const { data: session } = useSession();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "reviewed" | "all">("pending");

  useEffect(() => {
    async function load() {
      // Fetch submissions that need review (status: submitted, under_review)
      const res = await fetch("/api/submissions?forReview=true");
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data.submissions ?? []);
      }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = submissions.filter((s) => {
    if (filter === "pending") {
      return ["submitted", "under_review"].includes(s.status);
    }
    if (filter === "reviewed") {
      return ["approved", "changes_requested", "rejected"].includes(s.status);
    }
    return true;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
      <div>
        <h1>ARB Reviews</h1>
        <p className="text-muted-foreground mt-1">
          Review design submissions and provide row-level feedback
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-border">
        {[
          { key: "pending" as const, label: "Pending Review" },
          { key: "reviewed" as const, label: "Reviewed" },
          { key: "all" as const, label: "All" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              filter === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-6 w-6" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title={filter === "pending" ? "No pending reviews" : "No submissions found"}
          description={
            filter === "pending"
              ? "All design submissions have been reviewed"
              : "No matching submissions"
          }
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{sub.project?.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {sub.project?.project_code}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">v{sub.version}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        sub.status === "approved"
                          ? "success"
                          : sub.status === "submitted" || sub.status === "under_review"
                            ? "warning"
                            : sub.status === "rejected" || sub.status === "changes_requested"
                              ? "destructive"
                              : "secondary"
                      }
                    >
                      {sub.status === "submitted" && (
                        <Clock className="h-3 w-3 mr-0.5" />
                      )}
                      {sub.status === "under_review" && (
                        <AlertTriangle className="h-3 w-3 mr-0.5" />
                      )}
                      {sub.status === "approved" && (
                        <CheckCircle2 className="h-3 w-3 mr-0.5" />
                      )}
                      {sub.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(sub.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Link href={`/reviews/${sub.id}`}>
                      <Button variant="ghost" size="sm">
                        <ExternalLink className="h-3.5 w-3.5" />
                        Review
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
