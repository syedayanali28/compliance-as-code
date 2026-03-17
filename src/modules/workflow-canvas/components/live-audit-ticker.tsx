"use client";

import { useEffect, useMemo, useState } from "react";

type AuditEventDetail = {
  designName?: string;
  nodeCount?: number;
  edgeCount?: number;
  at?: string;
};

const FALLBACK_MESSAGES = [
  "[14:02:10] DESIGN 'PROD_VNET' SAVED TO SUPABASE.",
  "[14:02:18] HKMA GRAPH SYNCHRONIZED WITH POLICY ENGINE.",
  "[14:02:25] NODE METADATA AUTOCOMPLETE READY.",
];

export function LiveAuditTicker() {
  const [messages, setMessages] = useState<string[]>(FALLBACK_MESSAGES);

  useEffect(() => {
    const onSave = (event: Event) => {
      const detail = (event as CustomEvent<AuditEventDetail>).detail;
      const at = detail?.at ? new Date(detail.at) : new Date();
      const time = at.toLocaleTimeString("en-GB", { hour12: false });
      const line = `[${time}] DESIGN '${detail?.designName ?? "PROD_VNET"}' SAVED TO SUPABASE (${detail?.nodeCount ?? 0} nodes, ${detail?.edgeCount ?? 0} edges).`;

      setMessages((current) => [line, ...current].slice(0, 6));
    };

    window.addEventListener("idac:canvas-saved", onSave as EventListener);
    return () => {
      window.removeEventListener("idac:canvas-saved", onSave as EventListener);
    };
  }, []);

  const rendered = useMemo(() => messages.slice(0, 3), [messages]);

  return (
    <div className="ticker-terminal fixed inset-x-0 bottom-0 z-30 hidden md:block">
      <div className="mx-auto flex max-w-[calc(100%-1.5rem)] flex-col gap-1 rounded-t-xl border border-border/70 bg-black/75 px-3 py-2">
        {rendered.map((message) => (
          <p key={message}>{message}</p>
        ))}
      </div>
    </div>
  );
}
