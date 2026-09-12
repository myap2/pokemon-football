import { think, assignRoutes } from "./ai";
import { sfx } from "./audio";
import {
  FIELD_H,
  HANDOFF_RANGE,
  LUNGE_TIME,
  PX_PER_YARD,
  TD_TIME,
  TACKLE_RANGE_BONUS,
  THROW_LOCK,
  WHISTLE_TIME,
  hypot,
  xToYard,
  yardToX,
} from "./constants";
import type { PokemonDef } from "./data";
import {
  applyPlayEnd,
  attackDir,
  createMatch,
  otherTeam,
  tickClock,
  type MatchState,
  type PlayResult,
} from "./match";
import { collideAll, drive, integrate } from "./physics";
import type { Actor, Ball, Banner, InputFrame, Particle, Phase, Role, TeamId } from "./types";

function makeActor(id: string, team: TeamId, pokemon: PokemonDef, role: Role): Actor {
  return {
    id,
    team,
    pokemon,
    role,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    facing: team === "player" ? 1 : -1,
    radius: pokemon.radius,
    hasBall: false,
    stunned: 0,
    lunge: 0,
    abilityCd: 0,
    abilityT: 0,
    unstoppable: false,
    guaranteedTackle: false,
    flamePass: false,
    wall: false,
    route: [],
    routeI: 0,
    coverId: null,
    bob: 0,
    speedMul: 1,
  };
}

export class Game {
  match: MatchState;
  players: Actor[];
  ball: Ball;
  phase: Phase = "presnap";
  phaseT = 0;
  controlId: string;
  selectedRecvId: string | null = null;
  particles: Particle[] = [];
  banner: Banner | null = null;
  shake = 0;
  playTime = 0;
  throwLock = 0;
  tackleMeter = 0;
  lastResult: PlayResult | null = null;
  ended = false;

  get possession(): TeamId {
    return this.match.possession;
  }

  get down(): number {
    return this.match.down;
  }

  get losYard(): number {
    return this.match.losYard;
  }

  constructor(playerTeam: PokemonDef[], cpuTeam: PokemonDef[]) {
    this.match = createMatch("player");
    this.players = [
      ...playerTeam.map((p, i) => makeActor(`p${i}`, "player", p, i === 0 ? "qb" : i === 1 ? "wr" : "rb")),
      ...cpuTeam.map((p, i) => makeActor(`c${i}`, "cpu", p, i === 0 ? "qb" : i === 1 ? "wr" : "rb")),
    ];
    this.ball = {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      state: "held",
      carrierId: null,
      targetId: null,
      throwerId: null,
      t: 0,
      flight: 0,
    };
    this.controlId = this.players[0].id;
    this.setupPlay();
  }

  teamActors(team: TeamId): Actor[] {
    return this.players.filter((p) => p.team === team);
  }

  actor(id: string | null | undefined): Actor | undefined {
    return id ? this.players.find((p) => p.id === id) : undefined;
  }

  controlled(): Actor {
    return this.actor(this.controlId) ?? this.players[0];
  }

  ballCarrier(): Actor | undefined {
    return this.players.find((p) => p.hasBall);
  }

  setupPlay(): void {
    const dir = attackDir(this.match.possession);
    const losX = yardToX(this.match.losYard);
    const mid = FIELD_H / 2;
    const offense = this.teamActors(this.match.possession);
    const defense = this.teamActors(otherTeam(this.match.possession));

    offense[0].role = "qb";
    offense[1].role = "wr";
    offense[2].role = "rb";
    defense[0].role = "rusher";
    defense[1].role = "cb";
    defense[2].role = "lb";
    defense[1].coverId = offense[1].id;
    defense[2].coverId = offense[2].id;

    for (const p of this.players) {
      p.vx = 0;
      p.vy = 0;
      p.hasBall = false;
      p.stunned = 0;
      p.lunge = 0;
      p.unstoppable = p.abilityT > 0 && p.pokemon.ability.id === "shadow-slip";
      p.wall = p.abilityT > 0 && p.pokemon.ability.id === "belly-block";
      p.radius = p.wall ? p.pokemon.radius * 1.25 : p.pokemon.radius;
      p.route = [];
      p.routeI = 0;
    }

    offense[0].x = losX - dir * 5.2 * PX_PER_YARD;
    offense[0].y = mid;
    offense[1].x = losX - dir * 1.2 * PX_PER_YARD;
    offense[1].y = mid - 14 * PX_PER_YARD;
    offense[2].x = losX - dir * 6.2 * PX_PER_YARD;
    offense[2].y = mid + 11 * PX_PER_YARD;

    defense[0].x = losX + dir * 3.2 * PX_PER_YARD;
    defense[0].y = mid + 10;
    defense[1].x = losX + dir * 3.5 * PX_PER_YARD;
    defense[1].y = offense[1].y;
    defense[2].x = losX + dir * 12 * PX_PER_YARD;
    defense[2].y = mid + 6 * PX_PER_YARD;

    this.giveBall(offense[0]);
    this.selectedRecvId = offense[1].id;
    this.controlId = this.match.possession === "player" ? offense[0].id : defense[0].id;
    this.ball.state = "held";
    this.phase = "presnap";
    this.phaseT = 0;
    this.playTime = 0;
    this.tackleMeter = 0;
    this.throwLock = 0;
    assignRoutes(offense);
    this.setBanner(this.match.possession === "player" ? "YOUR BALL" : "CPU BALL", "Hike to snap", 1.6, "#f4d35e");
  }

