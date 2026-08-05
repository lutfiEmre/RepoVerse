"use client";

import { Activity, AlertCircle, Boxes, Camera, Globe2, LocateFixed, Network, Rotate3D } from "lucide-react";
import { useState } from "react";

import { Header, type ScanMode } from "@/components/Header";
import { RepoGraph } from "@/components/RepoGraph";
import { Sidebar } from "@/components/Sidebar";
import { scanRepository, scanWebsite, summarizeFile } from "@/utils/api";
import type { GraphData, GraphNode } from "@/utils/types";

export default function HomePage() {
  const [path, setPath] = useState("");
  const [scanMode, setScanMode] = useState<ScanMode>("repository");
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [summary, setSummary] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [error, setError] = useState("");
  const [cameraResetToken, setCameraResetToken] = useState(0);

  function handleModeChange(mode: ScanMode) {
    setScanMode(mode);
    setPath("");
    setError("");
  }

  async function handleScan() {
    if (!path.trim()) {
      setError(scanMode === "website" ? "Önce taranacak website URL’sini girin." : "Önce taranacak yerel repo yolunu girin.");
      return;
    }

    setIsScanning(true);
    setError("");
    setSelectedNode(null);
    setCameraResetToken((value) => value + 1);
    try {
      const result = scanMode === "website" ? await scanWebsite(path.trim()) : await scanRepository(path.trim());
      setGraphData(result);
      setPath(result.root);
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "Tarama sırasında beklenmeyen bir hata oluştu.");
    } finally {
      setIsScanning(false);
    }
  }

  async function handleSelect(node: GraphNode) {
    setSelectedNode(node);
    setSummary("");
    setSummaryLoading(true);
    if (graphData?.mode === "website") {
      setSummary(node.description || "Bu kaynak public website sinyallerinden tespit edildi.");
      setSummaryLoading(false);
      return;
    }
    try {
      const result = await summarizeFile(graphData?.root ?? path, node);
      setSummary(result);
    } catch (summaryError) {
      setSummary(summaryError instanceof Error ? summaryError.message : "Özet alınamadı.");
    } finally {
      setSummaryLoading(false);
    }
  }

  function resetCamera() {
    setSelectedNode(null);
    setCameraResetToken((value) => value + 1);
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#08090d] text-white">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_18%_8%,rgba(85,245,255,0.09),transparent_28%),radial-gradient(circle_at_82%_72%,rgba(155,123,255,0.08),transparent_30%)]" />
      <Header isScanning={isScanning} mode={scanMode} onModeChange={handleModeChange} onPathChange={setPath} onScan={handleScan} path={path} />

      <section className="relative h-[calc(100vh-88px)] min-h-[590px] overflow-hidden">
        <div className="absolute inset-0 z-0">
          {graphData ? <RepoGraph cameraResetToken={cameraResetToken} data={graphData} onSelect={handleSelect} selectedId={selectedNode?.id ?? null} /> : <EmptySpace mode={scanMode} />}
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-24 bg-gradient-to-b from-[#08090d] to-transparent" />
        {graphData && <GraphOverlay data={graphData} />}
        {graphData && <SourceIndex data={graphData} onSelect={handleSelect} />}
        {graphData?.mode === "website" && <TechnologyRail data={graphData} />}
        {graphData && !selectedNode && <CameraToolbar onReset={resetCamera} />}
        {graphData && <GraphLegend mode={graphData.mode} />}
        {error && <ErrorNotice message={error} onDismiss={() => setError("")} />}
        {graphData && <GraphStats data={graphData} />}
        {selectedNode && <Sidebar node={selectedNode} onClose={resetCamera} summary={summary} summaryLoading={summaryLoading} />}
        {!graphData && <div className="pointer-events-none absolute inset-x-0 bottom-10 z-[2] flex justify-center px-6"><div className="rounded-full border border-white/10 bg-black/25 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/35 backdrop-blur-md">{scanMode === "website" ? "Enter a public URL to map its web architecture" : "Enter a local path to materialize your codebase"}</div></div>}
      </section>
    </main>
  );
}

