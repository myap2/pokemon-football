import {
  FIRST_DOWN_YARDS,
  GAME_SECONDS,
  MAX_POSSESSIONS,
  OPENING_YARD,
  SAFETY_POINTS,
  TOUCHDOWN_POINTS,
  clamp,
} from "./constants";
import type { TeamId } from "./types";

export interface MatchState {
  score: { player: number; cpu: number };
  possession: TeamId;
  down: number;
  yardsToGo: number;
  ballYard: number;
  losYard: number;
  firstDownYard: number;
  clock: number;
  possessionsPlayed: number;
  over: boolean;
  winner: TeamId | "tie" | null;
}

export type PlayEnd =
  | { type: "tackle" | "out_of_bounds"; yard: number }
  | { type: "incomplete" }
  | { type: "touchdown" }
  | { type: "safety" };

export interface PlayResult {
  possessionChanged: boolean;
  scoring: "touchdown" | "safety" | null;
  firstDown: boolean;
  turnover: boolean;
  gameOver: boolean;
  banner: string;
}

export function otherTeam(team: TeamId): TeamId {
  return team === "player" ? "cpu" : "player";
}

export function attackDir(team: TeamId): 1 | -1 {
  return team === "player" ? 1 : -1;
}

export function ownTwentyFive(team: TeamId): number {
  return team === "player" ? OPENING_YARD : 100 - OPENING_YARD;
}

export function createMatch(opening: TeamId = "player"): MatchState {
  const state: MatchState = {
    score: { player: 0, cpu: 0 },
    possession: opening,
    down: 1,
    yardsToGo: FIRST_DOWN_YARDS,
    ballYard: ownTwentyFive(opening),
    losYard: ownTwentyFive(opening),
    firstDownYard: 0,
    clock: GAME_SECONDS,
    possessionsPlayed: 0,
    over: false,
    winner: null,
  };
  startSeries(state, opening, state.ballYard);
  return state;
}

export function startSeries(state: MatchState, team: TeamId, yard: number): void {
  const spotted = clamp(yard, 0.5, 99.5);
  state.possession = team;
  state.down = 1;
  state.ballYard = spotted;
  state.losYard = spotted;
  const toGoal = yardsToGoal(state);
  state.yardsToGo = Math.min(FIRST_DOWN_YARDS, toGoal);
  state.firstDownYard = firstDownMarker(state);
}

export function yardsToGoal(state: MatchState): number {
  return state.possession === "player" ? 100 - state.losYard : state.losYard;
}

export function firstDownMarker(state: MatchState): number {
  const dir = attackDir(state.possession);
  return clamp(state.losYard + dir * state.yardsToGo, 0, 100);
}

export function reachedFirstDown(
  team: TeamId,
  ballYard: number,
  firstDownYard: number,
): boolean {
  return team === "player" ? ballYard + 1e-6 >= firstDownYard : ballYard - 1e-6 <= firstDownYard;
}

export function isGoalToGo(state: MatchState): boolean {
  return state.yardsToGo >= yardsToGoal(state) - 1e-6;
}

export function yardsNeededLabel(state: MatchState): string {
  return isGoalToGo(state) ? "Goal" : String(Math.max(1, Math.ceil(state.yardsToGo - 1e-6)));
}

/** Painted number on the field (0–50). 0 is a goal line, 50 is midfield. */
export function fieldNumber(yard: number): number {
  const y = clamp(yard, 0, 100);
  return Math.round(Math.min(y, 100 - y));
}

/** Scoreboard spot, matching the numbers painted on the grass. */
export function fieldSpotLabel(yard: number): string {
  const n = fieldNumber(yard);
  if (n === 50) return "the 50";
  const side = yard <= 50 ? "YOU" : "CPU";
  if (n === 0) return `${side} goal`;
  return `${side} ${n}`;
}

export function tickClock(state: MatchState, dt: number): void {
  if (state.over) return;
  state.clock = Math.max(0, state.clock - dt);
}

export function settleGameIfNeeded(state: MatchState): boolean {
  if (state.over) return true;
  if (state.clock > 0 && state.possessionsPlayed < MAX_POSSESSIONS) return false;
  state.over = true;
  if (state.score.player > state.score.cpu) state.winner = "player";
  else if (state.score.cpu > state.score.player) state.winner = "cpu";
  else state.winner = "tie";
  return true;
}

export function applyPlayEnd(state: MatchState, play: PlayEnd): PlayResult {
  const empty: PlayResult = {
    possessionChanged: false,
    scoring: null,
    firstDown: false,
    turnover: false,
    gameOver: false,
    banner: "",
  };
  if (state.over) {
    empty.gameOver = true;
    return empty;
  }

  if (play.type === "touchdown") {
    state.score[state.possession] += TOUCHDOWN_POINTS;
    const scorer = state.possession;
    state.possessionsPlayed += 1;
    const next = otherTeam(scorer);
    startSeries(state, next, ownTwentyFive(next));
    const gameOver = settleGameIfNeeded(state);
    return {
      possessionChanged: true,
      scoring: "touchdown",
      firstDown: false,
      turnover: false,
      gameOver,
      banner: "TOUCHDOWN",
    };
  }

  if (play.type === "safety") {
    const defense = otherTeam(state.possession);
    state.score[defense] += SAFETY_POINTS;
    state.possessionsPlayed += 1;
    startSeries(state, defense, ownTwentyFive(defense));
    const gameOver = settleGameIfNeeded(state);
    return {
      possessionChanged: true,
      scoring: "safety",
      firstDown: false,
      turnover: true,
      gameOver,
      banner: "SAFETY",
    };
  }

  const spot =
    play.type === "incomplete" ? state.losYard : clamp(play.yard, 0.1, 99.9);

  if (play.type !== "incomplete" && reachedFirstDown(state.possession, spot, state.firstDownYard)) {
    startSeries(state, state.possession, spot);
    return {
      possessionChanged: false,
      scoring: null,
      firstDown: true,
      turnover: false,
      gameOver: settleGameIfNeeded(state),
      banner: "FIRST DOWN",
    };
  }

  state.ballYard = spot;
  state.losYard = spot;
  state.down += 1;

  if (state.down > 4) {
    const prev = state.possession;
    state.possessionsPlayed += 1;
    const next = otherTeam(prev);
    startSeries(state, next, spot);
    const gameOver = settleGameIfNeeded(state);
    return {
      possessionChanged: true,
      scoring: null,
      firstDown: false,
      turnover: true,
      gameOver,
      banner: "TURNOVER ON DOWNS",
    };
  }

  state.yardsToGo = Math.abs(state.firstDownYard - spot);
  return {
    possessionChanged: false,
    scoring: null,
    firstDown: false,
    turnover: false,
    gameOver: settleGameIfNeeded(state),
    banner:
      play.type === "incomplete"
        ? "INCOMPLETE"
        : play.type === "out_of_bounds"
          ? "OUT OF BOUNDS"
          : "TACKLED",
  };
}
