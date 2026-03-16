"use client";

import { useState } from "react";
import { X, AlertCircle, Upload } from "lucide-react";
import {
  Button,
  Input,
  Label,
  Spinner,
} from "@/components/ui/shared";
import { FileUpload } from "@/components/ui/file-upload";

interface TriggerValidationDialogProps {
  defaultSubmissionId?: string;
  onClose: () => void;
  onTriggered: () => void;
}

export function TriggerValidationDialog({
  defaultSubmissionId,
  onClose,
  onTriggered,
}: TriggerValidationDialogProps) {
  const [submissionId, setSubmissionId] = useState(defaultSubmissionId ?? "");
  const [jiraTicketKey, setJiraTicketKey] = useState("");
  const [firewallFile, setFirewallFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!submissionId) return;

    setLoading(true);
    setError(null);

    try {
      let firewallFileBase64: string | undefined;
      if (firewallFile) {
        const buffer = await firewallFile.arrayBuffer();
        firewallFileBase64 = btoa(
          String.fromCharCode(...new Uint8Array(buffer))
        );
      }

      const res = await fetch("/api/validations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId,
          jiraTicketKey: jiraTicketKey || undefined,
          firewallFile: firewallFileBase64,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to trigger validation");
        setLoading(false);
        return;
      }

      onTriggered();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Run Validation</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive mb-4">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subId">Approved Submission ID *</Label>
            <Input
              id="subId"
              placeholder="UUID of the approved design submission"
              value={submissionId}
              onChange={(e) => setSubmissionId(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="jiraKey">JIRA Ticket Key</Label>
            <Input
              id="jiraKey"
              placeholder="e.g., ITISUFR-1523"
              value={jiraTicketKey}
              onChange={(e) => setJiraTicketKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Optional. If provided, firewall rules will be fetched from JIRA.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Firewall Rules Excel (optional)</Label>
            <FileUpload
              onFileSelect={setFirewallFile}
              onFileRemove={() => setFirewallFile(null)}
            />
            <p className="text-xs text-muted-foreground">
              Upload a firewall request Excel file for manual validation.
              If a JIRA ticket is provided, the attachment will be fetched automatically.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !submissionId}>
              {loading ? (
                <>
                  <Spinner /> Running…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" /> Run Validation
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
