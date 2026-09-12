import { describe, expect, it } from "vitest";
import {
  applyPlayEnd,
  createMatch,
  fieldNumber,
  fieldSpotLabel,
  firstDownMarker,
  reachedFirstDown,
  startSeries,
  yardsNeededLabel,
} from "./match";

describe("match setup", () => {
  it("starts the player at the 25 with 1st and 10", () => {
    const m = createMatch("player");
    expect(m.possession).toBe("player");
    expect(m.down).toBe(1);
    expect(m.ballYard).toBe(25);
    expect(m.losYard).toBe(25);
    expect(m.firstDownYard).toBe(35);
    expect(m.score).toEqual({ player: 0, cpu: 0 });
    expect(m.clock).toBe(180);
  });

  it("starts the cpu at the 75 going left", () => {
    const m = createMatch("cpu");
    expect(m.ballYard).toBe(75);
    expect(m.firstDownYard).toBe(65);
  });
});

describe("field numbers", () => {
  it("counts up to midfield and back down to the other goal", () => {
    expect(fieldNumber(25)).toBe(25);
    expect(fieldNumber(50)).toBe(50);
    expect(fieldNumber(75)).toBe(25);
    expect(fieldNumber(76)).toBe(24);
    expect(fieldSpotLabel(25)).toBe("YOU 25");
    expect(fieldSpotLabel(50)).toBe("the 50");
    expect(fieldSpotLabel(76)).toBe("CPU 24");
    expect(fieldSpotLabel(0)).toBe("YOU goal");
    expect(fieldSpotLabel(100)).toBe("CPU goal");
  });
});

describe("first downs", () => {
  it("resets downs after a 10-yard gain", () => {
    const m = createMatch("player");
    const r = applyPlayEnd(m, { type: "tackle", yard: 35 });
    expect(r.firstDown).toBe(true);
    expect(m.down).toBe(1);
    expect(m.losYard).toBe(35);
    expect(m.firstDownYard).toBe(45);
    expect(m.possession).toBe("player");
  });

  it("counts a short gain as the next down", () => {
    const m = createMatch("player");
    const r = applyPlayEnd(m, { type: "tackle", yard: 29 });
    expect(r.firstDown).toBe(false);
    expect(m.down).toBe(2);
    expect(m.losYard).toBe(29);
    expect(m.yardsToGo).toBeCloseTo(6, 5);
    expect(m.firstDownYard).toBe(35);
  });

  it("gives the cpu a first down when they cross their marker going left", () => {
    const m = createMatch("cpu");
    const r = applyPlayEnd(m, { type: "tackle", yard: 64 });
    expect(r.firstDown).toBe(true);
    expect(m.down).toBe(1);
    expect(m.possession).toBe("cpu");
    expect(m.firstDownYard).toBe(54);
  });

  it("uses goal-to-go inside the 10", () => {
    const m = createMatch("player");
    startSeries(m, "player", 94);
    expect(yardsNeededLabel(m)).toBe("Goal");
    expect(m.firstDownYard).toBe(100);
    expect(reachedFirstDown("player", 100, m.firstDownYard)).toBe(true);
  });
});

describe("turnovers and scoring", () => {
  it("turns the ball over after a failed fourth down", () => {
    const m = createMatch("player");
    applyPlayEnd(m, { type: "tackle", yard: 26 });
    applyPlayEnd(m, { type: "tackle", yard: 27 });
    applyPlayEnd(m, { type: "tackle", yard: 28 });
    expect(m.down).toBe(4);
    const r = applyPlayEnd(m, { type: "tackle", yard: 30 });
    expect(r.turnover).toBe(true);
    expect(m.possession).toBe("cpu");
    expect(m.down).toBe(1);
    expect(m.losYard).toBe(30);
    expect(m.firstDownYard).toBe(20);
    expect(m.possessionsPlayed).toBe(1);
  });

  it("spots an incomplete pass back at the line of scrimmage", () => {
    const m = createMatch("player");
    applyPlayEnd(m, { type: "incomplete" });
    expect(m.down).toBe(2);
    expect(m.losYard).toBe(25);
    expect(m.firstDownYard).toBe(35);
  });

  it("awards 7 points on a touchdown and switches possession", () => {
    const m = createMatch("player");
    const r = applyPlayEnd(m, { type: "touchdown" });
    expect(r.scoring).toBe("touchdown");
    expect(m.score.player).toBe(7);
    expect(m.possession).toBe("cpu");
    expect(m.losYard).toBe(75);
    expect(m.down).toBe(1);
  });

  it("awards 2 points on a safety and gives the other team the ball", () => {
    const m = createMatch("player");
    const r = applyPlayEnd(m, { type: "safety" });
    expect(r.scoring).toBe("safety");
    expect(m.score.cpu).toBe(2);
    expect(m.possession).toBe("cpu");
    expect(m.losYard).toBe(75);
  });

  it("computes the first-down marker from the line of scrimmage", () => {
    const m = createMatch("player");
    expect(firstDownMarker(m)).toBe(35);
    startSeries(m, "cpu", 40);
    expect(firstDownMarker(m)).toBe(30);
  });

  it("turns the ball over after an incomplete fourth down", () => {
    const m = createMatch("player");
    applyPlayEnd(m, { type: "incomplete" });
    applyPlayEnd(m, { type: "incomplete" });
    applyPlayEnd(m, { type: "incomplete" });
    expect(m.down).toBe(4);
    const r = applyPlayEnd(m, { type: "incomplete" });
    expect(r.turnover).toBe(true);
    expect(m.possession).toBe("cpu");
    expect(m.losYard).toBe(25);
  });

  it("ends the game when the clock hits zero after a play", () => {
    const m = createMatch("player");
    m.clock = 0;
    const r = applyPlayEnd(m, { type: "tackle", yard: 28 });
    expect(r.gameOver).toBe(true);
    expect(m.over).toBe(true);
    expect(m.winner).toBe("tie");
  });
});
