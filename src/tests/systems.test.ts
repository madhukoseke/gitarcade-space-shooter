import { describe, expect, it } from "vitest";
import { circlesOverlap, segmentCircleHit } from "@/game/core/CollisionSystem";
import { CONFIG } from "@/game/core/GameConfig";
import { canTransition, nextPhase, type GamePhase } from "@/game/core/GamePhase";
import {
  accuracy, computeRating, createStats, multiplierForCombo, reduceComboOnDamage, registerKill, tickCombo,
} from "@/game/systems/ScoringSystem";

describe("collision detection", () => {
  it("detects overlapping circles", () => {
    expect(circlesOverlap(0, 0, 1, 1.5, 0, 1)).toBe(true);
    expect(circlesOverlap(0, 0, 1, 2.5, 0, 1)).toBe(false);
  });

  it("finds the first hit of a segment on a circle", () => {
    expect(segmentCircleHit(0, -5, 0, 5, 0, 0, 1)).toBeCloseTo(0.4);
    expect(segmentCircleHit(3, -5, 3, 5, 0, 0, 1)).toBe(-1);
    expect(segmentCircleHit(0, 0.2, 0, 5, 0, 0, 1)).toBe(0);
    expect(segmentCircleHit(0, -5, 0, -3, 0, 0, 1)).toBe(-1);
  });

  it("does not let a very fast projectile tunnel through a small target", () => {
    // 200 units in one step past a 0.4-radius enemy.
    expect(segmentCircleHit(0, -100, 0, 100, 0.1, 0, 0.4)).toBeGreaterThan(0);
  });
});

describe("scoring", () => {
  it("awards base points and builds a combo multiplier", () => {
    const stats = createStats();
    expect(registerKill(stats, 100)).toBe(100);
    expect(registerKill(stats, 200)).toBe(200);
    expect(registerKill(stats, 100)).toBe(200); // third kill reaches x2
    expect(stats.score).toBe(500);
    expect(stats.kills).toBe(3);
    expect(stats.maxCombo).toBe(3);
  });

  it("caps the multiplier", () => {
    expect(multiplierForCombo(0)).toBe(1);
    expect(multiplierForCombo(10_000)).toBe(CONFIG.combo.maxMultiplier);
  });

  it("resets the combo after inactivity and halves it on damage", () => {
    const stats = createStats();
    for (let i = 0; i < 8; i++) registerKill(stats, 100);
    reduceComboOnDamage(stats);
    expect(stats.combo).toBe(4);
    tickCombo(stats, CONFIG.combo.window + 0.1);
    expect(stats.combo).toBe(0);
    expect(stats.multiplier).toBe(1);
    expect(stats.maxCombo).toBe(8);
  });

  it("computes accuracy and a par-normalised rating", () => {
    const stats = createStats();
    expect(accuracy(stats)).toBe(0);
    stats.shotsFired = 10;
    stats.shotsHit = 7;
    expect(accuracy(stats)).toBeCloseTo(0.7);
    // The same ratio earns the same rating whatever the calendar size.
    expect(computeRating(2_000, 1_000)).toBe(computeRating(200_000, 100_000));
    expect(computeRating(0, 1_000)).toBe("D");
    expect(computeRating(5_000, 1_000)).toBe("S");
  });
});

describe("game phase machine", () => {
  it("allows the documented flow", () => {
    const flow: GamePhase[] = ["IDLE", "LOADING_GITHUB", "GENERATING_WORLD", "INTRO", "READY", "PLAYING", "PAUSED", "PLAYING", "GAME_OVER", "READY", "PLAYING", "VICTORY"];
    for (let i = 1; i < flow.length; i++) expect(canTransition(flow[i - 1], flow[i])).toBe(true);
  });

  it("blocks illegal jumps", () => {
    expect(canTransition("IDLE", "PLAYING")).toBe(false);
    expect(canTransition("GAME_OVER", "PLAYING")).toBe(false);
    expect(canTransition("PAUSED", "VICTORY")).toBe(false);
    expect(nextPhase("INTRO", "PAUSED")).toBe("INTRO");
    expect(nextPhase("PLAYING", "PAUSED")).toBe("PAUSED");
  });
});
