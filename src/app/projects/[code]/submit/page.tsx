"use client";

import { useState, useCallback } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Eye,
  Network,
} from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Textarea,
  Spinner,
  EmptyState,
} from "@/components/ui/shared";
import { FileUpload } from "@/components/ui/file-upload";
import { MermaidViewer } from "@/components/ui/mermaid-viewer";

type Step = "upload" | "preview" | "confirm" | "result";

interface ParsedData {
  metadata: Record<string, string>;
  rows: Array<Record<string, string>>;
  errors: string[];
  warnings: string[];
}

interface SubmitResult {
  submission: {
    id: string;
    version: number;
    status: string;
  };
  yamlUrl?: string;
  mermaidDiagram?: string;
  parseWarnings: string[];
}

export default function SubmitPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const router = useRouter();

  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [preview, setPreview] = useState<ParsedData | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 → 2: Upload and parse
  const handleFileSelect = useCallback((f: File) => {
    setFile(f);
    setError(null);
  }, []);

  async function handlePreview() {
    if (!file) return;
    setLoading(true);
    setError(null);

    try {
      // Client-side preview via a parse-only endpoint
      const formData = new FormData();
      formData.append("file", file);
      formData.append("previewOnly", "true");

      const res = await fetch("/api/submissions", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to parse template");
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (data.preview) {
        setPreview(data.preview);
        setStep("preview");
      } else {
        // Direct submission (no preview endpoint? fallback to result)
        setResult(data);
        setStep("result");
      }
    } catch {
      setError("Network error. Please try again.");
    }
    setLoading(false);
  }

  // Step 3: Confirm and submit
  async function handleSubmit() {
    if (!file) return;
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectCode", code);
      formData.append("notes", notes);

      const res = await fetch("/api/submissions", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Submission failed");
        setLoading(false);
        return;
      }

      const data = await res.json();
      setResult(data);
      setStep("result");
    } catch {
      setError("Network error. Please try again.");
    }
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      {/* Breadcrumb */}
      <Link
        href={`/projects/${code}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to {code}
      </Link>

      <h1>New Design Submission</h1>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {["upload", "preview", "confirm", "result"].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
            <span
              className={
                step === s
                  ? "font-medium text-primary"
                  : ["upload", "preview", "confirm", "result"].indexOf(step) > i
                    ? "text-foreground"
                    : "text-muted-foreground"
              }
            >
              {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
            </span>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Step 1: Upload */}
      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload IdaC Template
            </CardTitle>
            <CardDescription>
              Upload your completed IdaC Excel template. Need a blank template?{" "}
              <a
                href="/api/templates/download"
                className="text-primary hover:underline"
              >
                Download here
              </a>
              .
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FileUpload
              onFileSelect={handleFileSelect}
              onFileRemove={() => setFile(null)}
            />
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes (optional)</label>
              <Textarea
                placeholder="Any additional context for reviewers…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handlePreview}
                disabled={!file || loading}
              >
                {loading ? (
                  <>
                    <Spinner /> Parsing…
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4" /> Preview
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Preview */}
      {step === "preview" && preview && (
        <div className="space-y-6">
          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Template Metadata</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {Object.entries(preview.metadata).map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-muted-foreground">{key}</dt>
                    <dd className="font-medium">{value || "—"}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          {/* Warnings */}
          {preview.warnings.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 space-y-1">
              <p className="text-sm font-medium text-amber-800">
                {preview.warnings.length} warning(s)
              </p>
              {preview.warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-700">
                  • {w}
                </p>
              ))}
            </div>
          )}

          {/* Errors */}
          {preview.errors.length > 0 && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 space-y-1">
              <p className="text-sm font-medium text-red-800">
                {preview.errors.length} error(s) — must be fixed before submission
              </p>
              {preview.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-700">
                  • {e}
                </p>
              ))}
            </div>
          )}

          {/* Connection rows preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                System Connections ({preview.rows.length} rows)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto max-h-96">
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.rows.slice(0, 50).map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs text-muted-foreground">
                          {i + 1}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              row.sourceZone === "Internet"
                                ? "zone-internet"
                                : row.sourceZone === "DMZ"
                                  ? "zone-dmz"
                                  : "zone-intranet"
                            }`}
                          >
                            {row.sourceZone}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{row.sourceComponent}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              row.destinationZone === "Internet"
                                ? "zone-internet"
                                : row.destinationZone === "DMZ"
                                  ? "zone-dmz"
                                  : "zone-intranet"
                            }`}
                          >
                            {row.destinationZone}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{row.destinationComponent}</TableCell>
                        <TableCell className="font-mono text-xs">{row.port}</TableCell>
                        <TableCell className="text-xs">{row.protocol}</TableCell>
                        <TableCell className="text-xs">{row.direction}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {preview.rows.length > 50 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Showing first 50 of {preview.rows.length} rows
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep("upload")}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button
              onClick={() => setStep("confirm")}
              disabled={preview.errors.length > 0}
            >
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === "confirm" && (
        <Card>
          <CardHeader>
            <CardTitle>Confirm Submission</CardTitle>
            <CardDescription>
              This will convert your design to YAML, commit it to GitLab, generate
              a system diagram, and submit for ARB review.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md bg-muted p-4 text-sm space-y-2">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                <span>
                  {preview?.rows.length ?? 0} system connections will be recorded
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Network className="h-4 w-4 text-muted-foreground" />
                <span>System diagram will be auto-generated</span>
              </div>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("preview")}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? (
                  <>
                    <Spinner /> Submitting…
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" /> Submit
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Result */}
      {step === "result" && result && (
        <div className="space-y-6">
          <Card className="border-green-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-green-100 p-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Submission Created</h3>
                  <p className="text-sm text-muted-foreground">
                    Version {result.submission.version} — Status:{" "}
                    {result.submission.status}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {result.parseWarnings.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 space-y-1">
              <p className="text-sm font-medium text-amber-800">Parse Warnings</p>
              {result.parseWarnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-700">• {w}</p>
              ))}
            </div>
          )}

          {/* Mermaid diagram */}
          {result.mermaidDiagram && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Network className="h-4 w-4" />
                  System Diagram
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MermaidViewer source={result.mermaidDiagram} />
              </CardContent>
            </Card>
          )}

          <div className="flex gap-3">
            <Link href={`/projects/${code}`}>
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4" /> Back to Project
              </Button>
            </Link>
            <Link href={`/submissions/${result.submission.id}`}>
              <Button>View Submission Details</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
