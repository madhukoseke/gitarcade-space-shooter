import { CONFIG } from "../core/GameConfig";
import type {
  AttackPattern,
  ContributionWeek,
  PowerUpType,
  Sector,
} from "../types/ContributionTypes";
import type { Arena } from "../types/GameTypes";
import { flattenCalendar } from "./ContributionParser";
import { difficultyForSector } from "./DifficultyScaler";
import { generateFormation, generatePatrol } from "./FormationGenerator";
import { mulberry32, seedFromCalendar } from "./SeedGenerator";

const PATTERNS: AttackPattern[] = ["column", "row", "random"];
const POWER_UPS: PowerUpType[] = ["rapid", "shield", "double"];

export interface GeneratedWorld {
  seed: number;
  sectors: Sector[];
  /** Total enemies that correspond to real contribution days. */
  contributionEnemies: number;
}

/**
 * Splits the calendar into sectors of `weeksPerSector` weeks and builds each
 * formation. Deterministic: identical input and generator version always give
 * identical output.
 */
export function generateWorld(
  username: string,
  weeks: ContributionWeek[],
  arena: Arena,
  weeksPerSector: number = CONFIG.sector.weeks,
): GeneratedWorld {
  const seed = seedFromCalendar(username, weeks);
  const rng = mulberry32(seed);
  const cells = flattenCalendar(weeks);
  const sectors: Sector[] = [];
  let contributionEnemies = 0;

  for (let start = 0, index = 0; start < weeks.length; start += weeksPerSector, index++) {
    const end = Math.min(weeks.length, start + weeksPerSector);
    const columns = end - start;
    const sectorCells = cells.filter((c) => c.week >= start && c.week < end);
    const difficulty = difficultyForSector(index);
    const formation = generateFormation(sectorCells, start, columns, index, difficulty, arena);
    const synthetic = formation.length === 0;
    const enemies = synthetic ? generatePatrol(index, difficulty, arena) : formation;
    if (!synthetic) contributionEnemies += enemies.length;

    // Always draw both values so the stream stays aligned across sectors.
    const patternRoll = rng();
    const powerRoll = rng();
    const first = sectorCells[0]?.day.date ?? "";
    const last = sectorCells[sectorCells.length - 1]?.day.date ?? "";

    sectors.push({
      index,
      weekStart: start,
      weekEnd: end,
      startDate: first,
      endDate: last,
      contributionTotal: sectorCells.reduce((sum, c) => sum + c.day.count, 0),
      synthetic,
      enemies,
      waveCount: enemies.reduce((max, e) => Math.max(max, e.wave), 0) + 1,
      attackPattern: PATTERNS[Math.floor(patternRoll * PATTERNS.length)],
      difficulty,
      powerUp:
        !synthetic && enemies.length >= 8 && powerRoll < 0.6
          ? POWER_UPS[Math.floor((powerRoll / 0.6) * POWER_UPS.length)]
          : null,
    });
  }

  if (sectors.length === 0) {
    const difficulty = difficultyForSector(0);
    sectors.push({
      index: 0,
      weekStart: 0,
      weekEnd: 0,
      startDate: "",
      endDate: "",
      contributionTotal: 0,
      synthetic: true,
      enemies: generatePatrol(0, difficulty, arena),
      waveCount: 1,
      attackPattern: "column",
      difficulty,
      powerUp: null,
    });
  }

  return { seed, sectors, contributionEnemies };
}

export function arenaForAspect(aspect: number): Arena {
  const portrait = aspect < 0.85;
  const size = portrait ? CONFIG.arena.portrait : CONFIG.arena.landscape;
  return { halfW: size.halfW, halfH: size.halfH, portrait };
}
