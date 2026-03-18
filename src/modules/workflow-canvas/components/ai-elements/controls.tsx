"use client";

import type { ComponentProps } from "react";

import { cn } from "@/modules/workflow-canvas/lib/utils";
import { Controls as ControlsPrimitive } from "@xyflow/react";

export type ControlsProps = ComponentProps<typeof ControlsPrimitive>;

export const Controls = ({ className, ...props }: ControlsProps) => (
  <ControlsPrimitive
    className={cn(
      "gap-1 overflow-hidden rounded-2xl border border-white/45 bg-white/35 p-1.5 shadow-[0_14px_34px_rgba(15,23,42,0.2)] backdrop-blur-xl",
      "[&>button]:rounded-xl [&>button]:border border-transparent! [&>button]:bg-white/45! [&>button]:text-slate-700 [&>button]:shadow-sm",
      "[&>button]:transition-all [&>button]:duration-200 [&>button]:hover:-translate-y-0.5 [&>button]:hover:scale-[1.08]",
      "[&>button]:hover:border-pink-300/80 [&>button]:hover:bg-pink-100/85 [&>button]:hover:text-pink-700 [&>button]:hover:shadow-[0_12px_20px_-14px_rgba(236,72,153,0.95)]",
      className
    )}
    {...props}
  />
);

