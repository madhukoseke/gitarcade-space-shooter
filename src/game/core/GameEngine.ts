import type {
  AttackPattern,
  PowerUpType,
  Sector,
  SectorDifficulty,
} from "../types/ContributionTypes";
import type {
  Arena,
  Boss,
  Enemy,
  EngineStatus,
  GameEvent,
  GameResult,
  HudSnapshot,
  InputState,
  Particle,
  Player,
  PowerUp,
  Projectile,
  ProjectileKind,
  SectorPhase,
  Stats,
} from "../types/GameTypes";
import { mulberry32, type Rng } from "../generation/SeedGenerator";
import { updateBoss } from "../systems/BossSystem";
import { resolveCollisions, damagePlayer } from "../systems/DamageSystem";
import { updateEnemies } from "../systems/EnemyAISystem";
import {
  playerMinY,
  updateParticles,
  updatePlayerMovement,
  updatePowerUps,
  updateProjectiles,
} from "../systems/MovementSystem";
import {
  accuracy,
  computeParScore,
  computeRating,
  createStats,
  tickCombo,
} from "../systems/ScoringSystem";
import { updatePlayerWeapons } from "../systems/ShootingSystem";
import { loadSector, updateSectorFlow } from "../systems/SpawnSystem";
import { CONFIG } from "./GameConfig";

export interface EngineOptions {
  sectors: Sector[];
  arena: Arena;
  seed: number;
  /** Attract mode: autopilot preview, player cannot be damaged, sectors loop. */
  attract?: boolean;
  particleCap?: number;
}

type Listener = (event: GameEvent) => void;

const makeProjectile = (): Projectile => ({
  active: false, kind: "laser", x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, damage: 0, radius: 0, aoe: 0,
});

const makeEnemy = (): Enemy => ({
  active: false, id: "", type: "drone", state: "DESTROYED", x: 0, y: 0, z: 0, vx: 0, vy: 0,
  homeX: 0, homeY: 0, col: 0, row: 0, hp: 0, maxHp: 0, radius: 0.4, timer: 0, fireCd: 0,
  firePattern: 0, diveShots: 0, hitFlash: 0, scoreBonus: 0, minion: false, synthetic: false,
});

const makeParticle = (): Particle => ({
  active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, size: 0.1, r: 1, g: 1, b: 1,
});

const makeBoss = (): Boss => ({
  active: false, x: 0, y: 0, hp: 0, maxHp: 1, phase: 1, t: 0, entering: 0, stagger: 0, fanCd: 0,
  ringCd: 0, beamState: "off", beamX: 0, beamT: 0, beamDir: 1, beamCd: 0, summonCd: 0, hitFlash: 0, dying: 0,
});

/**
 * The whole simulation. Plain TypeScript: no React, no Three.js. All entities
 * live in fixed-size pools, and the world advances in fixed 1/60 s steps so
 * the same inputs always produce the same result.
 */
export class GameEngine {
  readonly arena: Arena;
  readonly sectors: Sector[];
  readonly attract: boolean;
  readonly parScore: number;

  player!: Player;
  readonly enemies: Enemy[];
  readonly shots: Projectile[];
  readonly bullets: Projectile[];
  readonly particles: Particle[];
  readonly powerUps: PowerUp[];
  readonly boss: Boss = makeBoss();
  stats: Stats;

  status: EngineStatus = "running";
  sectorIndex = 0;
  sectorPhase: SectorPhase = "active";
  sectorTimer = 0;
  wave = 0;
  difficulty!: SectorDifficulty;
  attackPattern: AttackPattern = "column";
  attackTimer = 0;
  powerUpTimer = 0;
  activeBullets = 0;

  time = 0;
  sway = 0;
  shake = 0;
  readonly storm = { active: false, x: 0, y: 0, t: 0 };
  /** Render-only: 0..1 scale applied to the fleet during the intro morph. */
  fleetReveal = 1;

  rng: Rng;
  prevDash = false;
  prevSpecial = false;

  private readonly seed: number;
  private accumulator = 0;
  private nextParticle = 0;
  private readonly listeners = new Set<Listener>();

