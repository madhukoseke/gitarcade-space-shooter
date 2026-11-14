"use client";

import { useCallback, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { GameEngine } from "@/game/core/GameEngine";
import { generateWorld } from "@/game/generation/SectorGenerator";
import { autopilotInput } from "@/game/systems/Autopilot";
import { createInput } from "@/game/types/GameTypes";
import { createDemoProfile } from "@/lib/github/demo";
import { useMediaQuery } from "@/components/ui/useMediaQuery";
import type { SimulationMode } from "@/components/game/GameContext";

const GameCanvas = dynamic(() => import("@/components/game/GameCanvas"), { ssr: false });

/**
 * Live preview: the real engine and renderer running the simulated demo
 * calendar on autopilot. Frozen when the visitor prefers reduced motion.
 */
export function GamePreview() {
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const coarse = useMediaQuery("(pointer: coarse)");
  const engine = useMemo(() => {
    const arena = { halfW: 13, halfH: 8, portrait: false };
    const profile = createDemoProfile();
    const world = generateWorld(profile.username, profile.calendar.weeks, arena);
    return new GameEngine({ sectors: world.sectors, arena, seed: world.seed, attract: true, particleCap: 220 });
  }, []);
  const input = useMemo(() => createInput(), []);
  const pilot = useRef({ targetId: "", retarget: 0 });

  const getInput = useCallback(
    (dt: number) => {
      autopilotInput(engine, input, pilot.current, dt);
      return input;
    },
    [engine, input],
  );
  const mode = useCallback((): SimulationMode => (reduceMotion ? "frozen" : "run"), [reduceMotion]);

  return (
    <figure className="mx-auto w-full max-w-xl">
      <div className="relative aspect-video overflow-hidden rounded-xl border border-line bg-black/60 shadow-[0_0_60px_rgba(57,211,83,0.12)]">
        <GameCanvas
          engine={engine}
          getInput={getInput}
          mode={mode}
          quality={coarse ? "low" : "high"}
          reducedEffects={reduceMotion}
          label="Game preview: an autopilot ship fighting a fleet built from simulated contribution data"
        />
        <span className="pointer-events-none absolute left-3 top-3 rounded border border-amber/70 bg-black/60 px-2 py-0.5 text-[10px] font-bold tracking-widest text-amber">
          PREVIEW · SIMULATED DATA
        </span>
      </div>
      <figcaption className="mt-2 text-center text-[11px] text-muted">
        {reduceMotion ? "Preview paused because your system prefers reduced motion." : "Live preview running on autopilot."}
      </figcaption>
    </figure>
  );
}
