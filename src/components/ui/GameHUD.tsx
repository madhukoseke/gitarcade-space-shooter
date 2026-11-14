"use client";

import { memo, useEffect } from "react";
import type { ContributionProfile } from "@/game/types/ContributionTypes";
import { formatScore } from "@/lib/share/resultCard";
import { useGameStore } from "@/stores/gameStore";

const pad2 = (n: number) => String(n).padStart(2, "0");

function Meter({ label, value, max, color, emptyNote }: { label: string; value: number; max: number; color: string; emptyNote?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 text-[10px] tracking-widest text-muted">{label}</span>
      <div
        className="h-2.5 w-24 overflow-hidden rounded-sm border border-line bg-black/50 sm:w-36"
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div className="h-full transition-[width] duration-100" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="w-16 text-[11px] tabular-nums text-text">{value <= 0 && emptyNote ? emptyNote : Math.round(value)}</span>
    </div>
  );
}

const LEVEL_FILL = ["#1b2330", "#0e4429", "#006d32", "#26a641", "#39d353"];

/** Whole-calendar minimap with the current sector outlined. */
const Minimap = memo(function Minimap({ profile, sectorIndex, weeksPerSector }: { profile: ContributionProfile; sectorIndex: number; weeksPerSector: number }) {
  const weeks = profile.calendar.weeks;
  const cell = 4;
  const gap = 1;
  const step = cell + gap;
  const start = sectorIndex * weeksPerSector;
  const span = Math.min(weeksPerSector, Math.max(0, weeks.length - start));
  return (
    <svg
      width={weeks.length * step}
      height={7 * step}
      className="hidden opacity-80 md:block"
      role="img"
      aria-label={`Contribution calendar, sector ${sectorIndex + 1} highlighted`}
    >
      {weeks.map((week, w) =>
        week.days.map((day) => {
          const d = new Date(`${day.date}T00:00:00Z`).getUTCDay();
          return <rect key={day.date} x={w * step} y={d * step} width={cell} height={cell} fill={LEVEL_FILL[day.level]} />;
        }),
      )}
      {span > 0 ? (
        <rect x={start * step - 1} y={-0.5} width={span * step + 1} height={7 * step} fill="none" stroke="#56e0ff" strokeWidth={1.2} />
      ) : null}
    </svg>
  );
});

function BannerView() {
  const banner = useGameStore((s) => s.banner);
  const clearBanner = useGameStore((s) => s.clearBanner);
  useEffect(() => {
    if (!banner) return;
    const id = window.setTimeout(() => clearBanner(banner.id), 2000);
    return () => window.clearTimeout(id);
  }, [banner, clearBanner]);
  if (!banner) return null;
  const tone = banner.tone === "warn" ? "text-danger" : banner.tone === "good" ? "text-neon" : "text-text";
  const mark = banner.tone === "warn" ? "⚠ " : banner.tone === "good" ? "✓ " : "";
  return (
    <div key={banner.id} className="pop-in absolute inset-x-0 top-[30%] text-center" role="status" aria-live="polite">
      <p className={`display hud-text text-2xl font-black sm:text-4xl ${tone}`}>
        {mark}
        {banner.title}
      </p>
      {banner.subtitle ? <p className="hud-text mt-2 text-xs tracking-widest text-muted sm:text-sm">{banner.subtitle}</p> : null}
    </div>
  );
}

interface HudProps {
  profile: ContributionProfile;
  weeksPerSector: number;
  reducedEffects: boolean;
  onPause: () => void;
}

