import { CONFIG } from "../core/GameConfig";
import type { GameEngine } from "../core/GameEngine";
import type { Arena, InputState } from "../types/GameTypes";

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** Lowest player position. Portrait keeps the ship above the touch controls. */
export function playerMinY(arena: Arena): number {
  return -arena.halfH + (arena.portrait ? 3.6 : 0.9);
}

export function updatePlayerMovement(g: GameEngine, input: InputState, dt: number): void {
  const p = g.player;
  const c = CONFIG.player;
  p.invuln = Math.max(0, p.invuln - dt);
  p.dashCd = Math.max(0, p.dashCd - dt);
  p.hitFlash = Math.max(0, p.hitFlash - dt);
  p.shieldFlash = Math.max(0, p.shieldFlash - dt);
  p.rapidTime = Math.max(0, p.rapidTime - dt);
  p.doubleTime = Math.max(0, p.doubleTime - dt);
  if (!p.alive) return;

  let mx = clamp(input.moveX, -1, 1);
  let my = clamp(input.moveY, -1, 1);
  const len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  if (Math.abs(mx) > 0.1) p.lastDirX = Math.sign(mx);

  if (input.dash && !g.prevDash && p.dashCd <= 0 && p.dashTime <= 0) {
    if (len > 0.1) {
      p.dashDirX = mx / len;
      p.dashDirY = my / len;
    } else {
      p.dashDirX = p.lastDirX;
      p.dashDirY = 0;
    }
    p.dashTime = c.dashDuration;
    p.dashCd = c.dashCooldown;
    p.invuln = Math.max(p.invuln, c.dashInvuln);
    g.spawnBurst(p.x, p.y, 10, 4, 0.3, 0.9, 1, 0.12, 0.3);
    g.emit({ type: "dash", x: p.x, y: p.y });
  }

  if (p.dashTime > 0) {
    p.dashTime -= dt;
    p.vx = p.dashDirX * c.dashSpeed;
    p.vy = p.dashDirY * c.dashSpeed;
  } else {
    const k = Math.min(1, c.response * dt);
    p.vx += (mx * c.speed - p.vx) * k;
    p.vy += (my * c.speed - p.vy) * k;
  }

  p.x += p.vx * dt;
  p.y += p.vy * dt;
  const maxX = g.arena.halfW - 0.8;
  const minY = playerMinY(g.arena);
  if (p.x < -maxX) { p.x = -maxX; p.vx = 0; }
  if (p.x > maxX) { p.x = maxX; p.vx = 0; }
  if (p.y < minY) { p.y = minY; p.vy = 0; }
  if (p.y > c.maxY) { p.y = c.maxY; p.vy = 0; }

  // Slow shield regeneration after a period without damage.
  if (p.shieldDelay > 0) p.shieldDelay -= dt;
  else if (p.shield < c.maxShield) p.shield = Math.min(c.maxShield, p.shield + c.shieldRegenRate * dt);
}

/** Moves pooled projectiles, remembering the previous position for swept tests. */
export function updateProjectiles(g: GameEngine, dt: number): void {
  const limX = g.arena.halfW + 1.5;
  const limY = g.arena.halfH + 2;
  for (const s of g.shots) {
    if (!s.active) continue;
    s.px = s.x;
    s.py = s.y;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (s.y > limY || s.x < -limX || s.x > limX) s.active = false;
  }
  for (const b of g.bullets) {
    if (!b.active) continue;
    b.px = b.x;
    b.py = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.y < -limY || b.y > limY || b.x < -limX || b.x > limX) b.active = false;
  }
}

export function updateParticles(g: GameEngine, dt: number): void {
  for (const q of g.particles) {
    if (!q.active) continue;
    q.life -= dt;
    if (q.life <= 0) {
      q.active = false;
      continue;
    }
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    q.z += q.vz * dt;
    const drag = 1 - Math.min(1, 2.2 * dt);
    q.vx *= drag;
    q.vy *= drag;
    q.vz *= drag;
  }
}

export function updatePowerUps(g: GameEngine, dt: number): void {
  g.powerUpTimer += dt;
  for (const u of g.powerUps) {
    if (!u.active) continue;
    u.t += dt;
    u.y -= CONFIG.powerUps.fallSpeed * dt;
    if (u.y < -g.arena.halfH - 1.5) u.active = false;
  }
}
