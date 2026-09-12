import { describe, expect, it } from "vitest";
import { attackDir, startSeries } from "./match";
import { ROSTER, assignCpuRoles } from "./data";
import { yardToX } from "./constants";
import { Game } from "./world";

describe("game world", () => {
  it("starts 3v3 with the player holding the ball at the 25", () => {
    const player = ROSTER.slice(0, 3);
    const cpu = assignCpuRoles(ROSTER.slice(3));
    const game = new Game(player, cpu);
    expect(game.players).toHaveLength(6);
    expect(game.match.possession).toBe("player");
    expect(game.match.ballYard).toBe(25);
    expect(game.ballCarrier()?.team).toBe("player");
    expect(game.ballCarrier()?.role).toBe("qb");
    expect(game.phase).toBe("presnap");
  });

  it("snaps and advances the ball when the QB runs forward", () => {
    const game = new Game(ROSTER.slice(0, 3), assignCpuRoles(ROSTER.slice(3)));
    const startX = game.ballCarrier()!.x;
    game.snap();
    expect(game.phase).toBe("live");
    const hold = {
      ax: 1,
      ay: 0,
      space: false,
      spacePressed: false,
      shiftPressed: false,
      digitPressed: null as 1 | 2 | 3 | null,
    };
    for (let i = 0; i < 12; i++) game.update(1 / 60, hold);
    expect(game.phase).toBe("live");
    expect(game.ballCarrier()!.x).toBeGreaterThan(startX);
    expect(game.match.clock).toBeLessThan(180);
  });

  it("lets the computer hike without the player pressing snap", () => {
    const game = new Game(ROSTER.slice(0, 3), assignCpuRoles(ROSTER.slice(3)));
    startSeries(game.match, "cpu", 75);
    game.setupPlay();
    expect(game.phase).toBe("presnap");
    const idle = {
      ax: 0,
      ay: 0,
      space: false,
      spacePressed: false,
      shiftPressed: false,
      digitPressed: null as 1 | 2 | 3 | null,
    };
    for (let i = 0; i < 30; i++) game.update(1 / 60, idle);
    expect(game.phase).toBe("presnap");
    for (let i = 0; i < 50; i++) game.update(1 / 60, idle);
    expect(game.phase).toBe("live");
  });

  it("does not auto-hike while the player has the ball", () => {
    const game = new Game(ROSTER.slice(0, 3), assignCpuRoles(ROSTER.slice(3)));
    const idle = {
      ax: 0,
      ay: 0,
      space: false,
      spacePressed: false,
      shiftPressed: false,
      digitPressed: null as 1 | 2 | 3 | null,
    };
    for (let i = 0; i < 90; i++) game.update(1 / 60, idle);
    expect(game.phase).toBe("presnap");
    expect(game.match.possession).toBe("player");
  });

  it("does not call a safety just for running into your own endzone", () => {
    const game = new Game(ROSTER.slice(0, 3), assignCpuRoles(ROSTER.slice(3)));
    game.snap();
    const qb = game.ballCarrier()!;
    qb.x = yardToX(-6);
    qb.y = 200;
    qb.vx = 0;
    qb.vy = 0;
    for (const p of game.players) {
      if (p.team === "cpu") {
        p.x = yardToX(80);
        p.y = 200;
        p.vx = 0;
        p.vy = 0;
      }
    }
    const idle = {
      ax: 0,
      ay: 0,
      space: false,
      spacePressed: false,
      shiftPressed: false,
      digitPressed: null as 1 | 2 | 3 | null,
    };
    for (let i = 0; i < 24; i++) game.update(1 / 60, idle);
    expect(game.phase).toBe("live");
    expect(game.match.score.cpu).toBe(0);
    expect(game.ballCarrier()?.id).toBe(qb.id);
  });

  it("keeps the computer quarterback behind the line of scrimmage", () => {
    const game = new Game(ROSTER.slice(0, 3), assignCpuRoles(ROSTER.slice(3)));
    startSeries(game.match, "cpu", 75);
    game.setupPlay();
    game.snap();
    const idle = {
      ax: 0,
      ay: 0,
      space: false,
      spacePressed: false,
      shiftPressed: false,
      digitPressed: null as 1 | 2 | 3 | null,
    };
    for (let i = 0; i < 90; i++) game.update(1 / 60, idle);
    const qb = game.players.find((p) => p.team === "cpu" && p.role === "qb");
    expect(qb).toBeTruthy();
    if (game.ballCarrier()?.id !== qb!.id) return;
    const losX = yardToX(game.match.losYard);
    const behind = (losX - qb!.x) * attackDir("cpu");
    expect(behind).toBeGreaterThan(8);
  });
});
