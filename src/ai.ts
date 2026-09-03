import { FIELD_H, HANDOFF_RANGE, PX_PER_YARD, hypot } from "./constants";
import { attackDir } from "./match";
import { seek } from "./physics";
import type { Actor, Ball } from "./types";
import type { TeamId } from "./types";

export interface Sim {
  players: Actor[];
  controlId: string;
  playTime: number;
  possession: TeamId;
  down: number;
  ball: Ball;
  throwTo(from: Actor, to: Actor): void;
  tryHandoff(from: Actor, to: Actor): boolean;
  lungeAt(actor: Actor, target: Actor): void;
}

export function think(sim: Sim, dt: number): void {
  const offense = sim.players.filter((p) => p.team === sim.possession);
  const defense = sim.players.filter((p) => p.team !== sim.possession);
  const carrier = offense.find((p) => p.hasBall) ?? null;

  for (const actor of sim.players) {
    if (actor.id === sim.controlId) continue;
    if (actor.team === sim.possession) {
      runOffense(sim, actor, carrier, dt);
    } else {
      runDefense(sim, actor, carrier, offense, dt);
    }
  }

  const cpuQb = offense.find((p) => p.role === "qb" && p.team === "cpu" && p.hasBall);
  if (cpuQb && sim.playTime > 0.55) cpuQuarterback(sim, cpuQb, offense, defense);
}

function runOffense(sim: Sim, actor: Actor, carrier: Actor | null, dt: number): void {
  if (actor.hasBall) {
    if (actor.team === "cpu") scramble(sim, actor, dt);
    return;
  }

  if (sim.ball.state === "air" && sim.ball.targetId === actor.id) {
    seek(actor, sim.ball.x, sim.ball.y, dt, 1.2);
    return;
  }

  if (actor.role === "rb" && sim.playTime < 0.85 && carrier) {
    const rusher = closest(
      actor,
      sim.players.filter((p) => p.team !== actor.team && p.role === "rusher"),
    );
    if (rusher) {
      seek(actor, (rusher.x + carrier.x) / 2, (rusher.y + carrier.y) / 2, dt, 1.05);
      return;
    }
  }

  followRoute(actor, dt);
}

function followRoute(actor: Actor, dt: number): void {
  const wp = actor.route[actor.routeI];
  if (!wp) {
    const dir = attackDir(actor.team);
    seek(actor, actor.x + dir * 50, actor.y, dt, 0.45);
    return;
  }
  seek(actor, wp.x, wp.y, dt, 1);
  if (hypot(actor.x - wp.x, actor.y - wp.y) < 20) actor.routeI += 1;
}

function scramble(sim: Sim, qb: Actor, dt: number): void {
  const dir = attackDir(qb.team);
  const threat = closest(
    qb,
    sim.players.filter((p) => p.team !== qb.team),
  );
  let tx = qb.x + dir * 80;
  let ty = qb.y;
  if (threat && hypot(threat.x - qb.x, threat.y - qb.y) < 90) {
    const away = qb.y >= threat.y ? 1 : -1;
    tx = qb.x + dir * 40;
    ty = qb.y + away * 70;
  }
  seek(qb, tx, ty, dt, 1);
}

function cpuQuarterback(sim: Sim, qb: Actor, offense: Actor[], defense: Actor[]): void {
  if (sim.ball.state !== "held") return;
  const wr = offense.find((p) => p.role === "wr");
  const rb = offense.find((p) => p.role === "rb");
  const rusher = closest(qb, defense);
  const pressure = rusher ? hypot(rusher.x - qb.x, rusher.y - qb.y) : 999;
  const dir = attackDir("cpu");

  const wrOpen = wr ? openness(wr, defense) : 0;
  const rbOpen = rb ? openness(rb, defense) : 0;
  const lane = !defense.some(
    (d) => Math.abs(d.y - qb.y) < 36 && (d.x - qb.x) * dir > 8 && (d.x - qb.x) * dir < 90,
  );

  if (pressure < 48 && wr && wrOpen > 42) {
    sim.throwTo(qb, wr);
    return;
  }
  if (wr && wrOpen > 70 && sim.playTime > 1.1) {
    sim.throwTo(qb, wr);
    return;
  }
  if (rb && hypot(rb.x - qb.x, rb.y - qb.y) < HANDOFF_RANGE && (pressure < 70 || sim.down >= 3)) {
    if (sim.tryHandoff(qb, rb)) return;
  }
  if (rb && rbOpen > 55 && pressure < 60 && sim.playTime > 0.9) {
    sim.throwTo(qb, rb);
    return;
  }
  if (lane && pressure > 55) return;
  if (pressure < 40 && wr) sim.throwTo(qb, wr);
}

