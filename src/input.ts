import type { InputFrame } from "./types";

const held = new Set<string>();
const pressed = new Set<string>();

const touch = {
  ax: 0,
  ay: 0,
  stickId: null as number | null,
  spacePressed: false,
  shiftPressed: false,
  digitPressed: null as 1 | 2 | 3 | null,
};

export function analogFromDelta(
  dx: number,
  dy: number,
  radius: number,
  deadzone = 0.14,
): { ax: number; ay: number } {
  const mag = Math.hypot(dx, dy);
  if (radius <= 0 || mag < radius * deadzone) return { ax: 0, ay: 0 };
  const clamped = Math.min(1, mag / radius);
  return { ax: (dx / mag) * clamped, ay: (dy / mag) * clamped };
}

export function pulseSpace(): void {
  touch.spacePressed = true;
}

export function pulseAbility(): void {
  touch.shiftPressed = true;
}

export function pulseSlot(slot: 1 | 2 | 3): void {
  touch.digitPressed = slot;
}

export function setStick(ax: number, ay: number): void {
  touch.ax = ax;
  touch.ay = ay;
}

export function clearStick(): void {
  touch.ax = 0;
  touch.ay = 0;
  touch.stickId = null;
}

export function bindStick(base: HTMLElement, knob: HTMLElement): void {
  const syncKnob = (ax: number, ay: number): void => {
    const travel = base.clientWidth * 0.28;
    knob.style.transform = `translate(calc(-50% + ${ax * travel}px), calc(-50% + ${ay * travel}px))`;
  };

  const fromEvent = (e: PointerEvent): { ax: number; ay: number } => {
    const rect = base.getBoundingClientRect();
    const radius = rect.width * 0.42;
    return analogFromDelta(e.clientX - (rect.left + rect.width / 2), e.clientY - (rect.top + rect.height / 2), radius);
  };

  const onDown = (e: PointerEvent): void => {
    if (touch.stickId !== null) return;
    e.preventDefault();
    touch.stickId = e.pointerId;
    base.setPointerCapture(e.pointerId);
    const next = fromEvent(e);
    setStick(next.ax, next.ay);
    syncKnob(next.ax, next.ay);
  };

  const onMove = (e: PointerEvent): void => {
    if (touch.stickId !== e.pointerId) return;
    e.preventDefault();
    const next = fromEvent(e);
    setStick(next.ax, next.ay);
    syncKnob(next.ax, next.ay);
  };

  const onUp = (e: PointerEvent): void => {
    if (touch.stickId !== e.pointerId) return;
    e.preventDefault();
    clearStick();
    syncKnob(0, 0);
  };

  base.addEventListener("pointerdown", onDown);
  base.addEventListener("pointermove", onMove);
  base.addEventListener("pointerup", onUp);
  base.addEventListener("pointercancel", onUp);
  base.addEventListener("contextmenu", (e) => e.preventDefault());
}

export function bindPulse(el: HTMLElement, fire: () => void): void {
  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    fire();
  });
}

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
    clearStick();
  });
}

export function pollInput(): InputFrame {
  const right = held.has("KeyD") || held.has("ArrowRight");
  const left = held.has("KeyA") || held.has("ArrowLeft");
  const down = held.has("KeyS") || held.has("ArrowDown");
  const up = held.has("KeyW") || held.has("ArrowUp");
  const keyAx = (right ? 1 : 0) - (left ? 1 : 0);
  const keyAy = (down ? 1 : 0) - (up ? 1 : 0);
  const digitPressed: 1 | 2 | 3 | null = pressed.has("Digit1")
    ? 1
    : pressed.has("Digit2")
      ? 2
      : pressed.has("Digit3")
        ? 3
        : touch.digitPressed;
  const frame: InputFrame = {
    ax: clampAxis(keyAx + touch.ax),
    ay: clampAxis(keyAy + touch.ay),
    space: held.has("Space"),
    spacePressed: pressed.has("Space") || touch.spacePressed,
    shiftPressed: pressed.has("ShiftLeft") || pressed.has("ShiftRight") || touch.shiftPressed,
    digitPressed,
  };
  touch.spacePressed = false;
  touch.shiftPressed = false;
  touch.digitPressed = null;
  pressed.clear();
  return frame;
}

function clampAxis(n: number): number {
  return Math.max(-1, Math.min(1, n));
}
