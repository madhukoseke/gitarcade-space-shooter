import { CONFIG } from "../core/GameConfig";
import type { GameEngine } from "../core/GameEngine";

export function bossHomeY(g: GameEngine): number {
  return g.arena.halfH - 4.3;
}

export function startBossWarning(g: GameEngine): void {
  g.sectorPhase = "bossWarning";
  g.sectorTimer = CONFIG.boss.warningTime;
  g.emit({ type: "bossWarning" });
}

function spawnBoss(g: GameEngine): void {
  const b = g.boss;
  const c = CONFIG.boss;
  for (const e of g.enemies) e.active = false;
  b.active = true;
  b.x = 0;
  b.y = g.arena.halfH + 4;
  b.hp = c.health;
  b.maxHp = c.health;
  b.phase = 1;
  b.t = 0;
  b.entering = c.enterTime;
  b.stagger = 0.6;
  b.fanCd = 1.2;
  b.ringCd = c.ringInterval;
  b.beamState = "off";
  b.beamCd = 2.5;
  b.beamT = 0;
  b.summonCd = 2;
  b.hitFlash = 0;
  b.dying = 0;
  // Boss fight uses fixed, fair difficulty for minions and bullets.
  g.difficulty = { ...g.difficulty, maxAttackers: 3, attackInterval: 2.2, maxEnemyBullets: 60 };
  g.attackPattern = "random";
  g.sectorPhase = "boss";
  g.emit({ type: "bossAppear" });
}

function fan(g: GameEngine, count: number): void {
  const b = g.boss;
  const p = g.player;
  const base = Math.max(-0.9, Math.min(0.9, Math.atan2(p.x - b.x, -(p.y - b.y))));
  const spread = 0.2;
  const spec = CONFIG.enemyBullet;
  for (let i = 0; i < count; i++) {
    const a = base + (i - (count - 1) / 2) * spread;
    const speed = spec.speed * 1.1;
    g.spawnBullet("bullet", b.x, b.y - 1.8, Math.sin(a) * speed, -Math.cos(a) * speed, spec.damage, spec.radius);
  }
  g.emit({ type: "enemyFire", x: b.x, y: b.y });
}

function ring(g: GameEngine): void {
  const b = g.boss;
  const n = CONFIG.boss.ringCount;
  const offset = g.rng() * Math.PI * 2;
  const spec = CONFIG.enemyHeavy;
  for (let i = 0; i < n; i++) {
    const a = offset + (i / n) * Math.PI * 2;
    g.spawnBullet("heavy", b.x, b.y, Math.cos(a) * spec.speed, Math.sin(a) * spec.speed, spec.damage, spec.radius);
  }
  g.emit({ type: "enemyFire", x: b.x, y: b.y });
}

function summon(g: GameEngine): void {
  const b = g.boss;
  let minions = 0;
  for (const e of g.enemies) if (e.active) minions++;
  const room = CONFIG.boss.maxMinions - minions;
  const n = Math.min(CONFIG.boss.summonCount, room);
  for (let i = 0; i < n; i++) {
    const e = g.acquireEnemy();
    if (!e) return;
    const spec = CONFIG.enemies.drone;
    const slot = (minions + i) % CONFIG.boss.maxMinions;
    const span = g.arena.halfW - 2;
    e.id = `minion-${Math.floor(g.time * 60)}-${i}`;
    e.type = "drone";
    e.minion = true;
    e.synthetic = true;
    e.homeX = -span + (slot / (CONFIG.boss.maxMinions - 1)) * span * 2;
    e.homeY = bossHomeY(g) - 3.2;
    e.z = 0;
    e.col = slot;
    e.row = 0;
    e.hp = spec.health * 1.5;
    e.maxHp = e.hp;
    e.radius = spec.radius;
    e.scoreBonus = 0;
    e.fireCd = 1.5 + g.rng() * 2;
    e.x = b.x + (i - (n - 1) / 2) * 1.2;
    e.y = b.y - 1.5;
    e.state = "FORMING";
    e.timer = 0;
    g.spawnBurst(e.x, e.y, 8, 4, 1, 0.3, 0.5, 0.12, 0.4);
  }
}