function EmptySpace({ mode }: { mode: ScanMode }) {
  return <div className="relative h-full w-full overflow-hidden bg-[radial-gradient(ellipse_at_center,rgba(20,54,68,0.25),transparent_48%)]"><div className="absolute left-1/2 top-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyanpulse/[0.08] shadow-[0_0_100px_rgba(85,245,255,0.06)]" /><div className="absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-violetpulse/[0.08]" /><div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" /><div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3 text-center"><div className="flex h-16 w-16 items-center justify-center rounded-full border border-cyanpulse/20 bg-cyanpulse/10 text-cyanpulse shadow-[0_0_55px_rgba(85,245,255,0.15)]">{mode === "website" ? <Globe2 size={26} /> : <Network size={26} />}</div><p className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/30">{mode === "website" ? "Web architecture intelligence" : "Repository intelligence"}</p></div></div>;
}

function GraphOverlay({ data }: { data: GraphData }) {
  const website = data.mode === "website";
  return <div className="pointer-events-none absolute left-7 top-7 z-[2] hidden max-w-[350px] md:block"><p className="mb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-cyanpulse/70">{website ? "Live web architecture map" : "Live repository map"}</p><h2 className="text-2xl font-semibold tracking-tight text-white/90">{website ? <>Web <span className="text-cyanpulse">architecture</span></> : <>Codebase <span className="text-cyanpulse">constellation</span></>}</h2><p className="mt-2 text-xs leading-5 text-white/35">{website ? `${data.meta?.pages ?? 0} pages · ${data.meta?.assets ?? 0} assets · ${data.meta?.technologies?.length ?? 0} detected technologies` : `${data.nodes.length} source files · ${data.edges.length} internal relationships`}</p></div>;
}

function TechnologyRail({ data }: { data: GraphData }) {
  const technologies = data.meta?.technologies ?? [];
  if (!technologies.length) return null;
  return <div className="pointer-events-none absolute left-[330px] top-8 z-[2] hidden max-w-[420px] flex-wrap gap-1.5 lg:flex">{technologies.slice(0, 8).map((technology) => <span className="rounded-full border border-emerald-300/15 bg-emerald-300/[0.06] px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider text-emerald-200/65" key={technology}>{technology}</span>)}</div>;
}

function SourceIndex({ data, onSelect }: { data: GraphData; onSelect: (node: GraphNode) => void }) {
  const website = data.mode === "website";
  const visibleNodes = data.nodes.filter((node) => node.type !== "technology").slice(0, 12);
  return <div className="pointer-events-auto absolute left-7 top-[128px] z-[2] hidden w-[252px] rounded-2xl border border-white/[0.09] bg-[#0b0d12]/65 p-3 shadow-2xl shadow-black/20 backdrop-blur-xl md:block"><div className="mb-2 flex items-center justify-between px-1"><span className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/40">{website ? "Site surface" : "Source index"}</span><span className="font-mono text-[9px] text-white/25">{visibleNodes.length.toString().padStart(2, "0")}</span></div><div className="max-h-[270px] space-y-1 overflow-y-auto pr-1">{visibleNodes.map((node) => <button className="group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/[0.08]" key={node.id} onClick={() => onSelect(node)} title={node.label} type="button"><span className={`h-1.5 w-1.5 shrink-0 rounded-full shadow-[0_0_7px_currentColor] ${indexColor(node.type)}`} /><span className="min-w-0 flex-1 truncate font-mono text-[10px] text-white/48 transition group-hover:text-white/85">{node.label}</span><span className="font-mono text-[9px] text-white/20">{website ? node.type : node.functions.length + node.classes.length}</span></button>)}</div></div>;
}

function indexColor(type: GraphNode["type"]): string {
  if (type === "python" || type === "script") return "bg-amber-300 text-amber-300";
  if (type === "typescript" || type === "website") return "bg-cyanpulse text-cyanpulse";
  if (type === "tsx" || type === "page") return "bg-violet-300 text-violet-300";
  if (type === "stylesheet") return "bg-rose-400 text-rose-400";
  return "bg-emerald-300 text-emerald-300";
}

