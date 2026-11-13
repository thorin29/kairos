# Kairos

Kairos is a self-hosted dashboard for running a household: daily chores, school
assignments, Bible reading plans, workouts, work shifts, and appointments —
all rolled up into a single screen that shows who has finished what today.

Built for a wall tablet or laptop in a shared space. Everything lives on your
own server; no accounts, no cloud, no third parties holding your family's
schedule.

**[Roadmap](ROADMAP.md)** — everything planned, and what is already built.
**[Architecture](ARCHITECTURE.md)** — how it works and why.

> **Status:** in active use, web `0.581.0`. The core modules — chores, Bible
> reading, workouts, game time, groceries, calendar, school with the curriculum
> planner, and the summary — are built, and the companion Android app mirrors the
> personal view. A few things are still to come; see the roadmap below.

## What it does

- **Overview at a glance.** Each person's day summarized by category, with
  completion shown as a percentage or a simple done/not-done state.
- **Chores.** A weekly pattern that varies by day, editable by a parent, that
  generates each day's list automatically. Shared chores anyone can claim,
  and collaborative chores several people split, on a frequency you choose.
- **Bible reading.** Generate a plan of any length; the app divides the text so
  nothing is read twice, with per-weekday chapter counts you control, and
  tracks how far the household has actually come.
- **Workouts.** Per-person plans, rotations or **programs** (5/3/1, Boring But
  Big, wave loading and more) that write the plan, with every set logged
  against last time's. A day can hold warm-ups, strength, core, cardio,
  conditioning (with a timer for every format and a library of named workouts,
  Rx or Scaled), mobility, stretching and isometrics. Suggestions offer the
  next weight, a lighter day or a swap around a sore spot, and never act on
  their own. Progress lives on a body map with a **training heat map** whose
  colour is earned by getting stronger and eases back when progress stalls,
  plus an endurance gauge, a page per lift, weekly training, cardio and
  conditioning charts, and a workout-days grid. A parent can set a **family
  WOD** that people opt into. Anyone can pause their own workouts when sick,
  injured or away, and rows sync from **Concept2**.
- **Game time.** A per-person view of how much each kid actually played today,
  this week, and this month, with a per-game breakdown and per-system icons.
  Monitoring only — the numbers are pulled automatically for awareness, not
  enforced (the old allowance/token model was retired). A standalone collector
  service watches Xbox (via Home Assistant), Steam, and allowlisted PC apps
  through Family Safety, and pushes resolved daily
  totals to `/api/v1/game-time/ingest`; Kairos owns the durable history.
- **Shopping.** A shared shopping list that learns the items you buy and their
  icons — including a custom set of 244 colourful icons for the items and stores
  that emoji handle badly, offered as suggestions and searchable from the admin
  picker. A line can carry a quantity (×10). Drag items to reorder them or move them between stores. Tap **Shop** on
  a store and pick who's going: that store becomes their trip, with a line on
  their dashboard card that opens a big-tap checklist on its own page. Finishing
  keeps whatever wasn't bought for next time.
- **Work and appointments.** Shifts, lessons, practices, and visits on a week
  grid with an hourly gutter, color-coded by person or by category. Events and
  medical appointments take a short note, and a parent can file an event under
  anyone in the house from the web or the phone.
- **Import from email.** Open an `.ics` invite on the phone (or use **Import
  .ics** on the web) and New event opens filled in from it — name, times,
  location and note — leaving only whose calendar, the type and reminders.
- **Subscribed calendars.** Point it at any public ICS feed and those events
  land on the same grid.
- **Hockey.** Open ice for the coming week (stick and puck, drop-in, parent and
  child, public skate) with sign-up counts, read from a separate
  `ice-time` container (its own repo). Add a session
  to the calendar in one tap.
- **Themes and dark mode.** A household-wide color theme (eight options) and
  dark mode, set from Admin → Appearance.
- **Companion Android app.** A native phone client (repo `kairos-app`) mirrors
  the personal view over the `/api/v1` API, works offline, and adds per-device
  themes, profile editing, local calendar reminders, a home-screen widget for
  the next 7 days, and a workout timer that keeps running outside the app.
- **Overdue carries forward.** Anything left unfinished is flagged and shown
  again the next day without losing its original due date.
- **School pace.** Work completed anywhere marks the curriculum plan done; work
  pulled ahead shows the date it was moved from, and work you're behind on is
  tinted red on the card.
- **Family goals and companions.** A monthly family goal that carries forward
  until a parent signs it off, and collectible companions each person raises
  through growth stages, deepens, and can swap back in from their gallery — or
  use as their profile picture, at any stage they've reached (chosen in the app).

## Roadmap

The full, detailed roadmap lives in **[ROADMAP.md](ROADMAP.md)**. At a glance:

Built:

- [x] Data model, migrations, container pipeline
- [x] First-run setup and household management
- [x] Overview dashboard with per-category completion
- [x] Chores — weekly patterns, shared and collaborative, daily generation
- [x] Bible reading plan generator with progress tracking
- [x] Workouts — plans, rotations and programs, every set logged, a progress
      heat map, conditioning with a timer, family WODs and pauses
- [x] Game time — automatic monitoring, fed by the game-time collector
- [x] Shopping — a learning shared list, with per-store shopping trips
- [x] Hockey — the week's open ice from the ice-time container
- [x] Week and month calendar views, plus a signed-in **personal calendar**
      (its own day/3-day/week/month/agenda views, per-user filters and colours)