/** Boss behaviour: three phases keyed to remaining health, all attacks telegraphed. */
export function updateBoss(g: GameEngine, dt: number): void {
  const c = CONFIG.boss;
  const b = g.boss;

  if (g.sectorPhase === "bossWarning") {
    g.sectorTimer -= dt;
    if (g.sectorTimer <= 0) spawnBoss(g);
    return;
  }
  if (!b.active) return;
  b.t += dt;
  if (b.hitFlash > 0) b.hitFlash -= dt;

  if (g.sectorPhase === "bossDying") {
    b.dying -= dt;
    b.beamState = "off";
    if (g.rng() < dt * 14) {
      g.spawnBurst(b.x + (g.rng() - 0.5) * 5, b.y + (g.rng() - 0.5) * 3, 16, 8, 1, 0.6 + g.rng() * 0.4, 0.3, 0.2, 0.7);
      g.shake = Math.max(g.shake, 0.35);
    }
    if (b.dying <= 0) {
      b.active = false;
      g.spawnBurst(b.x, b.y, 80, 16, 1, 0.9, 0.6, 0.26, 1.2);
      g.stats.score += CONFIG.score.boss;
      g.sectorPhase = "done";
      g.status = "victory";
      g.emit({ type: "victory" });
    }
    return;
  }

  // Entrance.
  const homeY = bossHomeY(g);
  if (b.entering > 0) {
    b.entering -= dt;
    b.y += (homeY - b.y) * Math.min(1, 2.5 * dt);
    return;
  }
  b.y = homeY + Math.sin(b.t * 0.9) * 0.25;
  const span = Math.max(1, g.arena.halfW - 4.2);
  b.x = Math.sin(b.t * 0.45) * span;

  if (b.hp <= 0) {
    b.dying = c.dyingTime;
    g.sectorPhase = "bossDying";
    for (const bullet of g.bullets) bullet.active = false;
    for (const e of g.enemies) {
      if (e.active) {
        e.active = false;
        g.spawnBurst(e.x, e.y, 8, 5, 0.4, 1, 0.5, 0.14, 0.4);
      }
    }
    g.emit({ type: "bossDown" });
    return;
  }

  const ratio = b.hp / b.maxHp;
  const phase: 1 | 2 | 3 = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
  if (phase !== b.phase) {
    b.phase = phase;
    b.stagger = c.phaseStagger;
    b.beamState = "off";
    b.beamCd = 1.6;
    b.summonCd = 1.5;
    g.spawnBurst(b.x, b.y, 30, 10, 1, 0.4, 0.6, 0.2, 0.7);
    g.shake = Math.max(g.shake, 0.5);
    g.emit({ type: "bossPhase", value: phase });
  }
  if (b.stagger > 0) {
    b.stagger -= dt;
    return;
  }
  if (!g.player.alive) return;

  // Projectile patterns (all phases, thinner in later phases).
  b.fanCd -= dt;
  if (b.fanCd <= 0) {
    b.fanCd = c.fanInterval[phase - 1];
    fan(g, c.fanCount[phase - 1]);
  }
  b.ringCd -= dt;
  if (b.ringCd <= 0) {
    b.ringCd = phase === 1 ? c.ringInterval : c.ringInterval * 1.4;
    ring(g);
  }

  // Phase 2+: sweeping laser with a warning line before it fires.
  if (phase >= 2) {
    if (b.beamState === "off") {
      b.beamCd -= dt;
      if (b.beamCd <= 0) {
        b.beamState = "warn";
        b.beamT = c.beamWarn;
        b.beamX = g.player.x;
        g.emit({ type: "beamWarn", x: b.beamX });
      }
    } else if (b.beamState === "warn") {
      b.beamT -= dt;
      if (b.beamT <= 0) {
        b.beamState = "fire";
        b.beamT = c.beamFire;
        const d = g.player.x - b.beamX;
        b.beamDir = Math.abs(d) > 0.3 ? Math.sign(d) : g.rng() < 0.5 ? -1 : 1;
        g.emit({ type: "beamFire", x: b.beamX });
      }
    } else {
      b.beamT -= dt;
      b.beamX += b.beamDir * c.beamSpeed * dt;
      const lim = g.arena.halfW - 0.5;
      if (b.beamX < -lim || b.beamX > lim) b.beamDir *= -1;
      if (b.beamT <= 0) {
        b.beamState = "off";
        b.beamCd = c.beamCooldown;
      }
    }
  }

  // Phase 3: summons drones.
  if (phase === 3) {
    b.summonCd -= dt;
    if (b.summonCd <= 0) {
      b.summonCd = c.summonInterval;
      summon(g);
    }
  }
}