  constructor(options: EngineOptions) {
    this.arena = options.arena;
    this.sectors = options.sectors;
    this.attract = options.attract ?? false;
    this.seed = options.seed;
    this.rng = mulberry32(this.seed ^ 0x9e3779b9);
    this.parScore = computeParScore(this.sectors);
    this.stats = createStats(this.parScore);
    const pools = CONFIG.pools;
    this.enemies = Array.from({ length: pools.enemies }, makeEnemy);
    this.shots = Array.from({ length: pools.shots }, makeProjectile);
    this.bullets = Array.from({ length: pools.bullets }, makeProjectile);
    this.particles = Array.from({ length: options.particleCap ?? pools.particles }, makeParticle);
    this.powerUps = Array.from({ length: pools.powerUps }, () => ({
      active: false, type: "rapid" as PowerUpType, x: 0, y: 0, t: 0,
    }));
    this.reset();
  }

  /** Resets every gameplay system to the start of sector 1. */
  reset(): void {
    const c = CONFIG.player;
    this.rng = mulberry32(this.seed ^ 0x9e3779b9);
    this.player = {
      x: 0, y: playerMinY(this.arena) + 0.9, vx: 0, vy: 0,
      health: c.maxHealth, shield: c.maxShield, lives: c.lives, alive: true,
      invuln: 0, fireCd: 0, plasmaCd: 0, dashCd: 0, dashTime: 0, dashDirX: 1, dashDirY: 0,
      lastDirX: 1, energy: 0, rapidTime: 0, doubleTime: 0, shieldDelay: 0, hitFlash: 0, shieldFlash: 0,
    };
    this.stats = createStats(this.parScore);
    for (const e of this.enemies) e.active = false;
    for (const s of this.shots) s.active = false;
    for (const b of this.bullets) b.active = false;
    for (const q of this.particles) q.active = false;
    for (const u of this.powerUps) u.active = false;
    Object.assign(this.boss, makeBoss());
    this.status = "running";
    this.time = 0;
    this.sway = 0;
    this.shake = 0;
    this.storm.active = false;
    this.accumulator = 0;
    this.powerUpTimer = 0;
    this.activeBullets = 0;
    this.prevDash = false;
    this.prevSpecial = false;
    loadSector(this, 0, true);
  }

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: GameEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  /** Advances by real elapsed time using fixed steps with a bounded catch-up. */
  update(dtReal: number, input: InputState): void {
    this.accumulator += Math.min(Math.max(dtReal, 0), 0.1);
    let steps = 0;
    while (this.accumulator >= CONFIG.fixedDt && steps < CONFIG.maxStepsPerFrame) {
      this.step(CONFIG.fixedDt, input);
      this.accumulator -= CONFIG.fixedDt;
      steps++;
    }
    if (steps === CONFIG.maxStepsPerFrame) this.accumulator = 0;
  }

  /** One fixed simulation step. */
  step(dt: number, input: InputState): void {
    this.shake = Math.max(0, this.shake - dt * 1.8);
    if (this.storm.active) {
      this.storm.t += dt;
      if (this.storm.t > 0.7) this.storm.active = false;
    }
    if (this.status !== "running") {
      // After the game ends only cosmetic effects keep moving.
      updateParticles(this, dt);
      return;
    }
    this.time += dt;
    this.stats.time += dt;
    let n = 0;
    for (const b of this.bullets) if (b.active) n++;
    this.activeBullets = n;

    updatePlayerMovement(this, input, dt);
    updatePlayerWeapons(this, input, dt);
    updateEnemies(this, dt);
    updateBoss(this, dt);
    updateProjectiles(this, dt);
    resolveCollisions(this);
    updatePowerUps(this, dt);
    updateParticles(this, dt);
    tickCombo(this.stats, dt);
    updateSectorFlow(this, dt);
    this.prevDash = input.dash;
    this.prevSpecial = input.special;
  }

  /** Sets the render-only fleet scale used by the intro morph (0 hidden, 1 shown). */
  setFleetReveal(value: number): void {
    this.fleetReveal = Math.max(0, Math.min(1, value));
  }

  /** Cosmetic-only tick used while the simulation is not running (intro, ready). */
  tickEffects(dt: number): void {
    this.shake = Math.max(0, this.shake - dt * 1.8);
    updateParticles(this, dt);
  }

  acquireEnemy(): Enemy | null {
    for (const e of this.enemies) {
      if (!e.active) {
        e.active = true;
        e.vx = 0;
        e.vy = 0;
        e.hitFlash = 0;
        e.firePattern = 0;
        e.diveShots = 0;
        return e;
      }
    }
    return null;
  }

