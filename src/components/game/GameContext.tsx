"use client";

import { createContext, useContext } from "react";
import type { GameEngine } from "@/game/core/GameEngine";
import type { InputState } from "@/game/types/GameTypes";
import type { QualityPreset } from "@/stores/settingsStore";

/** Mutable camera rig shared between the camera and the intro sequence. */
export class CameraRig {
  zoom = 1;
  focusX = 0;
  focusY = 0;

  set(zoom: number, focusX: number, focusY: number): void {
    this.zoom = zoom;
    this.focusX = focusX;
    this.focusY = focusY;
  }

  reset(): void {
    this.set(1, 0, 0);
  }
}

export type SimulationMode = "run" | "effects" | "frozen";

export interface GameContextValue {
  engine: GameEngine;
  rig: CameraRig;
  quality: QualityPreset;
  reducedEffects: boolean;
  /** Input for the next simulation step. */
  getInput: (dt: number) => InputState;
  /** "run" steps the simulation, "effects" only animates particles, "frozen" does nothing. */
  mode: () => SimulationMode;
}

export const GameContext = createContext<GameContextValue | null>(null);

export function useGame(): GameContextValue {
  const value = useContext(GameContext);
  if (!value) throw new Error("useGame must be used inside <GameCanvas>");
  return value;
}
