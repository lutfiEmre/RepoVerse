"use client";

import { Braces, Boxes, FileCode2, FileText, GitBranch, X } from "lucide-react";

import type { GraphNode } from "@/utils/types";

interface SidebarProps {
  node: GraphNode | null;
  summary: string;
  summaryLoading: boolean;
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function TypeBadge({ type }: { type: GraphNode["type"] }) {
  const colors = {
    python: "border-amber-300/25 bg-amber-300/10 text-amber-200",
    javascript: "border-rose-300/25 bg-rose-300/10 text-rose-200",
    typescript: "border-cyanpulse/25 bg-cyanpulse/10 text-cyanpulse",
    tsx: "border-violetpulse/25 bg-violetpulse/10 text-violet-200",
    website: "border-cyanpulse/25 bg-cyanpulse/10 text-cyanpulse",
    page: "border-violetpulse/25 bg-violetpulse/10 text-violet-200",
    script: "border-amber-300/25 bg-amber-300/10 text-amber-200",
    stylesheet: "border-rose-300/25 bg-rose-300/10 text-rose-200",
    image: "border-pink-300/25 bg-pink-300/10 text-pink-200",
    external: "border-slate-300/25 bg-slate-300/10 text-slate-200",
    technology: "border-emerald-300/25 bg-emerald-300/10 text-emerald-200",
  };
  return <span className={`rounded-full border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.16em] ${colors[type]}`}>{type}</span>;
}

export function Sidebar({ node, summary, summaryLoading, onClose }: SidebarProps) {
  if (!node) return null;
  const hasSymbols = node.functions.length > 0 || node.classes.length > 0;
  const sizeLabel = node.size_bytes > 0 ? formatBytes(node.size_bytes) : "remote";

  return (
    <aside className="absolute right-4 top-4 z-10 flex max-h-[calc(100%-32px)] w-[min(390px,calc(100%-32px))] flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#101218]/80 shadow-2xl shadow-black/40 backdrop-blur-2xl lg:right-8 lg:top-8 lg:w-[390px]">
      <div className="border-b border-white/[0.08] bg-gradient-to-br from-cyanpulse/[0.09] via-transparent to-violetpulse/[0.08] p-5">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-cyanpulse">
              <FileCode2 size={19} />
            </div>
            <div className="min-w-0">
              <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.25em] text-white/35">Selected node</p>
              <h2 className="truncate text-lg font-semibold text-white" title={node.label}>{node.label}</h2>
            </div>
          </div>
          <button aria-label="Dosya panelini kapat" className="rounded-lg p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white" onClick={onClose} type="button"><X size={17} /></button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge type={node.type} />
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-white/50"><FileText size={12} /> {sizeLabel}</span>
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-white/50"><GitBranch size={12} /> {node.status ? `HTTP ${node.status}` : `${node.imports.length} imports`}</span>
        </div>
      </div>

      <div className="space-y-5 overflow-y-auto p-5">
        <section>
          <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-cyanpulse/70"><span className="h-px w-4 bg-cyanpulse/50" /> Architecture brief</div>
          {summaryLoading ? (
            <div className="space-y-2 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4"><div className="h-3 w-full animate-pulse rounded bg-white/10" /><div className="h-3 w-4/5 animate-pulse rounded bg-white/10" /></div>
          ) : (
            <p className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 text-sm leading-6 text-white/70">{summary}</p>
          )}
        </section>

        {hasSymbols ? <>
          <div className="grid grid-cols-2 gap-3">
            <Metric icon={<Braces size={14} />} label="Functions" value={node.functions.length} />
            <Metric icon={<Boxes size={14} />} label="Classes" value={node.classes.length} />
          </div>
          <SymbolList icon={<Braces size={14} />} items={node.functions} label="Functions" empty="No functions detected" />
          <SymbolList icon={<Boxes size={14} />} items={node.classes} label="Classes" empty="No classes detected" />
        </> : <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4"><p className="mb-2 font-mono text-[9px] uppercase tracking-[0.2em] text-white/35">Resource signal</p><p className="text-xs leading-5 text-white/45">{node.url || "Detected from public website signals."}</p></div>}
      </div>
    </aside>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3"><div className="mb-2 flex items-center gap-2 text-cyanpulse/70">{icon}<span className="font-mono text-[9px] uppercase tracking-widest text-white/35">{label}</span></div><p className="text-2xl font-light text-white">{value.toString().padStart(2, "0")}</p></div>;
}

function SymbolList({ icon, items, label, empty }: { icon: React.ReactNode; items: string[]; label: string; empty: string }) {
  return <section><div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">{icon}{label}</div><div className="space-y-1.5">{items.length ? items.map((item) => <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2 font-mono text-xs text-white/65" key={item}>{item}()</div>) : <p className="rounded-xl border border-dashed border-white/10 px-3 py-2 text-xs text-white/30">{empty}</p>}</div></section>;
}
