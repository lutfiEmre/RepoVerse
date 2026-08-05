"use client";

import { FolderSearch, Globe2, Orbit, Radar, ScanLine } from "lucide-react";

export type ScanMode = "repository" | "website";

interface HeaderProps {
  path: string;
  isScanning: boolean;
  onPathChange: (path: string) => void;
  onScan: () => void;
  mode: ScanMode;
  onModeChange: (mode: ScanMode) => void;
}

export function Header({ path, isScanning, onPathChange, onScan, mode, onModeChange }: HeaderProps) {
  return (
    <header className="relative z-20 flex min-h-[88px] flex-wrap items-center justify-between gap-4 border-b border-white/[0.07] bg-[#08090d]/80 px-6 py-4 backdrop-blur-xl lg:flex-nowrap lg:px-10 lg:py-0">
      <div className="flex min-w-fit items-center gap-3">
        <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-cyanpulse/40 bg-cyanpulse/10 text-cyanpulse shadow-neon">
          <Orbit size={21} strokeWidth={1.8} />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-cyanpulse shadow-[0_0_10px_#55f5ff]" />
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.34em] text-cyanpulse/70">Local intelligence layer</p>
          <h1 className="text-xl font-semibold tracking-tight text-white">Repo<span className="text-cyanpulse">Verse</span></h1>
        </div>
      </div>

      <div className="order-3 flex w-full flex-1 items-center justify-center gap-3 lg:order-none lg:w-auto">
        <form className="flex w-full max-w-3xl items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] p-1.5 shadow-2xl shadow-black/20" onSubmit={(event) => { event.preventDefault(); onScan(); }}>
          <div className="hidden items-center gap-1 rounded-xl border border-white/[0.08] bg-black/20 p-1 sm:flex">
            <button className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 font-mono text-[9px] uppercase tracking-wider transition ${mode === "repository" ? "bg-cyanpulse/15 text-cyanpulse" : "text-white/35 hover:text-white/70"}`} onClick={() => onModeChange("repository")} type="button"><FolderSearch size={13} /> Repo</button>
            <button className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 font-mono text-[9px] uppercase tracking-wider transition ${mode === "website" ? "bg-violetpulse/15 text-violet-200" : "text-white/35 hover:text-white/70"}`} onClick={() => onModeChange("website")} type="button"><Globe2 size={13} /> Web</button>
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-white/35 sm:hidden">{mode === "website" ? <Globe2 size={17} /> : <FolderSearch size={17} />}</div>
          <input
            aria-label={mode === "website" ? "Website URL" : "Yerel repo yolu"}
            className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-white/25"
            onChange={(event) => onPathChange(event.target.value)}
            placeholder={mode === "website" ? "https://example.com" : "/Users/you/projects/my-repo"}
            type={mode === "website" ? "url" : "text"}
            spellCheck={false}
            value={path}
          />
          <button className="flex items-center gap-2 rounded-xl bg-cyanpulse px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-[#061014] transition hover:bg-white disabled:cursor-wait disabled:opacity-60" disabled={isScanning} type="submit">
            <ScanLine size={15} />
            {isScanning ? "Taranıyor" : "Taramayı başlat"}
          </button>
        </form>
      </div>

      <div className="hidden min-w-fit items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/[0.06] px-3 py-2 sm:flex">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300 shadow-[0_0_8px_#86efac]" />
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-200/75">Local graph online</span>
        <Radar size={14} className="text-emerald-200/60" />
      </div>
    </header>
  );
}
