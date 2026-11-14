"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import type { GameEngine } from "@/game/core/GameEngine";
import type { ContributionWeek } from "@/game/types/ContributionTypes";
import type { InputState } from "@/game/types/GameTypes";
import type { QualityPreset } from "@/stores/settingsStore";
import { CameraRig, GameContext, type GameContextValue, type SimulationMode } from "./GameContext";
import { GameScene } from "./GameScene";

export interface GameCanvasProps {
  engine: GameEngine;
  getInput: (dt: number) => InputState;
  mode: () => SimulationMode;
  quality: QualityPreset;
  reducedEffects: boolean;
  /** When provided, the contribution-graph intro is rendered. */
  weeks?: ContributionWeek[];
  label?: string;
}

/** WebGL canvas. All HUD text lives in HTML overlays outside this component. */
export default function GameCanvas({ engine, getInput, mode, quality, reducedEffects, weeks, label }: GameCanvasProps) {
  const rig = useMemo(() => new CameraRig(), []);
  const value = useMemo<GameContextValue>(
    () => ({ engine, rig, quality, reducedEffects, getInput, mode }),
    [engine, rig, quality, reducedEffects, getInput, mode],
  );

  return (
    <Canvas
      aria-label={label ?? "Game view"}
      role="img"
      dpr={quality === "high" ? [1, 2] : [1, 1.5]}
      camera={{ fov: 50, near: 0.1, far: 400, position: [0, 0, 26] }}
      gl={{ antialias: quality === "high", powerPreference: "high-performance" }}
      style={{ touchAction: "none" }}
    >
      <GameContext.Provider value={value}>
        <GameScene weeks={weeks} />
      </GameContext.Provider>
    </Canvas>
  );
}
