import { CONFIG } from "../core/GameConfig";
import { circlesOverlap, segmentCircleHit } from "../core/CollisionSystem";
import type { GameEngine } from "../core/GameEngine";
import type { Enemy } from "../types/GameTypes";
import { reduceComboOnDamage, registerKill } from "./ScoringSystem";
import { maybeDropPowerUp, collectPowerUp } from "./SpawnSystem";

const ENEMY_COLORS: Record<string, [number, number, number]> = {
  drone: [0.25, 0.75, 0.4],
  scout: [0.3, 0.9, 0.5],
  armored: [0.45, 1, 0.55],
  elite: [0.7, 1, 0.75],
};

/**
 * Applies damage to the player: shield first, then health, then a life.
 * Returns false when the hit was ignored (invulnerable, attract mode, dead).
 */
export function damagePlayer(g: GameEngine, amount: number): boolean {
  const p = g.player;
  if (!p.alive || p.invuln > 0 || g.attract || g.status !== "running") return false;
  const c = CONFIG.player;
  g.stats.damageTaken += amount;
  reduceComboOnDamage(g.stats);
  p.shieldDelay = c.shieldRegenDelay;

  let rest = amount;
  if (p.shield > 0) {
    const absorbed = Math.min(p.shield, rest);
    p.shield -= absorbed;
    rest -= absorbed;
    p.shieldFlash = 0.45;
    g.emit({ type: "shieldHit", x: p.x, y: p.y });
    g.shake = Math.max(g.shake, 0.18);
  }
  if (rest > 0) {
    p.health -= rest;
    p.hitFlash = 0.35;
    g.shake = Math.max(g.shake, 0.4);
    g.emit({ type: "playerHit", x: p.x, y: p.y, value: rest });
    g.spawnBurst(p.x, p.y, 8, 5, 1, 0.5, 0.3, 0.14, 0.4);
  }
  p.invuln = c.hitInvuln;

  if (p.health <= 0) {
    p.lives -= 1;
    g.spawnBurst(p.x, p.y, 34, 9, 0.4, 0.9, 1, 0.2, 0.9);
    g.shake = Math.max(g.shake, 0.8);
    if (p.lives > 0) {
      p.health = c.maxHealth;
      p.shield = c.maxShield * 0.5;
      p.invuln = c.respawnInvuln;
      for (const b of g.bullets) b.active = false;
      g.emit({ type: "lifeLost", x: p.x, y: p.y, value: p.lives });
    } else {
      p.health = 0;
      p.alive = false;
      g.status = "gameOver";
      g.emit({ type: "gameOver" });
    }
  }
  return true;
}

export function damageEnemy(g: GameEngine, e: Enemy, damage: number, hx: number, hy: number): void {
  if (!e.active) return;
  e.hp -= damage;
  e.hitFlash = 0.12;
  g.spawnBurst(hx, hy, 3, 4, 0.8, 1, 0.9, 0.08, 0.22);
  if (e.hp <= 0) killEnemy(g, e);
  else g.emit({ type: "enemyHit", x: hx, y: hy });
}

export function killEnemy(g: GameEngine, e: Enemy): void {
  e.active = false;
  e.state = "DESTROYED";
  const spec = CONFIG.enemies[e.type];
  const points = registerKill(g.stats, e.minion ? CONFIG.score.minion : spec.score, e.scoreBonus);
  const p = g.player;
  p.energy = Math.min(CONFIG.weapons.storm.energyMax, p.energy + CONFIG.weapons.storm.energyPerKill);
  const [r, gr, b] = ENEMY_COLORS[e.type];
  const big = e.type === "elite" || e.type === "armored";
  g.spawnBurst(e.x, e.y, big ? 22 : 12, big ? 8 : 6, r, gr, b, big ? 0.2 : 0.15, big ? 0.75 : 0.55);
  g.spawnBurst(e.x, e.y, 4, 3, 1, 1, 1, 0.24, 0.25);
  g.shake = Math.max(g.shake, big ? 0.22 : 0.1);
  g.emit({ type: "enemyDown", x: e.x, y: e.y, value: points, label: e.type });
  if (!e.minion) maybeDropPowerUp(g, e);
}

