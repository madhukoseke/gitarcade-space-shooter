import type { PowerUpType } from "./ContributionTypes";
import type { EnemyState, EnemyType } from "./EnemyTypes";

export interface Arena {
  halfW: number;
  halfH: number;
  portrait: boolean;
}

export interface InputState {
  moveX: number;
  moveY: number;
  fire: boolean;
  plasma: boolean;
  dash: boolean;
  special: boolean;
}

export const createInput = (): InputState => ({
  moveX: 0,
  moveY: 0,
  fire: false,
  plasma: false,
  dash: false,
  special: false,
});

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  health: number;
  shield: number;
  lives: number;
  alive: boolean;
  invuln: number;
  fireCd: number;
  plasmaCd: number;
  dashCd: number;
  dashTime: number;
  dashDirX: number;
  dashDirY: number;
  lastDirX: number;
  energy: number;
  rapidTime: number;
  doubleTime: number;
  shieldDelay: number;
  hitFlash: number;
  shieldFlash: number;
}

export interface Enemy {
  active: boolean;
  id: string;
  type: EnemyType;
  state: EnemyState;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  homeX: number;
  homeY: number;
  col: number;
  row: number;
  hp: number;
  maxHp: number;
  radius: number;
  timer: number;
  fireCd: number;
  firePattern: number;
  diveShots: number;
  hitFlash: number;
  scoreBonus: number;
  minion: boolean;
  synthetic: boolean;
}

export type ProjectileKind = "laser" | "plasma" | "bullet" | "heavy";

export interface Projectile {
  active: boolean;
  kind: ProjectileKind;
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  damage: number;
  radius: number;
  aoe: number;
}

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  r: number;
  g: number;
  b: number;
}

export interface PowerUp {
  active: boolean;
  type: PowerUpType;
  x: number;
  y: number;
  t: number;
}

export type BeamState = "off" | "warn" | "fire";

export interface Boss {
  active: boolean;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  phase: 1 | 2 | 3;
  t: number;
  entering: number;
  stagger: number;
  fanCd: number;
  ringCd: number;
  beamState: BeamState;
  beamX: number;
  beamT: number;
  beamDir: number;
  beamCd: number;
  summonCd: number;
  hitFlash: number;
  dying: number;
}

export interface Stats {
  score: number;
  kills: number;
  shotsFired: number;
  shotsHit: number;
  damageTaken: number;
  sectorsCompleted: number;
  time: number;
  combo: number;
  comboTimer: number;
  maxCombo: number;
  multiplier: number;
  /** Score a combo-free full clear would earn; used to normalise ratings. */
  parScore: number;
}

export type SectorPhase =
  | "active"
  | "clearing"
  | "bossWarning"
  | "boss"
  | "bossDying"
  | "done";

export type EngineStatus = "running" | "gameOver" | "victory";

export type GameEventType =
  | "laser"
  | "plasma"
  | "plasmaBurst"
  | "enemyHit"
  | "enemyDown"
  | "enemyFire"
  | "playerHit"
  | "shieldHit"
  | "lifeLost"
  | "powerUp"
  | "dash"
  | "codeStorm"
  | "sectorStart"
  | "sectorClear"
  | "bossWarning"
  | "bossAppear"
  | "bossPhase"
  | "beamWarn"
  | "beamFire"
  | "bossDown"
  | "victory"
  | "gameOver";

export interface GameEvent {
  type: GameEventType;
  x?: number;
  y?: number;
  value?: number;
  label?: string;
}

export interface HudSnapshot {
  score: number;
  lives: number;
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  multiplier: number;
  combo: number;
  sectorIndex: number;
  sectorCount: number;
  sectorSynthetic: boolean;
  energy: number;
  rapid: number;
  double: number;
  plasmaReady: boolean;
  dashReady: boolean;
  bossActive: boolean;
  bossHp: number;
  bossPhase: number;
}

export interface GameResult {
  score: number;
  kills: number;
  accuracy: number;
  damageTaken: number;
  sectorsCompleted: number;
  sectorReached: number;
  sectorCount: number;
  time: number;
  maxCombo: number;
  rating: string;
  victory: boolean;
}
