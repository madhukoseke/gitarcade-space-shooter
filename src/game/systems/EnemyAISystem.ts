import { CONFIG } from "../core/GameConfig";
import type { GameEngine } from "../core/GameEngine";
import type { Enemy } from "../types/GameTypes";
import { fireEnemyWeapon } from "./ShootingSystem";

/** Number of live formation mates directly in front of (below) an enemy. */
function blockersBelow(g: GameEngine, e: Enemy): number {
  let n = 0;
  for (const o of g.enemies) {
    if (o.active && o !== e && !o.minion && o.col === e.col && o.row > e.row) n++;
  }
  return n;
}

function moveHome(g: GameEngine, e: Enemy, dt: number): boolean {
  const tx = e.homeX + g.sway;
  const ty = e.homeY;
  const dx = tx - e.x;
  const dy = ty - e.y;
  const d = Math.hypot(dx, dy);
  const step = CONFIG.formSpeed * dt;
  if (d <= step) {
    e.x = tx;
    e.y = ty;
    return true;
  }
  e.x += (dx / d) * step;
  e.y += (dy / d) * step;
  return false;
}

function updateDive(g: GameEngine, e: Enemy, dt: number): void {
  const spec = CONFIG.enemies[e.type];
  const p = g.player;
  e.timer += dt;
  if (e.timer < 0.35) {
    // Wind-up: a short upward pull telegraphs the dive.
    e.y += 1.6 * dt;
    return;
  }
  e.vy += (-spec.diveSpeed - e.vy) * Math.min(1, 4 * dt);
  if (e.y > p.y + 1.5) {
    const target = Math.max(-6, Math.min(6, (p.x - e.x) * 2.2));
    e.vx += (target - e.vx) * Math.min(1, 3 * dt);
  }
  e.x += e.vx * dt;
  e.y += e.vy * dt;

  const shotTimes = e.type === "elite" ? [0.7, 1.3] : [0.8];
  if (e.diveShots < shotTimes.length && e.timer >= shotTimes[e.diveShots] && e.y > p.y + 2) {
    e.diveShots += 1;
    if (g.activeBullets < g.difficulty.maxEnemyBullets) fireEnemyWeapon(g, e);
  }

  if (e.y < -g.arena.halfH - 1.5) {
    e.y = g.arena.halfH + 1.5;
    e.x = e.homeX + g.sway;
    e.vx = 0;
    e.vy = 0;
    e.state = "RETURNING";
  }
}

/**
 * Chooses which idle enemy breaks formation next. The three orderings are
 * adapted from the ship strategies of czl9707/gh-space-shooter (MIT):
 * column-by-column, row-by-row zig-zag, and distance-weighted random.
 */
export function pickAttacker(g: GameEngine): Enemy | null {
  const pattern = g.attackPattern;
  let best: Enemy | null = null;
  let bestKey = Infinity;
  let totalWeight = 0;
  const p = g.player;
  for (const e of g.enemies) {
    if (!e.active || e.state !== "IDLE") continue;
    if (!e.minion && !CONFIG.enemies[e.type].canDive) continue;
    if (pattern === "random") {
      const dist = Math.abs(e.x - p.x);
      const weight = dist < 1.5 ? 10 : dist < 6 ? 100 : 1;
      totalWeight += weight;
      if (g.rng() * totalWeight < weight) best = e;
      continue;
    }
    const key =
      pattern === "column"
        ? e.col * 10 - e.row
        : -e.row * 10 + (e.row % 2 === 0 ? e.col : -e.col);
    if (key < bestKey) {
      bestKey = key;
      best = e;
    }
  }
  return best;
}

export function updateEnemies(g: GameEngine, dt: number): void {
  const swayScale = g.arena.portrait ? 0.5 : 1;
  g.sway = Math.sin(g.time * CONFIG.swayRate) * CONFIG.swayAmplitude * swayScale;
  let attackers = 0;

  for (const e of g.enemies) {
    if (!e.active) continue;
    if (e.hitFlash > 0) e.hitFlash -= dt;
    switch (e.state) {
      case "SPAWNING":
        e.timer -= dt;
        if (e.timer <= 0) e.state = "FORMING";
        break;
      case "FORMING":
      case "RETURNING":
        if (moveHome(g, e, dt)) e.state = "IDLE";
        break;
      case "IDLE": {
        e.x = e.homeX + g.sway;
        e.y = e.homeY;
        e.fireCd -= dt;
        if (e.fireCd <= 0) {
          const spec = CONFIG.enemies[e.type];
          e.fireCd = (spec.fireInterval / g.difficulty.fireRateMul) * (0.7 + g.rng() * 0.6);
          if (
            g.player.alive &&
            g.activeBullets < g.difficulty.maxEnemyBullets &&
            (e.minion || blockersBelow(g, e) <= 1)
          ) {
            fireEnemyWeapon(g, e);
            g.activeBullets += 1;
          }
        }
        break;
      }
      case "ATTACKING":
        attackers++;
        updateDive(g, e, dt);
        break;
      case "DESTROYED":
        break;
    }
  }

  // Attack director: a bounded number of enemies may leave formation at once.
  g.attackTimer -= dt;
  if (g.attackTimer <= 0 && g.player.alive) {
    g.attackTimer = g.difficulty.attackInterval * (0.8 + g.rng() * 0.4);
    if (attackers < g.difficulty.maxAttackers) {
      const e = pickAttacker(g);
      if (e) {
        e.state = "ATTACKING";
        e.timer = 0;
        e.vx = 0;
        e.vy = 0;
        e.diveShots = 0;
      }
    }
  }
}
