import "./style.css";
import { assignCpuRoles, ROSTER, pokemonById, type PokemonDef } from "./data";
import { installInput, pollInput } from "./input";
import { sfx, toggleMute, unlockAudio } from "./audio";
import { clockLabel, downLine, loadSprites, renderGame } from "./render";
import { Game } from "./world";

const screens = {
  home: $("screen-home"),
  team: $("screen-team"),
  game: $("screen-game"),
  over: $("screen-over"),
};

const rosterEl = $("roster");
const pickHint = $("pick-hint") as HTMLParagraphElement;
const startBtn = $("btn-start") as HTMLButtonElement;
const canvas = $("field") as HTMLCanvasElement;
const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("Canvas is not available");

let picks: string[] = [];
let game: Game | null = null;
let screen: keyof typeof screens = "home";
let helpOpen = true;
let seenHelp = false;
let last = performance.now();

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el;
}

function show(name: keyof typeof screens): void {
  screen = name;
  for (const [key, el] of Object.entries(screens)) {
    el.classList.toggle("hidden", key !== name);
  }
}

function renderRoster(): void {
  rosterEl.innerHTML = "";
  for (const p of ROSTER) {
    const selected = picks.indexOf(p.id);
    const card = document.createElement("button");
    card.type = "button";
    card.className = `card${selected >= 0 ? " selected" : ""}`;
    card.innerHTML = `
      ${selected >= 0 ? `<span class="badge">${["QB", "WR", "RB"][selected]}</span>` : ""}
      <img src="./sprites/${p.id}.svg" alt="${p.name}" />
      <h3>${p.name}</h3>
      <p class="type">${p.type} · ${p.blurb}</p>
      ${statRow("Speed", p.speed)}${statRow("Strength", p.strength)}
      ${statRow("Throw", p.throwing)}${statRow("Catch", p.catching)}
      <p class="ability"><strong>${p.ability.name}</strong> — ${p.ability.desc}</p>
    `;
    card.addEventListener("click", () => togglePick(p.id));
    rosterEl.appendChild(card);
  }
  pickHint.textContent =
    picks.length === 0
      ? "0 / 3 selected · first pick is your QB"
      : `${picks.length} / 3 selected · ${picks.map((id, i) => `${["QB", "WR", "RB"][i]} ${pokemonById(id).name}`).join(" · ")}`;
  startBtn.disabled = picks.length !== 3;
}

function statRow(label: string, n: number): string {
  return `<div class="stat"><span>${label}</span><div class="bar"><span style="width:${n * 10}%"></span></div><span>${n}</span></div>`;
}

function togglePick(id: string): void {
  const i = picks.indexOf(id);
  if (i >= 0) picks.splice(i, 1);
  else if (picks.length < 3) picks.push(id);
  renderRoster();
}

function startMatch(): void {
  const playerTeam: PokemonDef[] = picks.map(pokemonById);
  const remaining = ROSTER.filter((p) => !picks.includes(p.id));
  const cpuTeam = assignCpuRoles(remaining);
  game = new Game(playerTeam, cpuTeam);
  helpOpen = !seenHelp;
  $("help").classList.toggle("hidden", seenHelp);
  show("game");
  resize();
  syncHud();
}

function endMatch(): void {
  if (!game) return;
  const m = game.match;
  $("over-you").textContent = String(m.score.player);
  $("over-cpu").textContent = String(m.score.cpu);
  if (m.winner === "player") {
    $("over-title").textContent = "You win!";
    $("over-kicker").textContent = "Final whistle";
    $("over-sub").textContent = "Your Pokémon took the gridiron.";
  } else if (m.winner === "cpu") {
    $("over-title").textContent = "CPU wins";
    $("over-kicker").textContent = "Final whistle";
    $("over-sub").textContent = "Switch up the roster and go again.";
  } else {
    $("over-title").textContent = "It's a tie!";
    $("over-kicker").textContent = "Final whistle";
    $("over-sub").textContent = "Same score. Play another game to break it.";
  }
  show("over");
}

function resize(): void {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
}

function syncHud(): void {
  if (!game) return;
  $("sb-you").textContent = String(game.match.score.player);
  $("sb-cpu").textContent = String(game.match.score.cpu);
  $("sb-clock").textContent = clockLabel(game.match.clock);
  $("sb-down").textContent = downLine(game);
  const poss = game.match.possession === "player" ? "YOU possess" : "CPU possesses";
  $("sb-spot").textContent = `Ball on ${Math.round(game.match.ballYard)} · ${poss}`;
}

function frame(now: number): void {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  if (screen === "game" && game) {
    const input = pollInput();
    if (helpOpen) {
      if (input.spacePressed) dismissHelp();
    } else {
      game.update(dt, input);
      if (game.ended) endMatch();
    }
    syncHud();
    renderGame(ctx!, game, canvas.width, canvas.height);
  }
  requestAnimationFrame(frame);
}

function dismissHelp(): void {
  helpOpen = false;
  seenHelp = true;
  $("help").classList.add("hidden");
}

$("btn-play").addEventListener("click", () => {
  unlockAudio();
  sfx.snap();
  renderRoster();
  show("team");
});
$("btn-back-home").addEventListener("click", () => show("home"));
$("btn-start").addEventListener("click", () => {
  unlockAudio();
  startMatch();
});
$("btn-got-it").addEventListener("click", () => {
  unlockAudio();
  dismissHelp();
});
$("btn-again").addEventListener("click", () => {
  renderRoster();
  show("team");
});
$("btn-home").addEventListener("click", () => show("home"));
$("btn-mute").addEventListener("click", () => {
  const muted = toggleMute();
  $("btn-mute").textContent = muted ? "Sound off" : "Sound on";
});

window.addEventListener("resize", resize);
installInput();
renderRoster();
void loadSprites();
requestAnimationFrame(frame);
