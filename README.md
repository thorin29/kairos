# Kairos

Kairos is a self-hosted dashboard for running a household: daily chores, school
assignments, Bible reading plans, workouts, work shifts, and appointments —
all rolled up into a single screen that shows who has finished what today.

Built for a wall tablet or laptop in a shared space. Everything lives on your
own server; no accounts, no cloud, no third parties holding your family's
schedule.

**[Roadmap](ROADMAP.md)** — everything planned, and what is already built.
**[Architecture](ARCHITECTURE.md)** — how it works and why.

> **Status:** in active use. The core modules — chores, Bible reading,
> workouts, game time, groceries, calendar, and the summary — are built. A few
> are still to come; see the roadmap below.

## What it does

- **Overview at a glance.** Each person's day summarized by category, with
  completion shown as a percentage or a simple done/not-done state.
- **Chores.** A weekly pattern that varies by day, editable by a parent, that
  generates each day's list automatically. Shared chores anyone can claim,
  and collaborative chores several people split, on a frequency you choose.
- **Bible reading.** Generate a plan of any length; the app divides the text so
  nothing is read twice, with per-weekday chapter counts you control, and
  tracks how far the household has actually come.
- **Workouts.** Per-person routines of movements assigned by weekday, with the
  sets, reps, and weight you actually did logged against each one.
- **Game time.** A daily screen-time allowance per person, with weekly tokens
  that buy extra minutes.
- **Groceries.** A shared shopping list that learns the items you buy and their
  icons. Drag items to reorder them or move them between stores. Tap **Shop** on
  a store and pick who's going: that store becomes their trip, with a line on
  their dashboard card that opens a big-tap checklist on its own page. Finishing
  keeps whatever wasn't bought for next time.
- **Work and appointments.** Shifts, lessons, practices, and visits on a week
  grid with an hourly gutter, color-coded by person or by category.
- **Subscribed calendars.** Point it at any public ICS feed and those events
  land on the same grid.
- **Overdue carries forward.** Anything left unfinished is flagged and shown
  again the next day without losing its original due date.

## Roadmap

The full, detailed roadmap lives in **[ROADMAP.md](ROADMAP.md)**. At a glance:

Built:

- [x] Data model, migrations, container pipeline
- [x] First-run setup and household management
- [x] Overview dashboard with per-category completion
- [x] Chores — weekly patterns, shared and collaborative, daily generation
- [x] Bible reading plan generator with progress tracking
- [x] Workouts — routines assigned by weekday, logged with sets and reps
- [x] Game time — daily limits and weekly tokens
- [x] Groceries — a learning shared list, with per-store shopping trips
- [x] Week and month calendar views, plus a signed-in **personal calendar**
      (its own day/3-day/week/month/agenda views, per-user filters and colours)
- [x] ICS calendar subscriptions
- [x] School — assignments, tests, subjects and class schedules
- [x] Seasons — a personal-progression RPG: character levels, per-category
      stats and class, a monthly season ladder, streaks, badges and mastery
      titles, all fuelled by fair, effort-weighted completion (nobody ranked)
- [x] Mobile API — versioned `/api/v1` with per-person device-token sign-in,
      the foundation for the phone app

Planned:

- [ ] Weather panel and forecast
- [ ] **Native Android app** (Kotlin / Jetpack Compose) over the versioned API —
      replaces the earlier PWA idea; see the roadmap and DECISIONS.md
- [ ] Smooth drag-and-drop reordering

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
create is a parent; add everyone else from the same screen. Parent accounts are
protected by a PIN.

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

See `.env.example` for the full list.

### Unraid

`unraid-template.xml` can be imported directly. Replace the repository field
with your own image, set `DATABASE_URL`, and point the data volume at your
appdata share.

## A note on security

Authentication is a profile picker with PINs on parent accounts. That is meant
to keep a household honest on a trusted network — it is **not** hardened for
exposure to the internet. If you publish this beyond your LAN, put it behind a
reverse proxy with real authentication in front.

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

## Tech

Next.js 15 (App Router) · TypeScript · Prisma 7 · PostgreSQL · Tailwind CSS

## License

MIT