export function damageBoss(g: GameEngine, damage: number, hx: number, hy: number): void {
  const boss = g.boss;
  if (!boss.active || boss.dying > 0 || boss.entering > 0) return;
  boss.hp = Math.max(0, boss.hp - damage);
  boss.hitFlash = 0.1;
  g.spawnBurst(hx, hy, 3, 5, 1, 0.9, 0.5, 0.1, 0.25);
  g.emit({ type: "enemyHit", x: hx, y: hy });
}

function plasmaBurst(g: GameEngine, hx: number, hy: number, direct: Enemy | null): void {
  const w = CONFIG.weapons.plasma;
  for (const e of g.enemies) {
    if (!e.active || e === direct || e.state === "SPAWNING") continue;
    if (circlesOverlap(hx, hy, w.aoe, e.x, e.y, e.radius)) damageEnemy(g, e, w.aoeDamage, e.x, e.y);
  }
  g.spawnBurst(hx, hy, 26, 9, 1, 0.35, 0.95, 0.2, 0.6);
  g.shake = Math.max(g.shake, 0.3);
  g.emit({ type: "plasmaBurst", x: hx, y: hy });
}

/** All collision resolution for one fixed step. Rendering never runs this. */
export function resolveCollisions(g: GameEngine): void {
  const p = g.player;
  const boss = g.boss;
  const bossHittable = boss.active && boss.dying <= 0 && boss.entering <= 0;

  // Player projectiles vs enemies and boss (swept, earliest hit wins).
  for (const s of g.shots) {
    if (!s.active) continue;
    let bestT = 2;
    let bestEnemy: Enemy | null = null;
    let hitBoss = false;
    for (const e of g.enemies) {
      if (!e.active || e.state === "SPAWNING") continue;
      const t = segmentCircleHit(s.px, s.py, s.x, s.y, e.x, e.y, e.radius + s.radius);
      if (t >= 0 && t < bestT) {
        bestT = t;
        bestEnemy = e;
      }
    }
    if (bossHittable) {
      const t = segmentCircleHit(s.px, s.py, s.x, s.y, boss.x, boss.y, CONFIG.boss.radius + s.radius);
      if (t >= 0 && t < bestT) {
        bestT = t;
        bestEnemy = null;
        hitBoss = true;
      }
    }
    if (!bestEnemy && !hitBoss) continue;
    const hx = s.px + (s.x - s.px) * bestT;
    const hy = s.py + (s.y - s.py) * bestT;
    s.active = false;
    g.stats.shotsHit += 1;
    if (bestEnemy) damageEnemy(g, bestEnemy, s.damage, hx, hy);
    else damageBoss(g, s.damage, hx, hy);
    if (s.kind === "plasma") plasmaBurst(g, hx, hy, bestEnemy);
  }

  if (!p.alive) return;
  const hitR = CONFIG.player.radius * CONFIG.player.hitboxScale;

  // Enemy projectiles vs player (swept).
  for (const b of g.bullets) {
    if (!b.active) continue;
    const t = segmentCircleHit(b.px, b.py, b.x, b.y, p.x, p.y, hitR + b.radius);
    if (t >= 0 && damagePlayer(g, b.damage)) b.active = false;
  }

  // Enemy bodies vs player.
  for (const e of g.enemies) {
    if (!e.active || e.state === "SPAWNING") continue;
    if (circlesOverlap(p.x, p.y, CONFIG.player.radius * 0.8, e.x, e.y, e.radius)) {
      if (damagePlayer(g, CONFIG.enemies[e.type].contactDamage)) {
        damageEnemy(g, e, CONFIG.enemyContactSelfDamage, e.x, e.y);
      }
    }
  }

  // Boss body and sweeping beam.
  if (bossHittable) {
    if (circlesOverlap(p.x, p.y, CONFIG.player.radius * 0.8, boss.x, boss.y, CONFIG.boss.radius)) {
      damagePlayer(g, CONFIG.boss.contactDamage);
    }
    if (
      boss.beamState === "fire" &&
      p.y < boss.y &&
      Math.abs(p.x - boss.beamX) < CONFIG.boss.beamHalfWidth + hitR
    ) {
      damagePlayer(g, CONFIG.boss.beamDamage);
    }
  }

  // Power-ups vs player.
  for (const u of g.powerUps) {
    if (!u.active) continue;
    if (circlesOverlap(p.x, p.y, CONFIG.powerUps.collectRadius, u.x, u.y, 0)) collectPowerUp(g, u);
  }
}
