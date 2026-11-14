import { describe, expect, it } from "vitest";
import { CONFIG } from "@/game/core/GameConfig";
import { damagePlayer } from "@/game/systems/DamageSystem";
import { createInput } from "@/game/types/GameTypes";
import { createDemoProfile } from "@/lib/github/demo";
import { DT, PORTRAIT, botInput, makeEngine, makeWeeks, stepFor } from "./helpers";

const oneEnemy = () => makeWeeks(4, (w, d) => (w === 1 && d === 3 ? 1 : 0));

describe("player movement", () => {
  it("responds to input and stays inside the arena", () => {
    const engine = makeEngine(oneEnemy());
    const input = createInput();
    input.moveX = 1;
    stepFor(engine, 0.1, input);
    expect(engine.player.x).toBeGreaterThan(0.5);
    stepFor(engine, 5, input);
    expect(engine.player.x).toBeLessThanOrEqual(engine.arena.halfW - 0.8 + 1e-6);
    input.moveX = 0;
    input.moveY = 1;
    stepFor(engine, 5, input);
    expect(engine.player.y).toBeCloseTo(CONFIG.player.maxY);
    input.moveY = 0;
    stepFor(engine, 0.3, input);
    expect(Math.abs(engine.player.vy)).toBeLessThan(0.1);
  });

  it("dashes with a cooldown and brief invulnerability", () => {
    const engine = makeEngine(oneEnemy());
    const input = createInput();
    input.dash = true;
    input.moveX = -1;
    engine.step(DT, input);
    expect(engine.player.dashCd).toBeGreaterThan(0);
    expect(engine.player.invuln).toBeGreaterThan(0);
    const before = engine.player.x;
    stepFor(engine, CONFIG.player.dashDuration, input);
    expect(before - engine.player.x).toBeGreaterThan(3);
  });
});

describe("shooting and collisions", () => {
  it("destroys an enemy, scores, and applies each projectile once", () => {
    const engine = makeEngine(oneEnemy());
    const enemy = engine.enemies.find((e) => e.active)!;
    const input = createInput();
    engine.player.x = enemy.x;
    engine.attackTimer = 999;
    input.fire = true;
    const events: string[] = [];
    engine.on((e) => events.push(e.type));
    engine.step(DT, input);
    input.fire = false;
    expect(engine.shots.filter((s) => s.active)).toHaveLength(1);
    stepFor(engine, 1, input);
    // One laser = 10 damage against a 20-health drone: hit once, not destroyed.
    expect(enemy.active).toBe(true);
    expect(enemy.hp).toBe(enemy.maxHp - CONFIG.weapons.laser.damage);
    expect(engine.shots.some((s) => s.active)).toBe(false);
    expect(engine.stats.shotsHit).toBe(1);

    input.fire = true;
    stepFor(engine, 1, input);
    expect(enemy.active).toBe(false);
    expect(engine.stats.kills).toBe(1);
    expect(engine.stats.score).toBeGreaterThanOrEqual(CONFIG.enemies.drone.score);
    expect(events).toContain("enemyDown");
  });

  it("despawns projectiles that leave the arena", () => {
    const engine = makeEngine(oneEnemy());
    const input = createInput();
    engine.player.x = -10;
    input.fire = true;
    engine.step(DT, input);
    input.fire = false;
    stepFor(engine, 2, input);
    expect(engine.shots.some((s) => s.active)).toBe(false);
    expect(engine.stats.shotsHit).toBe(0);
  });

  it("plasma damages neighbours in its blast radius", () => {
    const engine = makeEngine(makeWeeks(4, (w, d) => (w === 1 && (d === 5 || d === 6) ? 1 : 0)));
    const lowest = engine.enemies.filter((e) => e.active).sort((a, b) => a.y - b.y)[0];
    const input = createInput();
    engine.player.x = lowest.x;
    engine.attackTimer = 999;
    input.plasma = true;
    engine.step(DT, input);
    input.plasma = false;
    stepFor(engine, 1.5, input);
    expect(engine.enemies.filter((e) => e.active)).toHaveLength(0);
    expect(engine.stats.kills).toBe(2);
  });

  it("Code Storm needs full energy, hits nearby enemies and clears bullets", () => {
    const engine = makeEngine(makeWeeks(4, () => 1));
    const input = createInput();
    input.special = true;
    engine.step(DT, input);
    expect(engine.storm.active).toBe(false);
    input.special = false;
    engine.step(DT, input);

    engine.player.energy = 100;
    engine.player.y = CONFIG.player.maxY;
    engine.spawnBullet("bullet", engine.player.x + 3, engine.player.y + 3, 0, 0, 12, 0.2);
    input.special = true;
    engine.step(DT, input);
    expect(engine.storm.active).toBe(true);
    expect(engine.player.energy).toBeLessThan(100);
    expect(engine.bullets.some((b) => b.active)).toBe(false);
    expect(engine.stats.kills).toBeGreaterThan(0);
  });
});

