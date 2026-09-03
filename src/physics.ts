import { FIELD_H, FIELD_W, hypot } from "./constants";
import type { Actor } from "./types";

export function topSpeed(actor: Actor): number {
  let spd = 155 + actor.pokemon.speed * 30;
  if (actor.hasBall) spd *= 0.9;
  if (actor.wall) spd *= 0.12;
  if (actor.stunned > 0) spd *= 0.22;
  return spd * actor.speedMul;
}

export function drive(actor: Actor, ax: number, ay: number, dt: number): void {
  if (actor.stunned > 0 || actor.lunge > 0) return;
  const mag = hypot(ax, ay);
  const max = topSpeed(actor);
  if (mag < 0.1) {
    const damp = Math.pow(0.05, dt);
    actor.vx *= damp;
    actor.vy *= damp;
    return;
  }
  const nx = ax / mag;
  const ny = ay / mag;
  const accel = actor.wall ? 400 : 1600;
  actor.vx += nx * accel * dt;
  actor.vy += ny * accel * dt;
  const sp = hypot(actor.vx, actor.vy);
  if (sp > max) {
    actor.vx *= max / sp;
    actor.vy *= max / sp;
  }
  if (Math.abs(actor.vx) > 12) actor.facing = actor.vx >= 0 ? 1 : -1;
}

export function seek(actor: Actor, tx: number, ty: number, dt: number, mul = 1): void {
  const dx = tx - actor.x;
  const dy = ty - actor.y;
  const d = hypot(dx, dy);
  if (d < 4) {
    drive(actor, 0, 0, dt);
    return;
  }
  drive(actor, (dx / d) * mul, (dy / d) * mul, dt);
}

export function integrate(actor: Actor, dt: number): void {
  actor.x += actor.vx * dt;
  actor.y += actor.vy * dt;
  actor.x = Math.max(actor.radius + 4, Math.min(FIELD_W - actor.radius - 4, actor.x));
  actor.y = Math.max(actor.radius + 6, Math.min(FIELD_H - actor.radius - 6, actor.y));
  actor.bob += dt * (4 + hypot(actor.vx, actor.vy) / 80);
}

export function separate(a: Actor, b: Actor): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = hypot(dx, dy) || 0.001;
  const min = a.radius + b.radius;
  if (dist >= min) return;
  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = min - dist;
  const massA = a.wall ? 40 : a.pokemon.mass;
  const massB = b.wall ? 40 : b.pokemon.mass;
  const sum = massA + massB;
  a.x -= nx * overlap * (massB / sum);
  a.y -= ny * overlap * (massB / sum);
  b.x += nx * overlap * (massA / sum);
  b.y += ny * overlap * (massA / sum);
}

export function collideAll(players: Actor[]): void {
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      separate(players[i], players[j]);
    }
  }
}
