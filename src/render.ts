import {
  ENDZONE_YARDS,
  FIELD_H,
  FIELD_W,
  PLAY_YARDS,
  PX_PER_YARD,
  clamp,
  downWord,
  yardToX,
} from "./constants";
import { ROSTER } from "./data";
import { yardsNeededLabel } from "./match";
import type { Actor } from "./types";
import type { Game } from "./world";

const sprites = new Map<string, HTMLImageElement>();

export async function loadSprites(): Promise<void> {
  const names = [...ROSTER.map((p) => p.id), "football"];
  await Promise.all(
    names.map(
      (name) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            sprites.set(name, img);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = `./sprites/${name}.svg`;
        }),
    ),
  );
}

export function spriteOf(id: string): HTMLImageElement | undefined {
  return sprites.get(id);
}

export function renderGame(ctx: CanvasRenderingContext2D, game: Game, w: number, h: number): void {
  const scale = h / FIELD_H;
  const vis = w / scale;
  let camX: number;
  if (vis >= FIELD_W) camX = (FIELD_W - vis) / 2;
  else camX = clamp(game.ball.x - vis / 2, 0, FIELD_W - vis);

  const sx = game.shake ? (Math.random() - 0.5) * game.shake : 0;
  const sy = game.shake ? (Math.random() - 0.5) * game.shake : 0;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.setTransform(scale, 0, 0, scale, -camX * scale + sx, sy);

  drawField(ctx, game);
  drawPlayers(ctx, game);
  drawBall(ctx, game);
  drawParticles(ctx, game);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawBanner(ctx, game, w, h);
  if (game.phase === "presnap") drawSnapHint(ctx, w, h, game);
}

