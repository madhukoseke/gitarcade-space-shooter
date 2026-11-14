import { CONFIG } from "../core/GameConfig";
import type { GameEngine } from "../core/GameEngine";
import type { PowerUpType } from "../types/ContributionTypes";
import type { Enemy, PowerUp } from "../types/GameTypes";
import { startBossWarning } from "./BossSystem";

/** Loads a sector. `instant` places enemies directly in formation (intro/restart). */
export function loadSector(g: GameEngine, index: number, instant: boolean): void {
  for (const e of g.enemies) e.active = false;
  g.sectorIndex = index;
  const sector = g.sectors[index];
  g.difficulty = sector.difficulty;
  g.attackPattern = sector.attackPattern;
  g.attackTimer = sector.difficulty.attackInterval;
  g.wave = 0;
  g.sectorPhase = "active";
  spawnWave(g, 0, instant);
  g.emit({ type: "sectorStart", value: index, label: sector.synthetic ? "patrol" : "sector" });
}

export function spawnWave(g: GameEngine, wave: number, instant: boolean): void {
  const sector = g.sectors[g.sectorIndex];
  g.wave = wave;
  for (const spec of sector.enemies) {
    if (spec.wave !== wave) continue;
    const e = g.acquireEnemy();
    if (!e) break;
    const base = CONFIG.enemies[spec.type];
    e.id = spec.id;
    e.type = spec.type;
    e.homeX = spec.position.x;
    e.homeY = spec.position.y;
    e.z = spec.position.z;
    e.col = spec.col;
    e.row = spec.row;
    e.hp = spec.health;
    e.maxHp = spec.health;
    e.radius = base.radius;
    e.scoreBonus = spec.scoreBonus;
    e.synthetic = spec.synthetic;
    e.minion = false;
    e.fireCd = 1.2 + g.rng() * base.fireInterval;
    if (instant) {
      e.x = e.homeX;
      e.y = e.homeY;
      e.state = "IDLE";
      e.timer = 0;
    } else {
      e.x = e.homeX * 0.5 + (g.rng() - 0.5) * 4;
      e.y = g.arena.halfH + 1.5 + spec.row * 0.25;
      e.state = "SPAWNING";
      e.timer = spec.col * 0.12 + spec.row * 0.05;
    }
  }
}

function countAlive(g: GameEngine): number {
  let n = 0;
  for (const e of g.enemies) if (e.active) n++;
  return n;
}

/** Sector progression: waves, clear reward, next sector, then the boss. */
export function updateSectorFlow(g: GameEngine, dt: number): void {
  switch (g.sectorPhase) {
    case "active": {
      const sector = g.sectors[g.sectorIndex];
      const alive = countAlive(g);
      const moreWaves = g.wave + 1 < sector.waveCount;
      if (moreWaves && alive <= CONFIG.sector.waveAdvanceAt) {
        spawnWave(g, g.wave + 1, false);
      } else if (!moreWaves && alive === 0) {
        g.stats.sectorsCompleted += 1;
        g.stats.score += CONFIG.score.sectorClear;
        const p = g.player;
        p.shield = Math.min(CONFIG.player.maxShield, p.shield + CONFIG.sector.clearShieldReward);
        if (sector.powerUp) g.spawnPowerUp(sector.powerUp, 0, g.arena.halfH - 1);
        g.sectorPhase = "clearing";
        g.sectorTimer = CONFIG.sector.clearDelay;
        g.emit({ type: "sectorClear", value: g.sectorIndex });
      }
      break;
    }
    case "clearing":
      g.sectorTimer -= dt;
      if (g.sectorTimer <= 0) {
        if (g.sectorIndex + 1 < g.sectors.length) loadSector(g, g.sectorIndex + 1, false);
        else if (g.attract) g.reset();
        else startBossWarning(g);
      }
      break;
    default:
      break;
  }
}

function weightedPowerUp(roll: number): PowerUpType {
  const w = CONFIG.powerUps.weights;
  if (roll < w.rapid) return "rapid";
  if (roll < w.rapid + w.shield) return "shield";
  return "double";
}

/** Rare drops, rate-limited so the field never fills with power-ups. */
export function maybeDropPowerUp(g: GameEngine, e: Enemy): void {
  const c = CONFIG.powerUps;
  if (g.powerUpTimer < c.minInterval) return;
  const chance = e.type === "elite" ? c.eliteDropChance : c.dropChance;
  if (g.rng() >= chance) return;
  g.spawnPowerUp(weightedPowerUp(g.rng()), e.x, e.y);
}

export function collectPowerUp(g: GameEngine, u: PowerUp): void {
  const p = g.player;
  const c = CONFIG.powerUps;
  u.active = false;
  if (u.type === "rapid") p.rapidTime = c.rapidDuration;
  else if (u.type === "double") p.doubleTime = c.doubleDuration;
  else {
    p.shield = Math.min(CONFIG.player.maxShield, p.shield + c.shieldRestore);
    p.shieldFlash = 0.6;
  }
  g.spawnBurst(u.x, u.y, 14, 5, 1, 1, 0.6, 0.12, 0.45);
  g.emit({ type: "powerUp", x: u.x, y: u.y, label: u.type });
}
