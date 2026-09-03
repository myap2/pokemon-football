# Pokémon Football

Unofficial 3v3 arcade American football game in the browser. Pick three Pokémon, hike, and try to outscore a computer team.

This is a fan-made weekend project. It is not affiliated with Nintendo, The Pokémon Company, or the NFL.

## Play

```bash
npm install
npm run dev
```

Then open the local URL Vite prints (usually `http://localhost:5173`).

## How it works

1. **Home** — title, Play Game, and the desktop controls.
2. **Choose Your Team** — pick 3 of 6 Pokémon. First pick is your quarterback, second is your receiver, third is your running back. The computer gets the other three.
3. **Football Game** — 100-yard field, four downs, first-down line, scoreboard.
4. **Game Over** — final score, winner, Play Again.

### Controls

| Key | Action |
|---|---|
| WASD or arrows | Move the Pokémon you control |
| Space | Snap, throw, hand off, or tackle |
| 1 / 2 / 3 | Choose a receiver (offense) or switch defenders (defense) |
| Shift | Use that Pokémon’s special ability |

When the ball is thrown or handed off, you take control of the Pokémon who now has it.

### Rules in this version

- Four downs to reach the first-down marker (usually 10 yards).
- A first down resets the down count.
- A failed fourth down is a turnover.
- A touchdown is **7** points, then the other team gets the ball at its 25.
- The game ends after **3:00** of play clock (runs during live plays) or **8** possessions.
- No punts, field goals, penalties, injuries, accounts, or multiplayer.

### Roster

| Pokémon | Best at | Ability |
|---|---|---|
| Pikachu | Speed | Volt Dash |
| Machamp | Strength | Power Slam |
| Charizard | Throwing | Flame Bomb |
| Snorlax | Strength / blocking | Belly Block |
| Gengar | Catching | Shadow Slip |
| Lucario | All-around | Aura Pulse |

## Scripts

```bash
npm test      # football-rule unit tests
npm run build # production build to dist/
npm run preview
```

## GitHub Pages

A workflow in `.github/workflows/pages.yml` builds and deploys `dist/` on every push to `main`. Enable Pages in the repo settings with **GitHub Actions** as the source.