  private spawnProjectile(
    pool: Projectile[], kind: ProjectileKind, x: number, y: number, vx: number, vy: number,
    damage: number, radius: number, aoe: number,
  ): void {
    for (const s of pool) {
      if (s.active) continue;
      s.active = true;
      s.kind = kind;
      s.x = x; s.y = y; s.px = x; s.py = y;
      s.vx = vx; s.vy = vy;
      s.damage = damage; s.radius = radius; s.aoe = aoe;
      return;
    }
  }

  spawnShot(kind: ProjectileKind, x: number, y: number, vx: number, vy: number, damage: number, radius: number, aoe: number): void {
    this.spawnProjectile(this.shots, kind, x, y, vx, vy, damage, radius, aoe);
  }

  spawnBullet(kind: ProjectileKind, x: number, y: number, vx: number, vy: number, damage: number, radius: number): void {
    this.spawnProjectile(this.bullets, kind, x, y, vx, vy, damage, radius, 0);
  }

  spawnPowerUp(type: PowerUpType, x: number, y: number): void {
    for (const u of this.powerUps) {
      if (u.active) continue;
      u.active = true;
      u.type = type;
      u.x = Math.max(-this.arena.halfW + 1, Math.min(this.arena.halfW - 1, x));
      u.y = y;
      u.t = 0;
      this.powerUpTimer = 0;
      return;
    }
  }

  /** Emits pooled particles; the oldest slots are recycled, so it never allocates. */
  spawnBurst(x: number, y: number, count: number, speed: number, r: number, g: number, b: number, size: number, life: number): void {
    const pool = this.particles;
    const len = pool.length;
    if (len === 0) return;
    for (let i = 0; i < count; i++) {
      const q = pool[this.nextParticle];
      this.nextParticle = (this.nextParticle + 1) % len;
      // Cosmetic randomness only: kept off the gameplay RNG stream.
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.65);
      q.active = true;
      q.x = x; q.y = y; q.z = 0;
      q.vx = Math.cos(a) * v;
      q.vy = Math.sin(a) * v;
      q.vz = (Math.random() - 0.5) * speed * 0.6;
      q.maxLife = life * (0.6 + Math.random() * 0.4);
      q.life = q.maxLife;
      q.size = size * (0.6 + Math.random() * 0.8);
      q.r = r; q.g = g; q.b = b;
    }
  }

  hud(): HudSnapshot {
    const p = this.player;
    const s = this.stats;
    const boss = this.boss;
    return {
      score: s.score,
      lives: p.lives,
      health: Math.max(0, Math.round(p.health)),
      maxHealth: CONFIG.player.maxHealth,
      shield: Math.round(p.shield),
      maxShield: CONFIG.player.maxShield,
      multiplier: s.multiplier,
      combo: s.combo,
      sectorIndex: this.sectorIndex,
      sectorCount: this.sectors.length,
      sectorSynthetic: this.sectors[this.sectorIndex]?.synthetic ?? false,
      energy: Math.round(p.energy),
      rapid: Math.ceil(p.rapidTime),
      double: Math.ceil(p.doubleTime),
      plasmaReady: p.plasmaCd <= 0,
      dashReady: p.dashCd <= 0,
      bossActive: boss.active || this.sectorPhase === "bossWarning",
      bossHp: boss.active ? Math.round((boss.hp / boss.maxHp) * 100) : 100,
      bossPhase: boss.phase,
    };
  }

  result(): GameResult {
    const s = this.stats;
    const bossStage = this.sectorPhase === "bossWarning" || this.sectorPhase === "boss" || this.sectorPhase === "bossDying";
    return {
      score: s.score,
      kills: s.kills,
      accuracy: accuracy(s),
      damageTaken: Math.round(s.damageTaken),
      sectorsCompleted: s.sectorsCompleted,
      sectorReached: this.status === "victory" || bossStage ? this.sectors.length : this.sectorIndex + 1,
      sectorCount: this.sectors.length,
      time: s.time,
      maxCombo: s.maxCombo,
      rating: computeRating(s.score, this.parScore),
      victory: this.status === "victory",
    };
  }

  /** Test/debug helper: removes all remaining lives and ends the run. */
  debugKillPlayer(): void {
    const p = this.player;
    p.invuln = 0;
    p.shield = 0;
    p.lives = 1;
    damagePlayer(this, p.health + 1);
  }
}
