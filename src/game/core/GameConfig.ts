import type { PowerUpType } from "../types/ContributionTypes";
import type { EnemyType } from "../types/EnemyTypes";

/** Bump when generation rules change so seeds from older versions are not compared. */
export const GENERATOR_VERSION = 1;

export interface EnemySpec {
  health: number;
  radius: number;
  score: number;
  fireInterval: number;
  canDive: boolean;
  diveSpeed: number;
  contactDamage: number;
}

export const CONFIG = {
  fixedDt: 1 / 60,
  maxStepsPerFrame: 5,

  arena: {
    landscape: { halfW: 13, halfH: 8 },
    portrait: { halfW: 7, halfH: 11 },
  },

  player: {
    maxHealth: 100,
    maxShield: 50,
    lives: 3,
    weaponName: "Laser Cannon",
    specialName: "Code Storm",
    speed: 13,
    /** Velocity response rate (1/s). High value keeps inertia low. */
    response: 18,
    radius: 0.55,
    /** Fraction of the visual radius used for enemy-bullet hits. */
    hitboxScale: 0.62,
    hitInvuln: 0.8,
    respawnInvuln: 2.2,
    dashSpeed: 34,
    dashDuration: 0.16,
    dashCooldown: 1.2,
    dashInvuln: 0.28,
    shieldRegenDelay: 5,
    shieldRegenRate: 3,
    /** Highest Y the player may reach, keeping clear of the formation. */
    maxY: -0.8,
  },

  weapons: {
    laser: { cooldown: 0.14, rapidCooldown: 0.07, speed: 34, damage: 10, radius: 0.14 },
    plasma: { cooldown: 2.4, speed: 17, damage: 60, radius: 0.34, aoe: 2.3, aoeDamage: 30 },
    storm: { energyMax: 100, energyPerKill: 7, radius: 9.5, damage: 90, bossDamage: 260 },
  },

  enemies: {
    drone: { health: 20, radius: 0.42, score: 100, fireInterval: 4.2, canDive: false, diveSpeed: 8, contactDamage: 15 },
    scout: { health: 40, radius: 0.42, score: 200, fireInterval: 3.4, canDive: true, diveSpeed: 10, contactDamage: 18 },
    armored: { health: 80, radius: 0.52, score: 350, fireInterval: 3.8, canDive: false, diveSpeed: 7, contactDamage: 24 },
    elite: { health: 110, radius: 0.5, score: 500, fireInterval: 2.6, canDive: true, diveSpeed: 11.5, contactDamage: 24 },
  } satisfies Record<EnemyType, EnemySpec>,

  /** Absolute cap applied after difficulty scaling: health never exceeds base * this. */
  enemyHealthCapMul: 1.5,
  enemyBullet: { speed: 7.6, damage: 12, radius: 0.2 },
  enemyHeavy: { speed: 5.8, damage: 22, radius: 0.3 },
  enemyContactSelfDamage: 40,
  formSpeed: 12,
  swayAmplitude: 0.55,
  swayRate: 0.6,

  sector: {
    weeks: 4,
    clearBonus: 1000,
    clearDelay: 2.2,
    clearShieldReward: 20,
    /** Sectors with more enemies than this enter in waves. */
    waveCap: 16,
    /** Next wave enters once this many enemies of the current wave remain. */
    waveAdvanceAt: 3,
    /** Hard cap on enemies generated for one sector. */
    maxEnemies: 28,
    contributionBonusPerCount: 5,
    contributionBonusCap: 50,
  },

  score: {
    sectorClear: 1000,
    boss: 5000,
    minion: 50,
  },

  combo: {
    window: 2.6,
    killsPerStep: 3,
    maxMultiplier: 8,
  },

  powerUps: {
    dropChance: 0.06,
    eliteDropChance: 0.16,
    minInterval: 9,
    fallSpeed: 2.6,
    collectRadius: 1.0,
    rapidDuration: 8,
    doubleDuration: 10,
    shieldRestore: 50,
    weights: { rapid: 0.35, shield: 0.35, double: 0.3 } satisfies Record<PowerUpType, number>,
  },

  boss: {
    name: "Merge Conflict",
    health: 4200,
    radius: 2.4,
    contactDamage: 30,
    warningTime: 2.6,
    enterTime: 2.2,
    dyingTime: 2.8,
    phaseStagger: 1.3,
    fanInterval: [1.2, 1.5, 1.7],
    fanCount: [5, 3, 3],
    ringInterval: 5.2,
    ringCount: 12,
    beamCooldown: 4,
    beamWarn: 1.1,
    beamFire: 1.8,
    beamSpeed: 3.2,
    beamHalfWidth: 0.5,
    beamDamage: 25,
    summonInterval: 7,
    summonCount: 3,
    maxMinions: 6,
  },

  pools: {
    enemies: 96,
    shots: 96,
    bullets: 180,
    particles: 600,
    powerUps: 6,
  },
} as const;

export type GameConfig = typeof CONFIG;
