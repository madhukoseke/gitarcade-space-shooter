import type { GameResult } from "@/game/types/GameTypes";

export interface ShareInfo {
  username: string;
  simulated: boolean;
  result: GameResult;
}

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function formatScore(score: number): string {
  return Math.round(score).toLocaleString("en-US");
}

const pad2 = (n: number) => String(n).padStart(2, "0");

export function resultText({ username, simulated, result }: ShareInfo): string {
  const lines = [
    `GitArcade: Space Shooter — @${username}${simulated ? " (simulated demo data)" : ""}`,
    result.victory ? "Merge Conflict resolved. Victory!" : "Game over.",
    `Score ${formatScore(result.score)} · Sector ${pad2(result.sectorReached)}/${pad2(result.sectorCount)} · ` +
      `${result.kills} enemies · ${formatTime(result.time)} survived · rating ${result.rating}`,
    "Your contributions. Your battlefield.",
  ];
  return lines.join("\n");
}

function drawShip(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.shadowColor = "#56e0ff";
  ctx.shadowBlur = 30;
  // Thrusters
  ctx.fillStyle = "#56e0ff";
  for (const x of [-14, 14]) {
    ctx.beginPath();
    ctx.moveTo(x - 9, 62);
    ctx.lineTo(x + 9, 62);
    ctx.lineTo(x, 130);
    ctx.closePath();
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  // Wings
  ctx.fillStyle = "#c9d6e6";
  ctx.beginPath();
  ctx.moveTo(-18, 0);
  ctx.lineTo(-104, 52);
  ctx.lineTo(-92, 72);
  ctx.lineTo(-18, 52);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(104, 52);
  ctx.lineTo(92, 72);
  ctx.lineTo(18, 52);
  ctx.closePath();
  ctx.fill();
  // Neon wing edges
  ctx.strokeStyle = "#39d353";
  ctx.lineWidth = 5;
  ctx.shadowColor = "#39d353";
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.moveTo(-18, 0);
  ctx.lineTo(-104, 52);
  ctx.moveTo(18, 0);
  ctx.lineTo(104, 52);
  ctx.stroke();
  ctx.shadowBlur = 0;
  // Fuselage
  ctx.fillStyle = "#e3ecf7";
  ctx.beginPath();
  ctx.moveTo(0, -110);
  ctx.lineTo(26, 40);
  ctx.lineTo(20, 66);
  ctx.lineTo(-20, 66);
  ctx.lineTo(-26, 40);
  ctx.closePath();
  ctx.fill();
  // Cockpit
  ctx.fillStyle = "#56e0ff";
  ctx.beginPath();
  ctx.ellipse(0, -22, 10, 30, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Draws the share card on a canvas. Pure 2D canvas; nothing is uploaded. */
export function drawResultCard(canvas: HTMLCanvasElement, info: ShareInfo): void {
  const { username, simulated, result } = info;
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const bg = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  bg.addColorStop(0, "#04070f");
  bg.addColorStop(0.6, "#07122a");
  bg.addColorStop(1, "#0a1f1a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // Deterministic stars so the card looks the same every time.
  let seed = 9173;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = `rgba(220,235,255,${0.25 + rand() * 0.6})`;
    const r = rand() * 1.6 + 0.3;
    ctx.beginPath();
    ctx.arc(rand() * CARD_WIDTH, rand() * CARD_HEIGHT, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Contribution-style enemy blocks.
  const greens = ["#0e4429", "#006d32", "#26a641", "#39d353"];
  for (let c = 0; c < 9; c++) {
    for (let r = 0; r < 4; r++) {
      if (rand() < 0.3) continue;
      ctx.fillStyle = greens[Math.floor(rand() * greens.length)];
      ctx.fillRect(790 + c * 40, 70 + r * 40, 30, 30);
    }
  }
  drawShip(ctx, 950, 400, 1.15);
  ctx.strokeStyle = "#56e0ff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(950, 262);
  ctx.lineTo(950, 236);
  ctx.stroke();

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#39d353";
  ctx.font = "700 30px 'Arial Black', Arial, sans-serif";
  ctx.fillText("GITARCADE: SPACE SHOOTER", 70, 96);

  ctx.fillStyle = result.victory ? "#39d353" : "#ff5d84";
  ctx.font = "900 62px 'Arial Black', Arial, sans-serif";
  ctx.fillText(result.victory ? "VICTORY" : "GAME OVER", 70, 180);

  ctx.fillStyle = "#dbe7f7";
  ctx.font = "700 40px Menlo, Consolas, monospace";
  ctx.fillText(`@${username}`, 70, 244);
  if (simulated) {
    ctx.fillStyle = "#ffc94d";
    ctx.font = "700 22px Menlo, Consolas, monospace";
    ctx.fillText("SIMULATED DEMO DATA — NOT A GITHUB PROFILE", 70, 280);
  }

  ctx.fillStyle = "#8b9bb3";
  ctx.font = "700 24px Menlo, Consolas, monospace";
  ctx.fillText("SCORE", 70, 340);
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 84px 'Arial Black', Arial, sans-serif";
  ctx.fillText(formatScore(result.score), 70, 420);

  const stats: [string, string][] = [
    ["SECTOR", `${pad2(result.sectorReached)}/${pad2(result.sectorCount)}`],
    ["ENEMIES", String(result.kills)],
    ["SURVIVED", formatTime(result.time)],
    ["RATING", result.rating],
  ];
  stats.forEach(([label, value], i) => {
    const x = 70 + i * 170;
    ctx.fillStyle = "#8b9bb3";
    ctx.font = "700 20px Menlo, Consolas, monospace";
    ctx.fillText(label, x, 490);
    ctx.fillStyle = "#56e0ff";
    ctx.font = "700 38px Menlo, Consolas, monospace";
    ctx.fillText(value, x, 536);
  });

  ctx.fillStyle = "#8b9bb3";
  ctx.font = "400 20px Menlo, Consolas, monospace";
  ctx.fillText("Your contributions. Your battlefield.  ·  Local result, not verified or ranked.", 70, 592);
}

export function cardToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}
