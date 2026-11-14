import { create } from "zustand";
import { persist } from "zustand/middleware";

export type QualitySetting = "auto" | "high" | "low";

interface SettingsStore {
  muted: boolean;
  volume: number;
  reducedEffects: boolean;
  quality: QualitySetting;
  setMuted: (muted: boolean) => void;
  setVolume: (volume: number) => void;
  setReducedEffects: (reduced: boolean) => void;
  setQuality: (quality: QualitySetting) => void;
}

/** Player preferences only. Never holds tokens or any GitHub data. */
export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      muted: false,
      volume: 0.6,
      reducedEffects: false,
      quality: "auto",
      setMuted: (muted) => set({ muted }),
      setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
      setReducedEffects: (reducedEffects) => set({ reducedEffects }),
      setQuality: (quality) => set({ quality }),
    }),
    { name: "gitarcade-settings", version: 1 },
  ),
);

export type QualityPreset = "high" | "low";

/** Picks a rendering preset; weaker or touch-first devices get the low preset. */
export function resolveQuality(setting: QualitySetting): QualityPreset {
  if (setting !== "auto") return setting;
  if (typeof window === "undefined") return "high";
  const nav = navigator as Navigator & { deviceMemory?: number };
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const lowMemory = typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4;
  const fewCores = typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 4;
  return coarse || lowMemory || fewCores ? "low" : "high";
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}