function runDefense(
  sim: Sim,
  actor: Actor,
  carrier: Actor | null,
  offense: Actor[],
  dt: number,
): void {
  if (sim.ball.state === "air") {
    seek(actor, sim.ball.x, sim.ball.y, dt, actor.role === "cb" ? 1.1 : 0.95);
    return;
  }
  if (!carrier) return;

  if (actor.role === "rusher") {
    seek(actor, carrier.x, carrier.y, dt, 1.05);
    if (
      sim.playTime > 0.7 &&
      hypot(actor.x - carrier.x, actor.y - carrier.y) < 64 &&
      Math.random() < dt * 1.6
    ) {
      sim.lungeAt(actor, carrier);
    }
    return;
  }

  const mark = offense.find((p) => p.id === actor.coverId) ?? (actor.role === "cb" ? offense.find((p) => p.role === "wr") : offense.find((p) => p.role === "rb"));
  if (carrier.hasBall && (carrier.role === "qb" || hypot(actor.x - carrier.x, actor.y - carrier.y) < 80) && actor.role === "lb") {
    seek(actor, carrier.x, carrier.y, dt, 0.95);
    return;
  }
  if (mark) {
    const dir = attackDir(sim.possession);
    seek(actor, mark.x + dir * 26, mark.y, dt, 1);
  } else {
    seek(actor, carrier.x, carrier.y, dt, 0.9);
  }
}

function closest(from: Actor, pool: Actor[]): Actor | null {
  let best: Actor | null = null;
  let bestD = Infinity;
  for (const p of pool) {
    const d = hypot(p.x - from.x, p.y - from.y);
    if (d < bestD) {
      best = p;
      bestD = d;
    }
  }
  return best;
}

function openness(recv: Actor, defense: Actor[]): number {
  let nearest = Infinity;
  for (const d of defense) {
    nearest = Math.min(nearest, hypot(d.x - recv.x, d.y - recv.y));
  }
  return nearest;
}

export function assignRoutes(offense: Actor[]): void {
  const wr = offense.find((p) => p.role === "wr");
  const rb = offense.find((p) => p.role === "rb");
  const dir = offense[0] ? attackDir(offense[0].team) : 1;
  const kind = Math.random();
  if (wr) {
    if (kind < 0.34) {
      wr.route = [
        { x: wr.x + dir * 8 * PX_PER_YARD, y: wr.y },
        { x: wr.x + dir * 24 * PX_PER_YARD, y: wr.y },
        { x: wr.x + dir * 36 * PX_PER_YARD, y: wr.y },
      ];
    } else if (kind < 0.67) {
      const inY = wr.y < FIELD_H / 2 ? wr.y + 11 * PX_PER_YARD : wr.y - 11 * PX_PER_YARD;
      wr.route = [
        { x: wr.x + dir * 4 * PX_PER_YARD, y: wr.y },
        { x: wr.x + dir * 14 * PX_PER_YARD, y: inY },
        { x: wr.x + dir * 24 * PX_PER_YARD, y: inY },
      ];
    } else {
      const outY = wr.y < FIELD_H / 2 ? 14 * PX_PER_YARD : FIELD_H - 14 * PX_PER_YARD;
      wr.route = [
        { x: wr.x + dir * 9 * PX_PER_YARD, y: wr.y },
        { x: wr.x + dir * 11 * PX_PER_YARD, y: outY },
      ];
    }
    wr.routeI = 0;
  }
  if (rb) {
    const swingY = rb.y < FIELD_H / 2 ? 15 * PX_PER_YARD : FIELD_H - 15 * PX_PER_YARD;
    rb.route = [
      { x: rb.x + dir * 2 * PX_PER_YARD, y: rb.y },
      { x: rb.x + dir * 6 * PX_PER_YARD, y: swingY },
      { x: rb.x + dir * 16 * PX_PER_YARD, y: swingY },
    ];
    rb.routeI = 0;
  }
}