function CameraToolbar({ onReset }: { onReset: () => void }) {
  return <div className="pointer-events-auto absolute right-7 top-[128px] z-[2] hidden items-center gap-3 rounded-2xl border border-white/[0.09] bg-[#0b0d12]/65 px-3 py-2.5 shadow-2xl shadow-black/20 backdrop-blur-xl md:flex"><div className="flex items-center gap-2 pr-2"><div className="flex h-7 w-7 items-center justify-center rounded-lg border border-cyanpulse/20 bg-cyanpulse/10 text-cyanpulse"><Camera size={14} /></div><div><p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/35">Camera director</p><p className="font-mono text-[10px] text-emerald-200/70">Orbit mode active</p></div></div><span className="h-6 w-px bg-white/10" /><div className="flex items-center gap-2 text-white/25"><Rotate3D size={13} /><span className="font-mono text-[9px] uppercase tracking-widest">Auto orbit</span></div><button aria-label="Kamerayı ana görünüme döndür" className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-2 font-mono text-[9px] uppercase tracking-widest text-white/60 transition hover:border-cyanpulse/30 hover:bg-cyanpulse/10 hover:text-cyanpulse" onClick={onReset} type="button"><LocateFixed size={12} /> Reset view</button></div>;
}

function GraphLegend({ mode }: { mode?: GraphData["mode"] }) {
  const items = mode === "website" ? [["bg-cyanpulse", "Website"], ["bg-violet-300", "Page"], ["bg-amber-300", "Script"], ["bg-emerald-300", "Tech"]] : [["bg-amber-300", "Python"], ["bg-cyanpulse", "TS"], ["bg-rose-400", "JS"]];
  return <div className="absolute bottom-7 left-7 z-[2] hidden items-center gap-4 rounded-2xl border border-white/10 bg-[#0b0d12]/65 px-4 py-3 backdrop-blur-xl md:flex">{items.map(([color, label]) => <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-white/45" key={label}><span className={`h-2 w-2 rounded-full ${color} shadow-[0_0_8px_currentColor]`} /> {label}</div>)}</div>;
}

function GraphStats({ data }: { data: GraphData }) {
  if (data.mode === "website") return <div className="absolute bottom-7 right-7 z-[2] hidden items-center gap-4 rounded-2xl border border-white/10 bg-[#0b0d12]/65 px-4 py-3 backdrop-blur-xl sm:flex"><Stat icon={<Globe2 size={13} />} label="Pages" value={data.meta?.pages ?? 0} /><span className="h-5 w-px bg-white/10" /><Stat icon={<Network size={13} />} label="Edges" value={data.edges.length} /><span className="h-5 w-px bg-white/10" /><Stat icon={<Activity size={13} />} label="Crawler" value="ON" /></div>;
  return <div className="absolute bottom-7 right-7 z-[2] hidden items-center gap-4 rounded-2xl border border-white/10 bg-[#0b0d12]/65 px-4 py-3 backdrop-blur-xl sm:flex"><Stat icon={<Boxes size={13} />} label="Nodes" value={data.nodes.length} /><span className="h-5 w-px bg-white/10" /><Stat icon={<Network size={13} />} label="Edges" value={data.edges.length} /><span className="h-5 w-px bg-white/10" /><Stat icon={<Activity size={13} />} label="AST live" value="ON" /></div>;
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return <div className="flex items-center gap-2"><span className="text-cyanpulse/70">{icon}</span><div><p className="font-mono text-[9px] uppercase tracking-widest text-white/30">{label}</p><p className="font-mono text-xs text-white/75">{value}</p></div></div>;
}

function ErrorNotice({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return <div className="absolute left-1/2 top-5 z-20 flex max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-3 rounded-xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-xs text-rose-100 shadow-xl backdrop-blur-xl"><AlertCircle size={15} className="shrink-0 text-rose-300" /><span>{message}</span><button className="ml-2 text-rose-200/50 hover:text-white" onClick={onDismiss} type="button">×</button></div>;
}
