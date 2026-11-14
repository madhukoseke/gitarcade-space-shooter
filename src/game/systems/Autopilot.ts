import type { GameEngine } from "../core/GameEngine";
import type { InputState } from "../types/GameTypes";

/**
 * Autopilot for the landing-page preview. Like RandomStrategy in
 * czl9707/gh-space-shooter (MIT) it favours nearby columns and shoots the
 * lowest enemy in the chosen column, then adds simple bullet avoidance.
 */
export function autopilotInput(g: GameEngine, out: InputState, state: { targetId: string; retarget: number }, dt: number): void {
  const p = g.player;
  state.retarget -= dt;
  let target = g.enemies.find((e) => e.active && e.id === state.targetId) ?? null;
  if (!target || state.retarget <= 0) {
    state.retarget = 0.9;
    let best = Infinity;
    target = null;
    for (const e of g.enemies) {
      if (!e.active || e.state === "SPAWNING") continue;
      const key = Math.abs(e.x - p.x) * 2 + e.y;
      if (key < best) {
        best = key;
        target = e;
      }
    }
    state.targetId = target?.id ?? "";
  }

  let moveX = 0;
  if (target) {
    const dx = target.x - p.x;
    moveX = Math.max(-1, Math.min(1, dx * 1.5));
  }
  // Step aside from bullets that are about to arrive.
  for (const b of g.bullets) {
    if (!b.active) continue;
    const dy = b.y - p.y;
    if (dy > 0 && dy < 3 && Math.abs(b.x - p.x) < 0.9) {
      moveX = b.x >= p.x ? -1 : 1;
      break;
    }
  }
  out.moveX = moveX;
  out.moveY = 0;
  out.fire = !!target && Math.abs(target.x - p.x) < 0.6;
  out.plasma = false;
  out.dash = false;
  out.special = p.energy >= 100;
}
