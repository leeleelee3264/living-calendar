# Living Calendar

A serverless, single-file household chore board designed to run 24/7 on a wall-mounted tablet.

Two people share a home and split recurring chores; this board shows what needs doing today, who is on rotation, and what is coming up — without any backend, account, or build step. Just one `index.html`.

## Features

- **Single HTML file** — no server, no dependencies, no build. Open `index.html` and it works.
- **Today's checklist** with a progress bar, plus a weekly strip and a D-day card for upcoming chores.
- **Automatic rotation** — fixed and alternating owners are computed from a start date, so the board keeps itself current. Rotation is shown as a real date + name (e.g. "Next: Sat → Person A"), never as internal jargon.
- **Bilingual UI** — Korean / English toggle.
- **Always-on friendly** (for wall-mounted tablets):
  - Automatic rollover at midnight.
  - Night screen-off window (blacked out with a floating clock) to reduce OLED burn-in.
  - Touch-to-wake after a period of inactivity.
  - Pixel shift every few minutes as extra burn-in protection.
- **No save button** — every change (owner swap, settings) applies instantly.
- **Local-first** — all state is kept in `localStorage`, so each device holds its own checklist. The wall tablet acts as the single source of truth.

## Usage

Open `index.html` in any modern browser. All chores, weekdays, owners, and rotations are editable in the ⚙️ settings — no code changes required to run it for a different household.

### Configuration

Everything is driven by a settings object stored under `localStorage`. You can adjust:

- **People** — two participants, each with a display name and color.
- **Daily / weekly / biweekly / monthly chores** — frequency, weekday, and owner (fixed or alternating).
- **Display** — theme schedule and the night screen-off window.

> Note: changing the settings schema requires bumping the `localStorage` key version, otherwise an old saved config can override the new defaults.

## Tech notes

- Pure HTML + CSS + vanilla JS in one file (~43 KB).
- No framework, no bundler.
- Because it is designed to be always-on, layout is optimized for a landscape tablet (two-column dashboard), and it falls back to a vertical stack on phones.

## Roadmap

- Shopping list card (shared, add-as-you-spot).
- GitHub Pages hosting + PWA install for easier phone access and updates.
- Optional lightweight sync backend so checks can be shared across devices.

## License

Personal project. Feel free to fork and adapt for your own household.
