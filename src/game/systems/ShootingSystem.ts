import { CONFIG } from "../core/GameConfig";
import type { GameEngine } from "../core/GameEngine";
import type { Enemy, InputState } from "../types/GameTypes";
import { damageBoss, damageEnemy } from "./DamageSystem";

/** Weapon emitter offsets relative to the ship origin (must match PlayerShip). */
export const EMITTERS = {
  nose: { x: 0, y: 0.95 },
  wing: { x: 0.52, y: 0.3 },
};

export function updatePlayerWeapons(g: GameEngine, input: InputState, dt: number): void {
  const p = g.player;
  p.fireCd = Math.max(0, p.fireCd - dt);
  p.plasmaCd = Math.max(0, p.plasmaCd - dt);
  if (!p.alive) return;
  const laser = CONFIG.weapons.laser;
  const plasma = CONFIG.weapons.plasma;

  if (input.fire && p.fireCd <= 0) {
    p.fireCd = p.rapidTime > 0 ? laser.rapidCooldown : laser.cooldown;
    if (p.doubleTime > 0) {
      g.spawnShot("laser", p.x - EMITTERS.wing.x, p.y + EMITTERS.wing.y, 0, laser.speed, laser.damage, laser.radius, 0);
      g.spawnShot("laser", p.x + EMITTERS.wing.x, p.y + EMITTERS.wing.y, 0, laser.speed, laser.damage, laser.radius, 0);
      g.stats.shotsFired += 2;
    } else {
      g.spawnShot("laser", p.x + EMITTERS.nose.x, p.y + EMITTERS.nose.y, 0, laser.speed, laser.damage, laser.radius, 0);
      g.stats.shotsFired += 1;
    }
    g.emit({ type: "laser", x: p.x, y: p.y });
  }

  if (input.plasma && p.plasmaCd <= 0) {
    p.plasmaCd = plasma.cooldown;
    g.spawnShot("plasma", p.x, p.y + EMITTERS.nose.y, 0, plasma.speed, plasma.damage, plasma.radius, plasma.aoe);
    g.stats.shotsFired += 1;
    g.emit({ type: "plasma", x: p.x, y: p.y });
  }

  if (input.special && !g.prevSpecial && p.energy >= CONFIG.weapons.storm.energyMax) codeStorm(g);
}

/** Code Storm: damages every enemy near the player and clears nearby bullets. */
export function codeStorm(g: GameEngine): void {
  const p = g.player;
  const s = CONFIG.weapons.storm;
  p.energy = 0;
  g.storm.active = true;
  g.storm.x = p.x;
  g.storm.y = p.y;
  g.storm.t = 0;
  for (const e of g.enemies) {
    if (!e.active || e.state === "SPAWNING") continue;
    if (Math.hypot(e.x - p.x, e.y - p.y) <= s.radius + e.radius) damageEnemy(g, e, s.damage, e.x, e.y);
  }
  const boss = g.boss;
  if (boss.active && Math.hypot(boss.x - p.x, boss.y - p.y) <= s.radius + CONFIG.boss.radius) {
    damageBoss(g, s.bossDamage, boss.x, boss.y - 1);
  }
  for (const b of g.bullets) {
    if (b.active && Math.hypot(b.x - p.x, b.y - p.y) <= s.radius) {
      b.active = false;
      g.spawnBurst(b.x, b.y, 2, 3, 0.4, 1, 0.9, 0.08, 0.25);
    }
  }
  g.spawnBurst(p.x, p.y, 40, 14, 0.3, 1, 0.8, 0.16, 0.7);
  g.shake = Math.max(g.shake, 0.6);
  g.emit({ type: "codeStorm", x: p.x, y: p.y });
}

function aimAngle(g: GameEngine, x: number, y: number, error: number): number {
  const p = g.player;
  // Angle measured from straight down; clamped so bullets never travel upward.
  const raw = Math.atan2(p.x - x, -(p.y - y));
  const jitter = (g.rng() - 0.5) * 2 * error;
  return Math.max(-1.05, Math.min(1.05, raw + jitter));
}

function fireAt(g: GameEngine, kind: "bullet" | "heavy", x: number, y: number, angle: number, speedMul = 1): void {
  const spec = kind === "heavy" ? CONFIG.enemyHeavy : CONFIG.enemyBullet;
  const speed = spec.speed * g.difficulty.bulletSpeedMul * speedMul;
  g.spawnBullet(kind, x, y, Math.sin(angle) * speed, -Math.cos(angle) * speed, spec.damage, spec.radius);
}

/** Fires the weapon pattern of the given enemy class. */
export function fireEnemyWeapon(g: GameEngine, e: Enemy): void {
  const y = e.y - e.radius;
  switch (e.type) {
    case "drone":
      fireAt(g, "bullet", e.x, y, 0);
      break;
    case "scout":
      fireAt(g, "bullet", e.x, y, aimAngle(g, e.x, y, 0.08), 1.15);
      break;
    case "armored":
      fireAt(g, "heavy", e.x, y, aimAngle(g, e.x, y, 0.05));
      break;
    case "elite": {
      if (e.firePattern % 2 === 0) {
        const a = aimAngle(g, e.x, y, 0.04);
        fireAt(g, "bullet", e.x, y, a - 0.22);
        fireAt(g, "bullet", e.x, y, a);
        fireAt(g, "bullet", e.x, y, a + 0.22);
      } else {
        fireAt(g, "bullet", e.x - 0.25, y, 0, 1.3);
        fireAt(g, "bullet", e.x + 0.25, y, 0, 1.3);
      }
      e.firePattern += 1;
      break;
    }
  }
  g.emit({ type: "enemyFire", x: e.x, y });
}
