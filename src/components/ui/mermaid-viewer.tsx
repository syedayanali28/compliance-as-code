"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface MermaidViewerProps {
  source: string;
  className?: string;
}

export function MermaidViewer({ source, className }: MermaidViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        setLoading(true);
        setError(null);

        // Dynamic import to keep mermaid out of the server bundle
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "default",
          securityLevel: "strict",
          flowchart: {
            useMaxWidth: true,
            htmlLabels: true,
            curve: "basis",
          },
        });

        const id = `mermaid-${Date.now()}`;
        const { svg: renderedSvg } = await mermaid.render(id, source);

        if (!cancelled) {
          setSvg(renderedSvg);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to render diagram"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (source.trim()) {
      render();
    } else {
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [source]);

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center p-8 text-muted-foreground", className)}>
        <svg className="h-5 w-5 animate-spin mr-2" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Rendering diagram…
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("rounded-md border border-destructive/30 bg-destructive/5 p-4", className)}>
        <p className="text-sm font-medium text-destructive">Diagram rendering error</p>
        <pre className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">{error}</pre>
        <details className="mt-3">
          <summary className="text-xs text-muted-foreground cursor-pointer">Show source</summary>
          <pre className="mt-2 text-xs bg-muted p-3 rounded-md overflow-auto max-h-48">
            {source}
          </pre>
        </details>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn("overflow-auto rounded-md border border-border bg-white p-4", className)}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
