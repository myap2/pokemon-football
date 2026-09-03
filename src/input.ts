import type { InputFrame } from "./types";

const held = new Set<string>();
const pressed = new Set<string>();

export function installInput(): void {
  window.addEventListener("keydown", (e) => {
    if (
      e.code === "Space" ||
      e.code.startsWith("Arrow") ||
      e.code === "KeyW" ||
      e.code === "KeyA" ||
      e.code === "KeyS" ||
      e.code === "KeyD"
    ) {
      e.preventDefault();
    }
    if (e.repeat) return;
    if (!held.has(e.code)) pressed.add(e.code);
    held.add(e.code);
  });
  window.addEventListener("keyup", (e) => {
    held.delete(e.code);
  });
  window.addEventListener("blur", () => {
    held.clear();
    pressed.clear();
  });
}

export function pollInput(): InputFrame {
  const right = held.has("KeyD") || held.has("ArrowRight");
  const left = held.has("KeyA") || held.has("ArrowLeft");
  const down = held.has("KeyS") || held.has("ArrowDown");
  const up = held.has("KeyW") || held.has("ArrowUp");
  const digitPressed: 1 | 2 | 3 | null = pressed.has("Digit1")
    ? 1
    : pressed.has("Digit2")
      ? 2
      : pressed.has("Digit3")
        ? 3
        : null;
  const frame: InputFrame = {
    ax: (right ? 1 : 0) - (left ? 1 : 0),
    ay: (down ? 1 : 0) - (up ? 1 : 0),
    space: held.has("Space"),
    spacePressed: pressed.has("Space"),
    shiftPressed: pressed.has("ShiftLeft") || pressed.has("ShiftRight"),
    digitPressed,
  };
  pressed.clear();
  return frame;
}
