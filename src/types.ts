import type { PokemonDef } from "./data";

export type TeamId = "player" | "cpu";

export type Role = "qb" | "wr" | "rb" | "rusher" | "cb" | "lb";

export type Phase =
  | "presnap"
  | "live"
  | "whistle"
  | "touchdown"
  | "safety"
  | "gameover";

export type BallState = "held" | "air" | "spotted";

export interface InputFrame {
  ax: number;
  ay: number;
  space: boolean;
  spacePressed: boolean;
  shiftPressed: boolean;
  digitPressed: 1 | 2 | 3 | null;
}

export interface Actor {
  id: string;
  team: TeamId;
  pokemon: PokemonDef;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  radius: number;
  role: Role;
  hasBall: boolean;
  stunned: number;
  lunge: number;
  abilityCd: number;
  abilityT: number;
  unstoppable: boolean;
  guaranteedTackle: boolean;
  flamePass: boolean;
  wall: boolean;
  route: { x: number; y: number }[];
  routeI: number;
  coverId: string | null;
  bob: number;
  speedMul: number;
}

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  state: BallState;
  carrierId: string | null;
  targetId: string | null;
  throwerId: string | null;
  t: number;
  flight: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

export interface Banner {
  text: string;
  sub: string;
  life: number;
  color: string;
}
