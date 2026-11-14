import { describe, expect, it } from "vitest";
import { CONFIG } from "@/game/core/GameConfig";
import { enemyTypeForLevel, levelFromGitHub } from "@/game/generation/ContributionParser";
import { contributionBonus, difficultyForSector, enemyHealth } from "@/game/generation/DifficultyScaler";
import { arenaForAspect, generateWorld } from "@/game/generation/SectorGenerator";
import { mulberry32, seedFromCalendar } from "@/game/generation/SeedGenerator";
import { ENEMY_TYPES } from "@/game/types/EnemyTypes";
import { LANDSCAPE, PORTRAIT, makeWeeks } from "./helpers";

describe("contribution level mapping", () => {
  it("maps GitHub quartiles to 0-4", () => {
    expect(["NONE", "FIRST_QUARTILE", "SECOND_QUARTILE", "THIRD_QUARTILE", "FOURTH_QUARTILE"].map(levelFromGitHub)).toEqual([0, 1, 2, 3, 4]);
    expect(levelFromGitHub("SOMETHING_NEW")).toBe(0);
  });

  it("maps levels to enemy classes and leaves level 0 empty", () => {
    expect([0, 1, 2, 3, 4].map(enemyTypeForLevel)).toEqual([null, "drone", "scout", "armored", "elite"]);
    expect(enemyTypeForLevel(7)).toBeNull();
    expect(enemyTypeForLevel(1.5)).toBeNull();
  });
});

describe("formation generation", () => {
  const weeks = makeWeeks(8, (w, d) => ((w + d) % 5) as 0 | 1 | 2 | 3 | 4);
  const world = generateWorld("tester", weeks, LANDSCAPE);

  it("creates one enemy per non-empty day and none for level 0", () => {
    const expected = weeks.flatMap((w) => w.days).filter((d) => d.level > 0).length;
    expect(world.contributionEnemies).toBe(expected);
    for (const sector of world.sectors) {
      for (const e of sector.enemies) {
        expect(e.level).toBeGreaterThan(0);
        expect(e.type).toBe(enemyTypeForLevel(e.level));
        expect(e.synthetic).toBe(false);
      }
    }
  });

  it("keeps week on X and weekday on Y", () => {
    const enemies = world.sectors[0].enemies;
    for (const a of enemies) {
      for (const b of enemies) {
        if (a.col < b.col) expect(a.position.x).toBeLessThan(b.position.x);
        if (a.col === b.col) expect(a.position.x).toBeCloseTo(b.position.x);
        if (a.row < b.row) expect(a.position.y).toBeGreaterThan(b.position.y);
        if (a.row === b.row) expect(a.position.y).toBeCloseTo(b.position.y);
      }
    }
  });

  it("keeps every enemy inside the arena for both orientations", () => {
    for (const arena of [LANDSCAPE, PORTRAIT]) {
      const full = generateWorld("tester", makeWeeks(53, () => 4), arena);
      for (const sector of full.sectors) {
        for (const e of sector.enemies) {
          expect(Math.abs(e.position.x)).toBeLessThan(arena.halfW - 0.5);
          expect(e.position.y).toBeLessThan(arena.halfH);
          expect(e.position.y).toBeGreaterThan(0);
        }
      }
    }
  });

  it("picks the arena from the viewport aspect", () => {
    expect(arenaForAspect(16 / 9).portrait).toBe(false);
    expect(arenaForAspect(9 / 19).portrait).toBe(true);
  });
});

