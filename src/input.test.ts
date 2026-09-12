import { describe, expect, it } from "vitest";
import { analogFromDelta } from "./input";

describe("analog stick", () => {
  it("ignores tiny movement inside the deadzone", () => {
    expect(analogFromDelta(2, 0, 50)).toEqual({ ax: 0, ay: 0 });
  });

  it("scales to the rim and clamps past it", () => {
    const half = analogFromDelta(25, 0, 50, 0);
    expect(half.ax).toBeCloseTo(0.5);
    expect(half.ay).toBeCloseTo(0);
    const over = analogFromDelta(80, 0, 50, 0);
    expect(over.ax).toBeCloseTo(1);
    expect(over.ay).toBeCloseTo(0);
  });

  it("keeps diagonal input on the unit circle", () => {
    const v = analogFromDelta(40, 40, 40, 0);
    expect(Math.hypot(v.ax, v.ay)).toBeCloseTo(1);
    expect(v.ax).toBeCloseTo(Math.SQRT1_2);
    expect(v.ay).toBeCloseTo(Math.SQRT1_2);
  });
});