  giveBall(actor: Actor): void {
    for (const p of this.players) p.hasBall = false;
    actor.hasBall = true;
    this.ball.state = "held";
    this.ball.carrierId = actor.id;
    this.ball.targetId = null;
    this.ball.throwerId = null;
    this.ball.vx = 0;
    this.ball.vy = 0;
  }

  snap(): void {
    if (this.phase !== "presnap") return;
    this.phase = "live";
    this.playTime = 0;
    sfx.snap();
    this.setBanner("HIKE", "", 0.45, "#fff");
  }

  update(dt: number, input: InputFrame): void {
    this.shake = Math.max(0, this.shake - dt * 18);
    if (this.banner) {
      this.banner.life -= dt;
      if (this.banner.life <= 0) this.banner = null;
    }
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 80 * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    if (this.phase === "presnap") {
      this.followBall();
      if (this.match.possession !== "player" && input.digitPressed) {
        this.switchDefender(input.digitPressed);
      }
      if (input.spacePressed) this.snap();
      return;
    }

    if (this.phase === "whistle" || this.phase === "touchdown" || this.phase === "safety") {
      this.phaseT -= dt;
      this.followBall();
      if (this.phaseT <= 0) {
        if (this.match.over) {
          this.phase = "gameover";
          this.ended = true;
          return;
        }
        this.setupPlay();
      }
      return;
    }

    if (this.phase === "gameover") return;

    this.updateLive(dt, input);
  }

  private updateLive(dt: number, input: InputFrame): void {
    tickClock(this.match, dt);
    this.playTime += dt;
    this.throwLock = Math.max(0, this.throwLock - dt);

    for (const p of this.players) {
      p.stunned = Math.max(0, p.stunned - dt);
      p.lunge = Math.max(0, p.lunge - dt);
      p.abilityCd = Math.max(0, p.abilityCd - dt);
      p.speedMul = 1;
      if (p.abilityT > 0) {
        p.abilityT -= dt;
        this.applyAbility(p);
        if (p.abilityT <= 0) this.clearTimedAbility(p);
      }
    }
    for (const p of this.players) {
      if (p.abilityT > 0 && p.pokemon.ability.id === "aura-pulse") {
        for (const e of this.players) {
          if (e.team === p.team) continue;
          if (hypot(e.x - p.x, e.y - p.y) < 130) e.speedMul *= 0.36;
        }
      }
      if (p.abilityT > 0 && p.pokemon.ability.id === "volt-dash") p.speedMul *= 2.2;
      if (p.team === "cpu") p.speedMul *= 0.92;
    }

    const me = this.controlled();
    if (input.digitPressed) {
      if (this.match.possession === "player") this.selectReceiver(input.digitPressed);
      else this.switchDefender(input.digitPressed);
    }
    if (input.shiftPressed) this.activateAbility(me);
    if (input.spacePressed) this.useSpace(me);

    drive(me, input.ax, input.ay, dt);

    think(this, dt);

    for (const p of this.players) integrate(p, dt);
    collideAll(this.players);
    this.updateBall(dt);
    this.checkCatch();
    this.checkTackle(dt);
    this.checkScore();
    this.followBall();
  }

  private useSpace(me: Actor): void {
    if (this.match.possession === me.team && me.hasBall) {
      const mate = this.nearestTeammate(me);
      if (mate && hypot(mate.x - me.x, mate.y - me.y) < HANDOFF_RANGE) {
        this.tryHandoff(me, mate);
        return;
      }
      const recv = this.actor(this.selectedRecvId);
      const target = recv && recv.id !== me.id ? recv : this.nearestTeammate(me);
      if (target) this.throwTo(me, target);
      return;
    }
    if (me.team !== this.match.possession) {
      const carrier = this.ballCarrier();
      if (!carrier) return;
      const reach = me.radius + carrier.radius + TACKLE_RANGE_BONUS;
      if (this.playTime >= 0.28 && !carrier.unstoppable && hypot(me.x - carrier.x, me.y - carrier.y) < reach) {
        this.whistleTackle(carrier);
        return;
      }
      this.lungeAt(me, carrier);
    }
  }