function drawField(ctx: CanvasRenderingContext2D, game: Game): void {
  const stripe = 5 * PX_PER_YARD;
  for (let x = 0; x < FIELD_W; x += stripe) {
    ctx.fillStyle = (x / stripe) % 2 === 0 ? "#2f8a3a" : "#277a32";
    ctx.fillRect(x, 0, stripe, FIELD_H);
  }

  const leftEz = ENDZONE_YARDS * PX_PER_YARD;
  const rightEz = (ENDZONE_YARDS + PLAY_YARDS) * PX_PER_YARD;
  ctx.fillStyle = "rgba(40, 90, 180, 0.45)";
  ctx.fillRect(0, 0, leftEz, FIELD_H);
  ctx.fillStyle = "rgba(180, 40, 40, 0.45)";
  ctx.fillRect(rightEz, 0, FIELD_W - rightEz, FIELD_H);

  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = `700 ${PX_PER_YARD * 3.2}px Teko, sans-serif`;
  ctx.textAlign = "center";
  ctx.save();
  ctx.translate(leftEz / 2, FIELD_H / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("YOU", 0, 12);
  ctx.restore();
  ctx.save();
  ctx.translate((rightEz + FIELD_W) / 2, FIELD_H / 2);
  ctx.rotate(Math.PI / 2);
  ctx.fillText("CPU", 0, 12);
  ctx.restore();

  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 3;
  for (let y = 0; y <= PLAY_YARDS; y += 10) {
    const x = yardToX(y);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, FIELD_H);
    ctx.stroke();
  }

  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  for (let y = 0; y <= PLAY_YARDS; y += 1) {
    const x = yardToX(y);
    const len = y % 5 === 0 ? 18 : 10;
    ctx.beginPath();
    ctx.moveTo(x, FIELD_H * 0.33);
    ctx.lineTo(x, FIELD_H * 0.33 + len);
    ctx.moveTo(x, FIELD_H * 0.67);
    ctx.lineTo(x, FIELD_H * 0.67 - len);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.font = `600 ${PX_PER_YARD * 2}px Teko, sans-serif`;
  ctx.textAlign = "center";
  const marks = [
    [10, 10],
    [20, 20],
    [30, 30],
    [40, 40],
    [50, 50],
    [60, 40],
    [70, 30],
    [80, 20],
    [90, 10],
  ] as const;
  for (const [yard, label] of marks) {
    const x = yardToX(yard);
    ctx.save();
    ctx.translate(x - 14, FIELD_H * 0.18);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(String(label), 0, 0);
    ctx.restore();
    ctx.save();
    ctx.translate(x + 14, FIELD_H * 0.82);
    ctx.rotate(Math.PI / 2);
    ctx.fillText(String(label), 0, 0);
    ctx.restore();
  }

  const los = yardToX(game.match.losYard);
  ctx.strokeStyle = "#7ec8ff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(los, 0);
  ctx.lineTo(los, FIELD_H);
  ctx.stroke();

  const fd = yardToX(game.match.firstDownYard);
  ctx.strokeStyle = "#f4d35e";
  ctx.lineWidth = 4;
  ctx.setLineDash([14, 10]);
  ctx.beginPath();
  ctx.moveTo(fd, 0);
  ctx.lineTo(fd, FIELD_H);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(0, 0, FIELD_W, 10);
  ctx.fillRect(0, FIELD_H - 10, FIELD_W, 10);
}

function drawPlayers(ctx: CanvasRenderingContext2D, game: Game): void {
  const sorted = [...game.players].sort((a, b) => a.y - b.y);
  for (const p of sorted) {
    drawActor(ctx, game, p);
  }
}

function drawActor(ctx: CanvasRenderingContext2D, game: Game, p: Actor): void {
  const bob = Math.sin(p.bob * 6) * (2 + Math.hypot(p.vx, p.vy) / 120);
  const team = p.team === "player" ? "#3d9bff" : "#ff5a5a";
  ctx.save();
  ctx.translate(p.x, p.y);

  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse(0, p.radius * 0.72, p.radius * 0.7, p.radius * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();

  if (p.id === game.controlId) {
    ctx.strokeStyle = "#f4d35e";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(0, 8, p.radius + 10, p.radius * 0.45, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (p.id === game.selectedRecvId && game.match.possession === "player") {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.ellipse(0, 8, p.radius + 8, p.radius * 0.4, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.fillStyle = team;
  ctx.beginPath();
  ctx.arc(0, 10, p.radius + 2, 0, Math.PI * 2);
  ctx.fill();

  const img = sprites.get(p.pokemon.id);
  const size = p.radius * 2.35;
  ctx.save();
  if (p.unstoppable) ctx.globalAlpha = 0.55;
  if (p.facing < 0) ctx.scale(-1, 1);
  if (img) ctx.drawImage(img, -size / 2, -size + 8 + bob, size, size);
  else {
    ctx.fillStyle = p.pokemon.color;
    ctx.beginPath();
    ctx.arc(0, bob - 4, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  if (p.wall) {
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius + 8, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(8,16,10,0.7)";
  ctx.fillRect(-34, -p.radius - 22, 68, 14);
  ctx.fillStyle = "#fff";
  ctx.font = "700 11px Nunito, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(p.pokemon.name, 0, -p.radius - 11);

  const cd = p.pokemon.ability.cooldown;
  const ready = p.abilityCd <= 0;
  ctx.fillStyle = ready ? "#7dff9a" : "#38543c";
  ctx.fillRect(-24, p.radius + 8, 48, 5);
  if (!ready) {
    ctx.fillStyle = "#f4d35e";
    ctx.fillRect(-24, p.radius + 8, 48 * (1 - p.abilityCd / cd), 5);
  }

  ctx.restore();
}

function drawBall(ctx: CanvasRenderingContext2D, game: Game): void {
  const b = game.ball;
  const img = sprites.get("football");
  const air = b.state === "air";
  const z = air ? Math.sin((b.t / Math.max(0.05, b.flight)) * Math.PI) * 28 : 0;
  ctx.save();
  ctx.translate(b.x, b.y - z);
  if (air) {
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(0, z + 10, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.rotate(air ? b.t * 10 : 0.4);
  if (img) ctx.drawImage(img, -16, -10, 32, 20);
  else {
    ctx.fillStyle = "#8B4E28";
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  if (game.match.possession === "player" && game.ball.state === "held") {
    const recv = game.actor(game.selectedRecvId);
    const from = game.ballCarrier();
    if (recv && from) {
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.setLineDash([8, 8]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(recv.x, recv.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, game: Game): void {
  for (const p of game.particles) {
    ctx.globalAlpha = Math.max(0, p.life / 0.8);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
    ctx.globalAlpha = 1;
  }
}

function drawBanner(ctx: CanvasRenderingContext2D, game: Game, w: number, h: number): void {
  if (!game.banner) return;
  const alpha = Math.min(1, game.banner.life * 2);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(0, h * 0.36, w, 88);
  ctx.fillStyle = game.banner.color;
  ctx.textAlign = "center";
  ctx.font = "800 48px Lilita One, sans-serif";
  ctx.fillText(game.banner.text, w / 2, h * 0.36 + 52);
  if (game.banner.sub) {
    ctx.font = "700 18px Nunito, sans-serif";
    ctx.fillStyle = "#fff";
    ctx.fillText(game.banner.sub, w / 2, h * 0.36 + 76);
  }
  ctx.restore();
}

function drawSnapHint(ctx: CanvasRenderingContext2D, w: number, h: number, game: Game): void {
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(w / 2 - 160, h - 78, 320, 36);
  ctx.fillStyle = "#f4d35e";
  ctx.textAlign = "center";
  ctx.font = "700 16px Nunito, sans-serif";
  const extra =
    game.match.possession === "player"
      ? "Hike to snap  ·  You are the quarterback"
      : "CPU will hike  ·  You are on defense";
  ctx.fillText(extra, w / 2, h - 54);
}

export function clockLabel(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function downLine(game: Game): string {
  return `${downWord(game.match.down)} & ${yardsNeededLabel(game.match)}`;
}
