export const ENEMY_TYPES = ["drone", "scout", "armored", "elite"] as const;
export type EnemyType = (typeof ENEMY_TYPES)[number];

export type EnemyState =
  | "SPAWNING"
  | "FORMING"
  | "IDLE"
  | "ATTACKING"
  | "RETURNING"
  | "DESTROYED";
