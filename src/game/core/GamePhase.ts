export type GamePhase =
  | "IDLE"
  | "LOADING_GITHUB"
  | "GENERATING_WORLD"
  | "INTRO"
  | "READY"
  | "PLAYING"
  | "PAUSED"
  | "GAME_OVER"
  | "VICTORY";

/** Explicit transition table. IDLE is reachable from anywhere (navigating away). */
const TRANSITIONS: Record<GamePhase, GamePhase[]> = {
  IDLE: ["LOADING_GITHUB"],
  LOADING_GITHUB: ["GENERATING_WORLD", "IDLE"],
  GENERATING_WORLD: ["INTRO", "IDLE"],
  INTRO: ["READY", "IDLE"],
  READY: ["PLAYING", "IDLE"],
  PLAYING: ["PAUSED", "GAME_OVER", "VICTORY", "IDLE"],
  PAUSED: ["PLAYING", "READY", "IDLE"],
  GAME_OVER: ["READY", "IDLE"],
  VICTORY: ["READY", "IDLE"],
};

export function canTransition(from: GamePhase, to: GamePhase): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Returns the next phase, or the current one when the transition is not allowed. */
export function nextPhase(from: GamePhase, to: GamePhase): GamePhase {
  return canTransition(from, to) ? to : from;
}
