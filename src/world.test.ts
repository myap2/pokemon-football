import { describe, expect, it } from "vitest";
import { ROSTER, assignCpuRoles } from "./data";
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
    for (let i = 0; i < 24; i++) game.update(1 / 60, hold);
    expect(game.phase).toBe("live");
    expect(game.ballCarrier()!.x).toBeGreaterThan(startX);
    expect(game.match.clock).toBeLessThan(180);
  });
});
