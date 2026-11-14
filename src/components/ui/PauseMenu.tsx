"use client";

import { audio } from "@/lib/audio/AudioManager";
import { useSettingsStore } from "@/stores/settingsStore";
import { ControlsList } from "./ControlsList";

/** Audio and effects preferences. Persisted in localStorage. */
export function SettingsControls() {
  const { muted, volume, reducedEffects, quality, setMuted, setVolume, setReducedEffects, setQuality } = useSettingsStore();
  return (
    <div className="grid gap-3 text-left text-xs">
      <label className="flex items-center justify-between gap-4">
        <span>Volume</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(volume * 100)}
          onChange={(e) => {
            setVolume(Number(e.target.value) / 100);
            audio.init();
            audio.play("ready");
          }}
          className="w-40 accent-[#39d353]"
          aria-valuetext={`${Math.round(volume * 100)} percent`}
        />
      </label>
      <label className="flex min-h-8 items-center justify-between gap-4">
        <span>Mute sound</span>
        <input type="checkbox" checked={muted} onChange={(e) => setMuted(e.target.checked)} className="h-5 w-5 accent-[#39d353]" />
      </label>
      <label className="flex min-h-8 items-center justify-between gap-4">
        <span>
          Reduced effects
          <span className="block text-[10px] text-muted">No camera shake, bloom or screen flash</span>
        </span>
        <input type="checkbox" checked={reducedEffects} onChange={(e) => setReducedEffects(e.target.checked)} className="h-5 w-5 accent-[#39d353]" />
      </label>
      <label className="flex min-h-8 items-center justify-between gap-4">
        <span>Graphics quality</span>
        <select
          value={quality}
          onChange={(e) => setQuality(e.target.value as "auto" | "high" | "low")}
          className="rounded border border-line bg-black/60 px-2 py-1 text-text"
        >
          <option value="auto">Auto</option>
          <option value="high">High</option>
          <option value="low">Low</option>
        </select>
      </label>
    </div>
  );
}

interface PauseMenuProps {
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

export function PauseMenu({ onResume, onRestart, onQuit }: PauseMenuProps) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/65 p-4">
      <div className="panel pop-in max-h-full w-full max-w-md overflow-y-auto p-6" role="dialog" aria-modal="true" aria-labelledby="pause-title">
        <h2 id="pause-title" className="display text-center text-xl font-black text-text">
          Paused
        </h2>
        <div className="mt-5 flex flex-col gap-3">
          <button type="button" className="btn btn-primary" onClick={onResume} autoFocus>
            Resume
          </button>
          <button type="button" className="btn" onClick={onRestart}>
            Restart run
          </button>
          <button type="button" className="btn" onClick={onQuit}>
            Quit to title
          </button>
        </div>
        <hr className="my-5 border-line" />
        <SettingsControls />
        <hr className="my-5 border-line" />
        <ControlsList compact />
      </div>
    </div>
  );
}