/** HTML overlay HUD. Updated a few times per second from the engine snapshot. */
export function GameHUD({ profile, weeksPerSector, reducedEffects, onPause }: HudProps) {
  const hud = useGameStore((s) => s.hud);
  const damageTick = useGameStore((s) => s.damageTick);
  if (!hud) return null;
  const stormReady = hud.energy >= 100;
  const weapon = hud.rapid > 0 && hud.double > 0
    ? `RAPID + DOUBLE ${Math.max(hud.rapid, hud.double)}s`
    : hud.rapid > 0
      ? `RAPID FIRE ${hud.rapid}s`
      : hud.double > 0
        ? `DOUBLE LASER ${hud.double}s`
        : "LASER READY";

  return (
    <div className="safe-pad pointer-events-none absolute inset-0 z-10 flex flex-col justify-between text-xs">
      {damageTick > 0 && !reducedEffects ? (
        <div
          key={damageTick}
          className="damage-flash absolute inset-0"
          style={{ boxShadow: "inset 0 0 120px 30px rgba(255,70,110,0.75)" }}
          aria-hidden
        />
      ) : null}

      <div className="hud-text">
        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
          <div className="min-w-0">
            <p className="truncate font-bold text-cyan">@{profile.username}</p>
            {profile.simulated ? <p className="text-[10px] font-bold tracking-widest text-amber">SIMULATED DATA</p> : null}
          </div>
          <div className="flex flex-col items-center gap-1">
            <p className="display whitespace-nowrap text-xs font-bold text-text sm:text-sm">
              {hud.bossActive ? "BOSS" : `SECTOR ${pad2(hud.sectorIndex + 1)}/${pad2(hud.sectorCount)}`}
            </p>
            {hud.sectorSynthetic && !hud.bossActive ? (
              <p className="text-[10px] tracking-widest text-amber">NO ACTIVITY · GENERATED PATROL</p>
            ) : null}
            {!hud.bossActive ? <Minimap profile={profile} sectorIndex={hud.sectorIndex} weeksPerSector={weeksPerSector} /> : null}
          </div>
          <div className="flex items-start justify-end gap-3">
            <p className="display whitespace-nowrap text-xs font-bold text-text sm:text-sm" aria-label={`Score ${hud.score}`}>
              <span className="mr-2 hidden text-[10px] text-muted sm:inline">SCORE</span>
              <span className="tabular-nums">{formatScore(hud.score).padStart(7, "0")}</span>
            </p>
            <button type="button" className="btn pointer-events-auto hidden min-h-9 px-3 py-1 pointer-coarse:inline-flex" onClick={onPause} aria-label="Pause game">
              II
            </button>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <p aria-label={`Lives: ${hud.lives}`}>
              <span className="mr-2 text-[10px] tracking-widest text-muted">LIVES</span>
              <span className="text-danger" aria-hidden>
                {"♥ ".repeat(Math.max(0, hud.lives))}
              </span>
              <span className="tabular-nums text-text">×{hud.lives}</span>
            </p>
            <Meter label="HULL" value={hud.health} max={hud.maxHealth} color="#39d353" />
            <Meter label="SHIELD" value={hud.shield} max={hud.maxShield} color="#56e0ff" emptyNote="DOWN" />
          </div>
          <p className={`display text-sm font-bold ${hud.multiplier > 1 ? "text-amber" : "text-muted"}`}>
            COMBO ×{hud.multiplier}
            {hud.combo > 0 ? <span className="ml-2 text-[10px] font-normal text-muted">{hud.combo} kills</span> : null}
          </p>
        </div>

        {hud.bossActive ? (
          <div className="mx-auto mt-3 w-full max-w-xl">
            <div className="mb-1 flex justify-between text-[10px] tracking-widest">
              <span className="display font-bold text-danger">MERGE CONFLICT</span>
              <span className="text-muted">
                PHASE {hud.bossPhase}/3 · {hud.bossHp}%
              </span>
            </div>
            <div
              className="h-3 overflow-hidden rounded-sm border border-danger/60 bg-black/60"
              role="progressbar"
              aria-label="Boss health"
              aria-valuenow={hud.bossHp}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full bg-danger transition-[width] duration-150" style={{ width: `${hud.bossHp}%` }} />
            </div>
          </div>
        ) : null}
      </div>

      <BannerView />

      <div className="hud-text flex items-end justify-between gap-3 pointer-coarse:hidden">
        <div className="flex flex-col gap-1">
          <p className="font-bold text-cyan">{weapon}</p>
          <p className={hud.plasmaReady ? "text-text" : "text-muted"}>
            <kbd className="kbd mr-1">Q</kbd>PLASMA {hud.plasmaReady ? "READY" : "CHARGING"}
          </p>
          <p className={hud.dashReady ? "text-text" : "text-muted"}>
            <kbd className="kbd mr-1">SHIFT</kbd>DASH {hud.dashReady ? "READY" : "COOLING"}
          </p>
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className={`display text-xs font-bold ${stormReady ? "pulse-soft text-neon" : "text-muted"}`}>
            <kbd className="kbd mr-1">E</kbd>CODE STORM {stormReady ? "READY" : `${hud.energy}%`}
          </p>
          <div className="h-2 w-44 overflow-hidden rounded-sm border border-line bg-black/50" role="progressbar" aria-label="Code Storm energy" aria-valuenow={hud.energy} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-neon transition-[width] duration-150" style={{ width: `${hud.energy}%` }} />
          </div>
        </div>
        <button type="button" className="btn pointer-events-auto min-h-9 px-3 py-1" onClick={onPause}>
          <kbd className="kbd">ESC</kbd> Pause
        </button>
      </div>
    </div>
  );
}