  selectReceiver(slot: 1 | 2 | 3): void {
    const mates = this.teamActors("player").filter((p) => !p.hasBall);
    const pick = mates[slot - 1] ?? mates[0];
    if (pick) this.selectedRecvId = pick.id;
  }

  switchDefender(slot: 1 | 2 | 3): void {
    const squad = this.teamActors("player");
    const pick = squad[slot - 1];
    if (pick) this.controlId = pick.id;
  }

  nearestTeammate(actor: Actor): Actor | undefined {
    let best: Actor | undefined;
    let bestD = Infinity;
    for (const p of this.players) {
      if (p.id === actor.id || p.team !== actor.team) continue;
      const d = hypot(p.x - actor.x, p.y - actor.y);
      if (d < bestD) {
        best = p;
        bestD = d;
      }
    }
    return best;
  }

  throwTo(from: Actor, to: Actor): void {
    if (this.throwLock > 0 || this.ball.state !== "held" || !from.hasBall || from.id === to.id) return;
    from.hasBall = false;
    from.facing = to.x >= from.x ? 1 : -1;
    this.ball.state = "air";
    this.ball.carrierId = null;
    this.ball.throwerId = from.id;
    this.ball.targetId = to.id;
    this.ball.t = 0;
    let spd = 340 + from.pokemon.throwing * 38;
    if (from.flamePass) {
      spd *= 1.65;
      from.flamePass = false;
    }
    const lead = 0.3;
    const tx = to.x + to.vx * lead;
    const ty = to.y + to.vy * lead;
    const dx = tx - from.x;
    const dy = ty - from.y;
    const d = Math.max(1, hypot(dx, dy));
    this.ball.x = from.x + (dx / d) * (from.radius + 10);
    this.ball.y = from.y + (dy / d) * (from.radius + 10);
    this.ball.vx = (dx / d) * spd;
    this.ball.vy = (dy / d) * spd;
    this.ball.flight = d / spd;
    this.throwLock = THROW_LOCK;
    sfx.throw();
  }

  tryHandoff(from: Actor, to: Actor): boolean {
    if (!from.hasBall || from.id === to.id) return false;
    if (hypot(from.x - to.x, from.y - to.y) > HANDOFF_RANGE + 8) return false;
    this.giveBall(to);
    to.vx += from.vx * 0.3;
    if (to.team === "player") this.controlId = to.id;
    this.setBanner("HANDOFF", to.pokemon.name, 0.7, "#fff");
    sfx.catch();
    return true;
  }

  lungeAt(actor: Actor, target: Actor): void {
    if (actor.lunge > 0) return;
    const dx = target.x - actor.x;
    const dy = target.y - actor.y;
    const d = hypot(dx, dy) || 1;
    actor.lunge = LUNGE_TIME;
    actor.vx = (dx / d) * 560;
    actor.vy = (dy / d) * 560;
    actor.facing = dx >= 0 ? 1 : -1;
  }

  activateAbility(actor: Actor): void {
    if (actor.abilityCd > 0 || actor.abilityT > 0) return;
    actor.abilityCd = actor.pokemon.ability.cooldown;
    actor.abilityT = actor.pokemon.ability.duration;
    this.applyAbility(actor);
    sfx.ability();
    this.setBanner(actor.pokemon.ability.name.toUpperCase(), actor.pokemon.name, 0.9, actor.pokemon.color);
  }

  private applyAbility(actor: Actor): void {
    switch (actor.pokemon.ability.id) {
      case "power-slam":
        actor.guaranteedTackle = true;
        break;
      case "flame-bomb":
        actor.flamePass = true;
        break;
      case "belly-block":
        actor.wall = true;
        actor.radius = actor.pokemon.radius * 1.25;
        break;
      case "shadow-slip":
        actor.unstoppable = true;
        break;
      default:
        break;
    }
  }

  private clearTimedAbility(actor: Actor): void {
    actor.unstoppable = false;
    actor.wall = false;
    actor.radius = actor.pokemon.radius;
  }

  private updateBall(dt: number): void {
    if (this.ball.state !== "air") return;
    this.ball.x += this.ball.vx * dt;
    this.ball.y += this.ball.vy * dt;
    this.ball.t += dt;
    if (this.ball.y < 8 || this.ball.y > FIELD_H - 8 || this.ball.t > this.ball.flight + 0.2) {
      this.endPlay({ type: "incomplete" });
    }
  }

