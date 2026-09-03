export interface AbilityDef {
  id: string;
  name: string;
  desc: string;
  cooldown: number;
  duration: number;
}

export interface PokemonDef {
  id: string;
  name: string;
  type: string;
  color: string;
  accent: string;
  speed: number;
  strength: number;
  throwing: number;
  catching: number;
  radius: number;
  mass: number;
  ability: AbilityDef;
  blurb: string;
}

export const ROSTER: PokemonDef[] = [
  {
    id: "pikachu",
    name: "Pikachu",
    type: "Electric",
    color: "#F6D023",
    accent: "#C9A116",
    speed: 9,
    strength: 4,
    throwing: 6,
    catching: 7,
    radius: 20,
    mass: 1,
    ability: {
      id: "volt-dash",
      name: "Volt Dash",
      desc: "A burst of lightning speed.",
      cooldown: 10,
      duration: 0.7,
    },
    blurb: "Elusive runner. Hard to catch in the open field.",
  },
  {
    id: "machamp",
    name: "Machamp",
    type: "Fighting",
    color: "#6B8CAD",
    accent: "#C03028",
    speed: 5,
    strength: 10,
    throwing: 4,
    catching: 5,
    radius: 26,
    mass: 1.6,
    ability: {
      id: "power-slam",
      name: "Power Slam",
      desc: "The next tackle cannot be broken.",
      cooldown: 12,
      duration: 5,
    },
    blurb: "Goal-line tackler. Wins most collisions.",
  },
  {
    id: "charizard",
    name: "Charizard",
    type: "Fire/Flying",
    color: "#F08030",
    accent: "#58C8B0",
    speed: 7,
    strength: 6,
    throwing: 10,
    catching: 6,
    radius: 27,
    mass: 1.35,
    ability: {
      id: "flame-bomb",
      name: "Flame Bomb",
      desc: "The next pass is a blazing long bomb.",
      cooldown: 11,
      duration: 6,
    },
    blurb: "Star quarterback. Deep-ball specialist.",
  },
  {
    id: "snorlax",
    name: "Snorlax",
    type: "Normal",
    color: "#4A7E9B",
    accent: "#F0E0B0",
    speed: 3,
    strength: 9,
    throwing: 3,
    catching: 4,
    radius: 34,
    mass: 2.4,
    ability: {
      id: "belly-block",
      name: "Belly Block",
      desc: "Become an immovable wall.",
      cooldown: 14,
      duration: 2.2,
    },
    blurb: "Human (Pokémon) wall. Best used to clear a lane.",
  },
  {
    id: "gengar",
    name: "Gengar",
    type: "Ghost/Poison",
    color: "#705898",
    accent: "#E05090",
    speed: 8,
    strength: 5,
    throwing: 6,
    catching: 9,
    radius: 23,
    mass: 0.95,
    ability: {
      id: "shadow-slip",
      name: "Shadow Slip",
      desc: "Ghost through tackles for a moment.",
      cooldown: 12,
      duration: 1.55,
    },
    blurb: "Slot receiver. Slippery after the catch.",
  },
  {
    id: "lucario",
    name: "Lucario",
    type: "Fighting/Steel",
    color: "#3B6FA0",
    accent: "#E8E0C8",
    speed: 7,
    strength: 7,
    throwing: 8,
    catching: 7,
    radius: 22,
    mass: 1.15,
    ability: {
      id: "aura-pulse",
      name: "Aura Pulse",
      desc: "Slow every nearby opponent.",
      cooldown: 13,
      duration: 1.4,
    },
    blurb: "Dual-threat. Solid at every skill.",
  },
];

export function pokemonById(id: string): PokemonDef {
  const found = ROSTER.find((p) => p.id === id);
  if (!found) throw new Error(`Unknown Pokémon: ${id}`);
  return found;
}

export function assignCpuRoles(team: PokemonDef[]): PokemonDef[] {
  const rest = [...team];
  const qb = takeBest(rest, (p) => p.throwing);
  const wr = takeBest(rest, (p) => p.catching);
  const rb = rest[0];
  return [qb, wr, rb];
}

function takeBest(list: PokemonDef[], score: (p: PokemonDef) => number): PokemonDef {
  let bestI = 0;
  for (let i = 1; i < list.length; i++) {
    if (score(list[i]) > score(list[bestI])) bestI = i;
  }
  return list.splice(bestI, 1)[0];
}
