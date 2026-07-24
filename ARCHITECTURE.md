# Architecture

Why the code is shaped the way it is. Read alongside [ROADMAP.md](ROADMAP.md),
which covers what exists and what doesn't.

## Stack

Next.js 15 (App Router) · TypeScript · Prisma 7 · PostgreSQL · Tailwind 4

Dependencies are pinned to exact versions and installed with `npm ci` against
a committed lockfile, so a rebuild months from now produces the same image.

Deployment is a single container published to GHCR by GitHub Actions, running
alongside an existing PostgreSQL instance. Migrations apply on start, so
updating is pulling a newer image.

## The load-bearing decisions

### One task table

Chores, Bible readings, school work, and one-off tasks are all rows in `Task`,
separated by a category and optional links to detail records. Completion
percentages, overdue detection, streaks, and the scoreboard are then single
queries rather than four parallel implementations.

### Dates are not timestamps

A chore is due on a *day*; a work shift starts at an *instant*. Due dates are
`DATE` columns, events are `timestamptz`.

The Node process runs in UTC and the household's real timezone lives in
`HOUSEHOLD_TZ`. This is not cosmetic: the `pg` driver parses `DATE` columns at
the process's *local* midnight, so a process running in Chicago reads back a
stored date as `05:00Z` and compares it as greater than the `00:00Z` value it
wrote. Running in UTC makes reads and writes agree.

All date comparisons are on `YYYY-MM-DD` strings, never on `Date` objects, so
an hours-level offset can't flip one. Everything funnels through
`src/lib/dates.ts`.

### Derived state is computed, not stored

Overdue, chore expiry, and birthday occurrences are read-time rules rather
than columns written by a job. No nightly sweep to run, no backfill when a
rule changes, and no rows drifting out of sync with reality.

Overdue in particular never rewrites a due date. A chore missed on Tuesday
stays a Tuesday chore forever, which is what makes historical stats mean
anything.

### Generators reconcile, they don't append

`generateChores`, `generatePoolChores`, and `generateReadingTasks` each work
out what *should* exist across a window, create what's missing, and delete
unfinished rows that no longer match. An append-only generator leaves orphans
behind whenever a schedule is edited and nothing ever corrects them.

Two things are never touched: anything already complete or skipped, and
anything dated before today.

Chore slots are matched on the assignment they came from, not on who holds
them, so a chore released and claimed by a sibling still fills its slot.

Generation runs on page load and is idempotent, which avoids needing a
scheduler.

### Chore expiry is by succession

An unfinished chore expires the moment the same chore next comes due for
anyone — the floor only needs vacuuming once. Never on a timer, so a monthly
chore stays live for its whole month. Expired instances grey out and count for
nobody, but remain against their original date.

Shared chores are the exception: unassigned, claimed by whoever gets to them,
and rescheduled a fixed number of days after each *completion*.

### There is no per-person sign-in

The dashboard is a shared household screen. Everyone sees everything and
completes their own work without identifying themselves.

The only thing behind a lock is administration: a parent's PIN unlocks the
admin area for a few hours. Sessions are a signed cookie with a secret
generated on first use and stored in `AppSetting` — no session table, no
environment variable.

Guards live in server actions, not only in the UI, and the guard for `/admin`
is in the route layout so a new sub-page is protected the moment it exists.
The unlock page deliberately sits outside `/admin`, because a door can't be
behind the lock it opens.

### Plans are data, generators are code

A household's reading plan lives in the database and never enters this
repository. What ships is the machinery: canon reference, passage parser,
importer, statistics, and the generator. A fresh clone gets an empty plan
builder.

The generator (`src/lib/bible/plan-builder.ts`) is a pure function with no
server dependencies, which is what lets the same code preview a plan in the
browser as the form is filled in and build the saved one on the server. The
server never accepts the preview's output — only the inputs cross the wire and
the schedule is rebuilt on arrival, so the two can't drift.

### Position is laid out, not scrolled to

The reading deck centres today by pushing every card sideways by its distance
from the selection, so the correct arrangement is the first paint. The earlier
version set `scrollLeft` after mount and put today hard against the left edge
whenever the measurement ran before the fonts settled. Anything that has to
measure the DOM to look right will occasionally look wrong.

### The client/server boundary is enforced

`src/lib/prisma.ts` imports `server-only`. Anything a client component imports
is bundled for the browser along with everything *it* imports, so a query
module and a constants module can't share a file — that once dragged the
Postgres driver into the browser build. Constants that both sides need live in
dependency-free modules (`src/lib/days.ts`, `src/lib/bible/books.ts`).

Enum imports used only as types are `import type`, which TypeScript erases.

## Layout

```
src/app/            routes; /admin/* is PIN-guarded by its layout
src/components/     shared UI
src/lib/
  actions/          "use server" mutations
  queries/          read paths for pages
  chores/ bible/ calendar/   domain logic
  dates.ts          every date conversion
prisma/migrations/  hand-written SQL, applied on container start
```

Each feature area has a read-only page anyone can see and an editor behind the
PIN — `/chores` and `/admin/chores`, `/bible` and `/admin/bible`.

## Conventions

- Migrations are hand-written SQL and numbered; `/about` compares the ones
  applied in the database against the ones this build expects, which catches a
  partial deploy in seconds.
- `src/lib/version.ts` carries the version and a short changelog.
- Verify with `npx tsc --noEmit` before shipping. The generated Prisma client
  won't exist until `prisma generate` runs, so errors mentioning
  `@/generated/prisma` are expected locally and resolve during the build.
- Numbers, times, and dates use the `.tabular` class so columns stay aligned
  as values change.