  private checkCatch(): void {
    if (this.ball.state !== "air") return;
    const thrower = this.actor(this.ball.throwerId);
    for (const p of this.players) {
      if (p.id === this.ball.throwerId) continue;
      const reach = p.radius + 12 + p.pokemon.catching * 1.7;
      if (hypot(p.x - this.ball.x, p.y - this.ball.y) > reach) continue;
      if (thrower && p.team !== thrower.team) continue;
      this.giveBall(p);
      if (p.team === "player") this.controlId = p.id;
      sfx.catch();
      this.setBanner("CATCH", p.pokemon.name, 0.55, "#fff");
      return;
    }
  }

  private checkTackle(dt: number): void {
    if (this.playTime < 0.28) return;
    if (this.ball.state !== "held") {
      this.tackleMeter = 0;
      return;
    }
    const carrier = this.ballCarrier();
    if (!carrier || carrier.unstoppable) {
      this.tackleMeter = Math.max(0, this.tackleMeter - dt);
      return;
    }
    let engaged = false;
    for (const e of this.players) {
      if (e.team === carrier.team) continue;
      const range = e.radius + carrier.radius + (e.lunge > 0 ? TACKLE_RANGE_BONUS : 12);
      if (hypot(e.x - carrier.x, e.y - carrier.y) > range) continue;
      engaged = true;
      if (e.guaranteedTackle || e.lunge > 0) {
        e.guaranteedTackle = false;
        this.whistleTackle(carrier);
        return;
      }
      const def = e.pokemon.strength;
      const off = carrier.pokemon.strength + 2;
      this.tackleMeter += (def / off) * dt * 4.4;
      if (this.tackleMeter > 0.16) {
        this.whistleTackle(carrier);
        return;
      }
    }
    if (!engaged) this.tackleMeter = Math.max(0, this.tackleMeter - dt * 0.8);
  }

  private whistleTackle(carrier: Actor): void {
    carrier.stunned = 0.4;
    this.shake = 7;
    sfx.tackle();
    this.burst(carrier.x, carrier.y, "#f4d35e", 14);
    this.endPlay({ type: "tackle", yard: xToYard(carrier.x) });
  }

  private checkScore(): void {
    if (this.phase !== "live" || this.ball.state !== "held") return;
    const carrier = this.ballCarrier();
    if (!carrier) return;
    const yard = xToYard(carrier.x);
    if (carrier.team === "player" && yard >= 100) {
      this.endPlay({ type: "touchdown" });
      return;
    }
    if (carrier.team === "cpu" && yard <= 0) {
      this.endPlay({ type: "touchdown" });
      return;
    }
    if (carrier.team === "player" && yard <= 0) {
      this.endPlay({ type: "safety" });
      return;
    }
    if (carrier.team === "cpu" && yard >= 100) {
      this.endPlay({ type: "safety" });
    }
  }

  private endPlay(play: Parameters<typeof applyPlayEnd>[1]): void {
    if (this.phase !== "live") return;
    const result = applyPlayEnd(this.match, play);
    this.lastResult = result;
    this.ball.state = "spotted";
    const carrier = this.ballCarrier();
    if (carrier) {
      this.ball.x = carrier.x;
      this.ball.y = carrier.y;
    }

    if (result.scoring === "touchdown") {
      this.phase = "touchdown";
      this.phaseT = TD_TIME;
      this.shake = 12;
      sfx.touchdown();
      this.burst(this.ball.x, this.ball.y, "#f4d35e", 70);
      this.burst(this.ball.x, this.ball.y, "#fff", 40);
      this.setBanner("TOUCHDOWN", "+7 points", TD_TIME, "#f4d35e");
      return;
    }
    if (result.scoring === "safety") {
      this.phase = "safety";
      this.phaseT = WHISTLE_TIME + 0.6;
      sfx.whistle();
      this.setBanner("SAFETY", "+2 points", 1.6, "#fff");
      return;
    }

    this.phase = "whistle";
    this.phaseT = WHISTLE_TIME;
    if (result.firstDown) sfx.firstDown();
    else if (play.type === "incomplete") sfx.incomplete();
    else sfx.whistle();
    this.setBanner(result.banner, result.turnover ? "CPU ball" : "", 1.1, result.firstDown ? "#f4d35e" : "#fff");
  }

  private followBall(): void {
    const carrier = this.ballCarrier();
    if (this.ball.state === "held" && carrier) {
      this.ball.x = carrier.x + carrier.facing * carrier.radius * 0.45;
      this.ball.y = carrier.y + 8;
    }
  }

  setBanner(text: string, sub: string, life: number, color: string): void {
    this.banner = { text, sub, life, color };
  }

  burst(x: number, y: number, color: string, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 220;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 40,
        life: 0.5 + Math.random() * 0.7,
        max: 1,
        color,
        size: 3 + Math.random() * 5,
      });
    }
  }
}