- [x] ICS calendar subscriptions
- [x] School — assignments, tests, subjects and class schedules
- [x] Curriculum planner — turn a book's lessons or a typed list into dated
      schoolwork spread across a term's school days (wizard, paste, or CSV),
      review and reorder it, publish it to the kids' cards, then compile and
      rebalance a student's whole term day by day
- [x] Calendar import — a single event from an `.ics` file, phone and web
- [x] Seasons — a personal-progression RPG: character levels, per-category
      stats and class, a monthly season ladder, streaks, badges and mastery
      titles, all fuelled by fair, effort-weighted completion (nobody ranked)
- [x] Mobile API — versioned `/api/v1` with per-person device-token sign-in,
      the foundation for the phone app

- [x] **Native Android app** (Kotlin / Jetpack Compose) over the versioned API —
      offline-first, with its own themes, profile editing and local reminders
      (repo `kairos-app`; replaced the earlier PWA idea)

Planned:

- [ ] Weather panel and forecast
- [ ] Smooth drag-and-drop reordering

(The curriculum planner's "Stage 3" term-level draft was dropped: a class is
reopened by unpublishing it to draft, editing and republishing — see ROADMAP.)

## Requirements

- PostgreSQL 14 or newer (18 recommended)
- Docker

## Setup

### 1. Create a database

The app needs its own database and user. Against an existing PostgreSQL
container:

```bash
docker exec -it <your-postgres-container> psql -U postgres
```

```sql
CREATE USER famdash WITH PASSWORD 'choose-a-strong-password';
CREATE DATABASE familydashboard OWNER famdash;
```

### 2. Run the container

The container name, database name, and image path below are just identifiers —
call them whatever you like. They don't have to match the product name; the app
only cares about `DATABASE_URL` pointing at the right database.

```bash
docker run -d \
  --name family-dashboard \
  -p 8642:3000 \
  -e DATABASE_URL="postgresql://famdash:choose-a-strong-password@<postgres-host>:5432/familydashboard?schema=public" \
  -e TZ="America/New_York" \
  -v /path/to/appdata/family-dashboard:/app/data \
  ghcr.io/<username>/family-dashboard:latest
```

If PostgreSQL also runs in Docker, put both containers on the same network and
use the database container's name as the host.

Schema migrations apply automatically on start, so upgrading is just pulling a
newer image.

### 3. Create your household

Open `http://<host>:8642` and follow the setup prompts. The first account you
create is a parent; add everyone else from the same screen, then invite each
person to the phone app, which is where passwords are set.

The web requires a parent's sign-in on every page. Children sign in on the
phone app, not the web. A shared screen is signed in once by a parent and then
works for the whole household. Until some parent has a password (a fresh
install), the web stays open so you can finish setup. Admin settings also sit
behind an optional shared PIN, which keeps others out of settings.

## Configuration

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `TZ` | no | Local timezone for due dates and the calendar. Defaults to UTC. |
| `PORT` | no | Port inside the container. Defaults to `3000`. |
| `PUID` / `PGID` | no | Ownership for files in the data volume. Defaults to `99:100`. |
| `DATA_DIR` | no | Where uploads and backups are written. Defaults to `/app/data`. |
| `WEATHER_LAT` / `WEATHER_LON` | no | Coordinates for the weather panel |
| `ACCUWEATHER_API_KEY` | no | Required only if using AccuWeather |
| `SESSION_SECRET` | no | Signs sign-in cookies. Without it Kairos makes and stores its own. |
| `FRAME_ANCESTORS` | no | Who may show Kairos in a frame (CSP `frame-ancestors`). Defaults to the same site only, e.g. `'self' https://dashboard.example.com` for a dashboard that embeds it. |
| `REAL_IP_HEADER` | no | The header your proxy puts the client address in, for sign-in and PIN rate limits. Defaults to Cloudflare's, then `X-Forwarded-For`. |

See `.env.example` for the full list.

### Unraid

`unraid-template.xml` can be imported directly. Replace the repository field
with your own image, set `DATABASE_URL`, and point the data volume at your
appdata share.

## A note on security

The web needs a parent's password on every page, and the phone app uses
per-device tokens that can be revoked one at a time. Sign-in, invite codes and
the PIN are rate-limited. Even so, Kairos is built for a household on a trusted
network. If you publish it beyond your LAN, put it behind a reverse proxy with
real authentication in front, with a bypass for `/api/v1` only, which
authenticates every request itself.

## Development

```bash
npm install
cp .env.example .env      # point DATABASE_URL at a local PostgreSQL
npx prisma generate       # Prisma 7 generates into src/generated
npx prisma migrate deploy
npm run dev
```

The codebase is organized by domain under `src/`, so each feature area can be
worked on without touching the others.

Before shipping, run `scripts/preflight.sh` — a full typecheck with the real
Prisma client, a scan for raw `\uXXXX` escapes in JSX text, and a check that every
Prisma field read was selected. When the calendar-file import rule changes, run
`scripts/ics-parity/check.sh` against a clone of the app repo too (it needs
`kotlinc` and `tsx`).

## Tech

Next.js 16 (App Router) · TypeScript · Prisma 7 · PostgreSQL · Tailwind CSS

## License

MIT
