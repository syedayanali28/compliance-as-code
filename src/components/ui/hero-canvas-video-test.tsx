"use client";

import { useEffect, useMemo, useState } from "react";
import { MousePointer2, Pause, Play, RotateCcw, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/shared";

type NodeTone = "rose" | "amber" | "emerald" | "cyan" | "violet";

interface DemoNode {
  id: string;
  label: string;
  tone: NodeTone;
  left: string;
  top: string;
}

interface DemoScene {
  id: string;
  label: string;
  action: string;
  nodeId: string;
  cursorX: number;
  cursorY: number;
  panX: number;
  panY: number;
  zoom: number;
}

const NODES: DemoNode[] = [
  { id: "internet", label: "Internet Zone", tone: "rose", left: "12%", top: "30%" },
  { id: "waf", label: "WAF / DMZ", tone: "amber", left: "37%", top: "30%" },
  { id: "core", label: "Core App", tone: "emerald", left: "62%", top: "22%" },
  { id: "api", label: "Audit API", tone: "cyan", left: "62%", top: "56%" },
  { id: "logs", label: "Compliance Logs", tone: "violet", left: "84%", top: "40%" },
];

const SCENES: DemoScene[] = [
  {
    id: "scene-intake",
    label: "Intake",
    action: "Cursor enters and selects internet ingress",
    nodeId: "internet",
    cursorX: 20,
    cursorY: 36,
    panX: -4,
    panY: -2,
    zoom: 1.08,
  },
  {
    id: "scene-link",
    label: "Drag Path",
    action: "Drag from DMZ toward core application",
    nodeId: "waf",
    cursorX: 44,
    cursorY: 34,
    panX: -8,
    panY: -5,
    zoom: 1.15,
  },
  {
    id: "scene-zoom-core",
    label: "Inspect",
    action: "Camera zooms in for policy details",
    nodeId: "core",
    cursorX: 69,
    cursorY: 30,
    panX: -18,
    panY: -10,
    zoom: 1.26,
  },
  {
    id: "scene-validate",
    label: "Validate",
    action: "Cursor checks audit flow and logs",
    nodeId: "logs",
    cursorX: 86,
    cursorY: 45,
    panX: -20,
    panY: -8,
    zoom: 1.22,
  },
];

const TONE_CLASS: Record<NodeTone, string> = {
  rose: "border-rose-300 bg-rose-100/80 text-rose-900",
  amber: "border-amber-300 bg-amber-100/80 text-amber-900",
  emerald: "border-emerald-300 bg-emerald-100/80 text-emerald-900",
  cyan: "border-cyan-300 bg-cyan-100/80 text-cyan-900",
  violet: "border-violet-300 bg-violet-100/80 text-violet-900",
};

function findSceneByNode(nodeId: string): DemoScene {
  return SCENES.find((scene) => scene.nodeId === nodeId) ?? SCENES[0];
}

export function HeroCanvasVideoTest() {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [manualNodeId, setManualNodeId] = useState<string | null>(null);

  useEffect(() => {
    if (!autoPlay || manualNodeId) {
      return;
    }

    const timer = window.setInterval(() => {
      setSceneIndex((prev) => (prev + 1) % SCENES.length);
    }, 2400);

    return () => window.clearInterval(timer);
  }, [autoPlay, manualNodeId]);

  const activeScene = useMemo(() => {
    if (manualNodeId) {
      return findSceneByNode(manualNodeId);
    }
    return SCENES[sceneIndex];
  }, [manualNodeId, sceneIndex]);

  return (
    <div className="rounded-[26px] border border-black/10 bg-white p-4 shadow-[0_20px_45px_rgba(15,23,42,0.1)] md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Hero Test Component</p>
          <h3 className="mt-1 text-lg font-bold text-slate-900 md:text-xl">Interactive camera + cursor walkthrough</h3>
          <p className="mt-1 text-sm text-slate-600">{activeScene.action}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setAutoPlay((prev) => !prev)}
            className="rounded-full border-slate-300 bg-white text-xs text-slate-800 hover:bg-slate-100"
          >
            {autoPlay ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {autoPlay ? "Pause" : "Play"}
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setManualNodeId(null);
              setAutoPlay(true);
              setSceneIndex(0);
            }}
            className="rounded-full border-slate-300 bg-white text-xs text-slate-800 hover:bg-slate-100"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
        <div className="relative h-[260px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 md:h-[320px]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(56,189,248,0.2),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(251,191,36,0.2),transparent_40%),linear-gradient(180deg,rgba(2,6,23,0.85),rgba(15,23,42,0.95))]" />

          <div
            className="absolute inset-[-16%] transition-transform duration-700 ease-out"
            style={{
              transform: `translate(${activeScene.panX}%, ${activeScene.panY}%) scale(${activeScene.zoom})`,
            }}
          >
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.18)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.18)_1px,transparent_1px)] bg-[size:30px_30px]" />

            <div className="absolute left-[18%] top-[36%] h-[2px] w-[16%] bg-slate-400/85" />
            <div className="absolute left-[44%] top-[36%] h-[2px] w-[16%] bg-slate-400/85" />
            <div className="absolute left-[44%] top-[62%] h-[2px] w-[16%] bg-slate-400/85" />
            <div className="absolute left-[71%] top-[48%] h-[2px] w-[13%] bg-slate-400/85" />

            {NODES.map((node) => {
              const isFocused = activeScene.nodeId === node.id;
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => {
                    setManualNodeId(node.id);
                    setAutoPlay(false);
                  }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-xl border px-3 py-2 text-xs font-semibold shadow-sm transition-all duration-200 hover:scale-[1.04] ${TONE_CLASS[node.tone]} ${
                    isFocused ? "ring-2 ring-sky-300 ring-offset-2 ring-offset-slate-950" : ""
                  }`}
                  style={{ left: node.left, top: node.top }}
                >
                  {node.label}
                </button>
              );
            })}
          </div>

          <div
            className="pointer-events-none absolute transition-all duration-700 ease-out"
            style={{ left: `${activeScene.cursorX}%`, top: `${activeScene.cursorY}%` }}
          >
            <div className="absolute -left-4 -top-4 h-10 w-10 rounded-full bg-sky-300/20 blur-sm" />
            <MousePointer2 className="relative h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-white drop-shadow-[0_0_10px_rgba(14,165,233,0.65)]" />
          </div>

          <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full border border-white/20 bg-slate-900/80 px-3 py-1.5 text-[11px] text-slate-200 backdrop-blur">
            <ZoomIn className="h-3.5 w-3.5" />
            Camera follows cursor and node interactions
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Shot List</p>
          <div className="mt-2 space-y-2">
            {SCENES.map((scene, index) => {
              const isActive = scene.id === activeScene.id;
              return (
                <button
                  key={scene.id}
                  type="button"
                  onClick={() => {
                    setManualNodeId(scene.nodeId);
                    setSceneIndex(index);
                    setAutoPlay(false);
                  }}
                  className={`w-full rounded-xl border px-3 py-2 text-left text-xs transition ${
                    isActive
                      ? "border-sky-300 bg-sky-50 text-sky-800"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <p className="font-semibold">{scene.label}</p>
                  <p className="mt-0.5 text-[11px] leading-4">{scene.action}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
