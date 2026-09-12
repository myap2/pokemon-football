export const PX_PER_YARD = 16;
export const ENDZONE_YARDS = 10;
export const PLAY_YARDS = 100;
export const FIELD_YARDS_X = 120;
export const FIELD_YARDS_Y = 53.3;
export const FIELD_W = FIELD_YARDS_X * PX_PER_YARD;
export const FIELD_H = FIELD_YARDS_Y * PX_PER_YARD;

export const TOUCHDOWN_POINTS = 7;
export const SAFETY_POINTS = 2;
export const FIRST_DOWN_YARDS = 10;
export const GAME_SECONDS = 180;
export const MAX_POSSESSIONS = 8;
export const OPENING_YARD = 25;

export const HANDOFF_RANGE = 54;
export const TACKLE_RANGE_BONUS = 30;
export const LUNGE_TIME = 0.28;
export const WHISTLE_TIME = 1.15;
export const TD_TIME = 2.6;
export const THROW_LOCK = 0.12;

export function yardToX(yard: number): number {
  return (yard + ENDZONE_YARDS) * PX_PER_YARD;
}

export function xToYard(x: number): number {
  return x / PX_PER_YARD - ENDZONE_YARDS;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function hypot(dx: number, dy: number): number {
  return Math.sqrt(dx * dx + dy * dy);
}

export function downWord(down: number): string {
  return ["1st", "2nd", "3rd", "4th"][down - 1] ?? `${down}th`;
}
