"use client";

import { useCallback, useState } from "react";
import { Upload, FileSpreadsheet, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  accept?: string;
  maxSizeMB?: number;
  onFileSelect: (file: File) => void;
  onFileRemove?: () => void;
  className?: string;
}

export function FileUpload({
  accept = ".xlsx,.xls",
  maxSizeMB = 10,
  onFileSelect,
  onFileRemove,
  className,
}: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const validateFile = useCallback(
    (f: File): string | null => {
      const ext = f.name.split(".").pop()?.toLowerCase();
      if (!["xlsx", "xls"].includes(ext ?? "")) {
        return "Only .xlsx and .xls files are accepted";
      }
      if (f.size > maxSizeMB * 1024 * 1024) {
        return `File size must be less than ${maxSizeMB}MB`;
      }
      return null;
    },
    [maxSizeMB]
  );

  const handleFile = useCallback(
    (f: File) => {
      const validationError = validateFile(f);
      if (validationError) {
        setError(validationError);
        return;
      }
      setError(null);
      setFile(f);
      onFileSelect(f);
    },
    [validateFile, onFileSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) handleFile(droppedFile);
    },
    [handleFile]
  );

  const handleRemove = useCallback(() => {
    setFile(null);
    setError(null);
    onFileRemove?.();
  }, [onFileRemove]);

  if (file) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border border-border bg-card p-4",
          className
        )}
      >
        <FileSpreadsheet className="h-8 w-8 text-green-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{file.name}</p>
          <p className="text-xs text-muted-foreground">
            {(file.size / 1024).toFixed(1)} KB
          </p>
        </div>
        <button
          onClick={handleRemove}
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div
        role="button"
        tabIndex={0}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onClick={() => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = accept;
          input.onchange = (e) => {
            const target = e.target as HTMLInputElement;
            const selected = target.files?.[0];
            if (selected) handleFile(selected);
          };
          input.click();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            (e.target as HTMLElement).click();
          }
        }}
        className={cn(
          "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer",
          dragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-accent/50"
        )}
      >
        <Upload className="h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-sm font-medium">
          Drop your Excel file here, or click to browse
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          .xlsx or .xls files up to {maxSizeMB}MB
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