describe("damage rules", () => {
  it("drains shield first, then health, with invulnerability after a hit", () => {
    const engine = makeEngine(oneEnemy());
    const p = engine.player;
    expect(damagePlayer(engine, 30)).toBe(true);
    expect(p.shield).toBe(CONFIG.player.maxShield - 30);
    expect(p.health).toBe(CONFIG.player.maxHealth);
    expect(damagePlayer(engine, 30)).toBe(false); // still invulnerable
    p.invuln = 0;
    damagePlayer(engine, 30);
    expect(p.shield).toBe(0);
    expect(p.health).toBe(CONFIG.player.maxHealth - 10);
    expect(engine.stats.damageTaken).toBe(60);
  });

  it("consumes lives and ends the game when none remain", () => {
    const engine = makeEngine(oneEnemy());
    const p = engine.player;
    const events: string[] = [];
    engine.on((e) => events.push(e.type));
    for (let life = CONFIG.player.lives; life > 1; life--) {
      p.invuln = 0;
      damagePlayer(engine, 1000);
      expect(p.lives).toBe(life - 1);
      expect(p.health).toBe(CONFIG.player.maxHealth);
      expect(engine.status).toBe("running");
    }
    p.invuln = 0;
    damagePlayer(engine, 1000);
    expect(p.lives).toBe(0);
    expect(engine.status).toBe("gameOver");
    expect(events.filter((e) => e === "lifeLost")).toHaveLength(CONFIG.player.lives - 1);
    expect(events).toContain("gameOver");
    expect(engine.result().victory).toBe(false);
  });

  it("an enemy bullet damages the player exactly once", () => {
    const engine = makeEngine(oneEnemy());
    const p = engine.player;
    engine.attackTimer = 999;
    for (const e of engine.enemies) e.fireCd = 999;
    engine.spawnBullet("bullet", p.x, p.y + 2, 0, -8, 12, 0.2);
    stepFor(engine, 1);
    expect(p.shield).toBe(CONFIG.player.maxShield - 12);
    expect(engine.bullets.some((b) => b.active)).toBe(false);
  });

  it("power-ups apply their effect when collected", () => {
    const engine = makeEngine(oneEnemy());
    const p = engine.player;
    engine.spawnPowerUp("rapid", p.x, p.y + 0.5);
    stepFor(engine, 0.5);
    expect(p.rapidTime).toBeGreaterThan(0);
    engine.spawnPowerUp("double", p.x, p.y + 0.5);
    stepFor(engine, 0.5);
    expect(p.doubleTime).toBeGreaterThan(0);
    p.shield = 0;
    p.shieldDelay = 99;
    engine.spawnPowerUp("shield", p.x, p.y + 0.5);
    stepFor(engine, 0.5);
    expect(p.shield).toBe(CONFIG.powerUps.shieldRestore);
  });
});

describe("engine lifecycle", () => {
  it("is deterministic for identical inputs", () => {
    const weeks = createDemoProfile().calendar.weeks;
    const a = makeEngine(weeks);
    const b = makeEngine(weeks);
    const ia = createInput();
    const ib = createInput();
    for (let i = 0; i < 60 * 40; i++) {
      a.step(DT, botInput(a, ia));
      b.step(DT, botInput(b, ib));
    }
    expect(a.stats).toEqual(b.stats);
    expect(a.player).toEqual(b.player);
    expect(a.enemies.map((e) => [e.active, e.x, e.y, e.hp])).toEqual(b.enemies.map((e) => [e.active, e.x, e.y, e.hp]));
  });

  it("uses bounded fixed steps regardless of frame time", () => {
    const engine = makeEngine(oneEnemy());
    engine.update(10, createInput());
    expect(engine.stats.time).toBeCloseTo(CONFIG.maxStepsPerFrame * CONFIG.fixedDt);
    engine.update(0, createInput());
    expect(engine.stats.time).toBeCloseTo(CONFIG.maxStepsPerFrame * CONFIG.fixedDt);
  });

  it("restart resets every gameplay system", () => {
    const engine = makeEngine(createDemoProfile().calendar.weeks);
    const input = createInput();
    for (let i = 0; i < 60 * 30; i++) engine.step(DT, botInput(engine, input));
    engine.debugKillPlayer();
    expect(engine.status).toBe("gameOver");
    const frozen = engine.stats.time;
    stepFor(engine, 1);
    expect(engine.stats.time).toBe(frozen); // simulation stops after game over

    engine.reset();
    expect(engine.status).toBe("running");
    expect(engine.sectorIndex).toBe(0);
    expect(engine.stats.score).toBe(0);
    expect(engine.stats.time).toBe(0);
    expect(engine.player.lives).toBe(CONFIG.player.lives);
    expect(engine.player.health).toBe(CONFIG.player.maxHealth);
    expect(engine.shots.some((s) => s.active)).toBe(false);
    expect(engine.bullets.some((b) => b.active)).toBe(false);
    expect(engine.boss.active).toBe(false);
    expect(engine.enemies.filter((e) => e.active)).toHaveLength(engine.sectors[0].enemies.filter((e) => e.wave === 0).length);
  });

  it("an idle player eventually loses", () => {
    const engine = makeEngine(makeWeeks(8, () => 3));
    const input = createInput();
    let steps = 0;
    while (engine.status === "running" && steps < 60 * 600) {
      engine.step(DT, input);
      steps++;
    }
    expect(engine.status).toBe("gameOver");
  });

  it.each([["landscape", undefined], ["portrait", PORTRAIT]] as const)(
    "can be played from the first sector through the boss to victory (%s)",
    (_name, arena) => {
      const profile = createDemoProfile();
      const engine = makeEngine(profile.calendar.weeks, arena, profile.username);
      const input = createInput();
      const seen = new Set<string>();
      engine.on((e) => seen.add(e.type));
      let steps = 0;
      while (engine.status === "running" && steps < 60 * 60 * 20) {
        engine.step(DT, botInput(engine, input));
        steps++;
      }
      const result = engine.result();
      expect(engine.status).toBe("victory");
      expect(result.victory).toBe(true);
      expect(result.sectorsCompleted).toBe(engine.sectors.length);
      expect(result.score).toBeGreaterThan(engine.parScore * 0.9);
      for (const type of ["sectorStart", "sectorClear", "bossWarning", "bossAppear", "bossPhase", "beamWarn", "bossDown", "victory"]) {
        expect(seen.has(type), type).toBe(true);
      }
    },
  );
});
