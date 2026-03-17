"use client";

import { useState } from "react";
import { X, AlertCircle } from "lucide-react";
import {
  Button,
  Input,
  Label,
  Textarea,
  Select,
} from "@/components/ui/shared";

interface CreateProjectDialogProps {
  onClose: () => void;
  onCreated: () => void;
}

export function CreateProjectDialog({
  onClose,
  onCreated,
}: CreateProjectDialogProps) {
  const [name, setName] = useState("");
  const [projectCode, setProjectCode] = useState("");
  const [description, setDescription] = useState("");
  const [environment, setEnvironment] = useState("production");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-generate project code from name
  function handleNameChange(value: string) {
    setName(value);
    if (!projectCode || projectCode === generateCode(name)) {
      setProjectCode(generateCode(value));
    }
  }

  function generateCode(input: string): string {
    return input
      .toUpperCase()
      .replace(/[^A-Z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 50);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          projectCode: projectCode.toUpperCase(),
          description: description || undefined,
          environment,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to create project");
        setLoading(false);
        return;
      }

      onCreated();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">New Project</h2>
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
            <Label htmlFor="name">Project Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Internet Banking Modernization"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="code">Project Code *</Label>
            <Input
              id="code"
              placeholder="e.g., IBK-MODERN"
              value={projectCode}
              onChange={(e) =>
                setProjectCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))
              }
              maxLength={50}
              required
            />
            <p className="text-xs text-muted-foreground">
              Uppercase letters, numbers, and hyphens only
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="env">Environment</Label>
            <Select
              id="env"
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
            >
              <option value="production">Production</option>
              <option value="staging">Staging</option>
              <option value="development">Development</option>
              <option value="dr">Disaster Recovery</option>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="desc">Description</Label>
            <Textarea
              id="desc"
              placeholder="Brief description of the project…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name || !projectCode}>
              {loading ? "Creating…" : "Create Project"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
