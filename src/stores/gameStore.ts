import { create } from "zustand";
import { canTransition, type GamePhase } from "@/game/core/GamePhase";
import type { ContributionProfile } from "@/game/types/ContributionTypes";
import type { GameResult, HudSnapshot } from "@/game/types/GameTypes";

export interface Banner {
  id: number;
  title: string;
  subtitle?: string;
  tone: "info" | "warn" | "good";
}

export interface LoadError {
  code: string;
  message: string;
}

interface GameStore {
  phase: GamePhase;
  profile: ContributionProfile | null;
  error: LoadError | null;
  hud: HudSnapshot | null;
  result: GameResult | null;
  banner: Banner | null;
  introStage: "briefing" | "running";
  /** Incremented on each player hit so the HUD can replay its damage cue. */
  damageTick: number;
  /** Explicit, validated transition. Returns false when it is not allowed. */
  setPhase: (to: GamePhase) => boolean;
  setProfile: (profile: ContributionProfile | null) => void;
  setError: (error: LoadError | null) => void;
  setHud: (hud: HudSnapshot) => void;
  setResult: (result: GameResult | null) => void;
  showBanner: (title: string, subtitle?: string, tone?: Banner["tone"]) => void;
  clearBanner: (id: number) => void;
  setIntroStage: (stage: "briefing" | "running") => void;
  markDamage: () => void;
  resetSession: () => void;
}

let bannerId = 0;

function hudEqual(a: HudSnapshot | null, b: HudSnapshot): boolean {
  if (!a) return false;
  for (const key of Object.keys(b) as (keyof HudSnapshot)[]) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

export const useGameStore = create<GameStore>((set, get) => ({
  phase: "IDLE",
  profile: null,
  error: null,
  hud: null,
  result: null,
  banner: null,
  introStage: "briefing",
  damageTick: 0,
  setPhase: (to) => {
    const from = get().phase;
    if (from === to) return true;
    if (!canTransition(from, to)) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[gitarcade] blocked phase transition ${from} -> ${to}`);
      }
      return false;
    }
    set({ phase: to });
    return true;
  },
  setProfile: (profile) => set({ profile }),
  setError: (error) => set({ error }),
  setHud: (hud) => {
    if (!hudEqual(get().hud, hud)) set({ hud });
  },
  setResult: (result) => set({ result }),
  showBanner: (title, subtitle, tone = "info") =>
    set({ banner: { id: ++bannerId, title, subtitle, tone } }),
  clearBanner: (id) => {
    if (get().banner?.id === id) set({ banner: null });
  },
  setIntroStage: (introStage) => set({ introStage }),
  markDamage: () => set((s) => ({ damageTick: s.damageTick + 1 })),
  resetSession: () =>
    set({
      phase: "IDLE",
      profile: null,
      error: null,
      hud: null,
      result: null,
      banner: null,
      introStage: "briefing",
      damageTick: 0,
    }),
}));