describe("sector generation", () => {
  it("splits the calendar into four-week sectors", () => {
    expect(generateWorld("t", makeWeeks(52, () => 1), LANDSCAPE).sectors).toHaveLength(13);
    expect(generateWorld("t", makeWeeks(53, () => 1), LANDSCAPE).sectors).toHaveLength(14);
    const sectors = generateWorld("t", makeWeeks(10, () => 1), LANDSCAPE).sectors;
    expect(sectors.map((s) => [s.weekStart, s.weekEnd])).toEqual([[0, 4], [4, 8], [8, 10]]);
  });

  it("splits dense sectors into waves without dropping cells", () => {
    const sector = generateWorld("t", makeWeeks(4, () => 2), LANDSCAPE).sectors[0];
    expect(sector.enemies).toHaveLength(28);
    expect(sector.waveCount).toBe(2);
    expect(sector.enemies.filter((e) => e.wave === 0).length).toBeLessThanOrEqual(CONFIG.sector.waveCap);
  });

  it("generates a labelled patrol for sectors without contributions", () => {
    const world = generateWorld("t", makeWeeks(8, (w) => (w < 4 ? 0 : 2)), LANDSCAPE);
    expect(world.sectors[0].synthetic).toBe(true);
    expect(world.sectors[0].enemies.length).toBeGreaterThan(0);
    expect(world.sectors[0].enemies.every((e) => e.synthetic && e.date === "" && e.contributionCount === 0)).toBe(true);
    expect(world.sectors[1].synthetic).toBe(false);
    expect(world.contributionEnemies).toBe(28);
  });

  it("still produces a playable world for an empty calendar", () => {
    expect(generateWorld("t", [], LANDSCAPE).sectors).toHaveLength(1);
    const empty = generateWorld("t", makeWeeks(52, () => 0), LANDSCAPE);
    expect(empty.contributionEnemies).toBe(0);
    expect(empty.sectors.every((s) => s.synthetic && s.enemies.length > 0)).toBe(true);
  });
});

describe("difficulty scaling", () => {
  it("increases with sector progress", () => {
    const early = difficultyForSector(0);
    const late = difficultyForSector(12);
    expect(late.healthMul).toBeGreaterThan(early.healthMul);
    expect(late.attackInterval).toBeLessThan(early.attackInterval);
    expect(late.maxAttackers).toBeGreaterThanOrEqual(early.maxAttackers);
  });

  it("is capped however far the game runs", () => {
    const extreme = difficultyForSector(1000);
    expect(extreme.healthMul).toBeLessThanOrEqual(CONFIG.enemyHealthCapMul);
    expect(extreme.maxAttackers).toBeLessThanOrEqual(4);
    expect(extreme.attackInterval).toBeGreaterThan(1);
    for (const type of ENEMY_TYPES) {
      expect(enemyHealth(type, extreme)).toBeLessThanOrEqual(CONFIG.enemies[type].health * CONFIG.enemyHealthCapMul);
    }
  });

  it("does not turn huge contribution counts into health or unbounded score", () => {
    const modest = generateWorld("t", makeWeeks(4, () => 4, () => 5), LANDSCAPE).sectors[0];
    const huge = generateWorld("t", makeWeeks(4, () => 4, () => 500), LANDSCAPE).sectors[0];
    expect(huge.enemies.map((e) => e.health)).toEqual(modest.enemies.map((e) => e.health));
    expect(huge.enemies.length).toBeLessThanOrEqual(CONFIG.sector.maxEnemies);
    expect(contributionBonus(500)).toBe(CONFIG.sector.contributionBonusCap);
    expect(contributionBonus(-3)).toBe(0);
  });
});

describe("seed reproducibility", () => {
  const weeks = makeWeeks(20, (w, d) => ((w * 3 + d) % 5) as 0 | 1 | 2 | 3 | 4);

  it("gives identical worlds for identical input", () => {
    expect(generateWorld("Tester", weeks, LANDSCAPE)).toEqual(generateWorld("tester", weeks, LANDSCAPE));
  });

  it("changes the seed when the data, user or version changes", () => {
    const seed = seedFromCalendar("tester", weeks);
    const altered = makeWeeks(20, (w, d) => ((w * 3 + d + 1) % 5) as 0 | 1 | 2 | 3 | 4);
    expect(seedFromCalendar("someone-else", weeks)).not.toBe(seed);
    expect(seedFromCalendar("tester", altered)).not.toBe(seed);
    expect(seedFromCalendar("tester", weeks, 999)).not.toBe(seed);
  });

  it("mulberry32 is deterministic and in range", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
