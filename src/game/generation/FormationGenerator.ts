import { CONFIG } from "../core/GameConfig";
import type { GeneratedEnemy, SectorDifficulty } from "../types/ContributionTypes";
import type { Arena } from "../types/GameTypes";
import { enemyTypeForLevel, type CalendarCell } from "./ContributionParser";
import { contributionBonus, enemyHealth } from "./DifficultyScaler";

export interface FormationLayout {
  colSpacing: number;
  rowSpacing: number;
  topY: number;
}

export function formationLayout(arena: Arena): FormationLayout {
  return arena.portrait
    ? { colSpacing: 2.5, rowSpacing: 1.12, topY: arena.halfH - 2.2 }
    : { colSpacing: 3.0, rowSpacing: 0.92, topY: arena.halfH - 1.7 };
}

/** X = week within the sector, Y = weekday (Sunday on top, as on GitHub). */
export function cellPosition(
  col: number,
  row: number,
  columns: number,
  layout: FormationLayout,
): { x: number; y: number } {
  return {
    x: (col - (columns - 1) / 2) * layout.colSpacing,
    y: layout.topY - row * layout.rowSpacing,
  };
}

/**
 * Converts the cells of one sector into enemies. Level-0 cells stay empty.
 * Positions are a pure function of (week, weekday), so the slice of the
 * contribution graph stays recognisable.
 */
export function generateFormation(
  cells: CalendarCell[],
  weekStart: number,
  columns: number,
  sectorIndex: number,
  difficulty: SectorDifficulty,
  arena: Arena,
): GeneratedEnemy[] {
  const layout = formationLayout(arena);
  const enemies: GeneratedEnemy[] = [];
  for (const cell of cells) {
    const type = enemyTypeForLevel(cell.day.level);
    if (!type) continue;
    const col = cell.week - weekStart;
    const { x, y } = cellPosition(col, cell.weekday, columns, layout);
    enemies.push({
      id: `s${sectorIndex}-${cell.day.date}`,
      date: cell.day.date,
      contributionCount: cell.day.count,
      level: cell.day.level,
      type,
      health: enemyHealth(type, difficulty),
      position: { x, y, z: cell.day.level * 0.12 },
      col,
      row: cell.weekday,
      wave: 0,
      scoreBonus: contributionBonus(cell.day.count),
      synthetic: false,
    });
    if (enemies.length >= CONFIG.sector.maxEnemies) break;
  }
  return assignWaves(enemies, columns);
}

/**
 * Dense sectors keep every contribution cell but enter in two week-batched
 * waves, so combat density stays bounded.
 */
export function assignWaves(enemies: GeneratedEnemy[], columns: number): GeneratedEnemy[] {
  if (enemies.length <= CONFIG.sector.waveCap) return enemies;
  const split = Math.ceil(columns / 2);
  return enemies.map((e) => ({ ...e, wave: e.col < split ? 0 : 1 }));
}

/** Neutral patrol for a sector with no contributions. Flagged synthetic. */
export function generatePatrol(
  sectorIndex: number,
  difficulty: SectorDifficulty,
  arena: Arena,
): GeneratedEnemy[] {
  const count = 4 + Math.min(2, Math.floor(sectorIndex / 4));
  const layout = formationLayout(arena);
  const enemies: GeneratedEnemy[] = [];
  const spread = arena.portrait ? 1.7 : 2.4;
  for (let i = 0; i < count; i++) {
    const offset = i - (count - 1) / 2;
    enemies.push({
      id: `patrol-${sectorIndex}-${i}`,
      date: "",
      contributionCount: 0,
      level: 0,
      type: "drone",
      health: enemyHealth("drone", difficulty),
      position: {
        x: offset * spread,
        y: layout.topY - 1.2 - Math.abs(offset) * 0.7,
        z: 0,
      },
      col: i,
      row: 3,
      wave: 0,
      scoreBonus: 0,
      synthetic: true,
    });
  }
  return enemies;
}
