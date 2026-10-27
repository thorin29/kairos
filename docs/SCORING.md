# Scoring

How every number on the Characters page is made, where each rule lives, and the
traps that have already bitten. Read this before changing anything that scores.
The plain-language version people see is `src/lib/scoring/guide.ts` (web
`/scoring`, app Settings → How scoring works) — change it in the same release as
any rule here.

Everything is **derived at read time** from tasks and a few dated rows. Nothing
scored is stored except a companion's `growthBanked` when it goes to the gallery.
`loadProgression()` in `src/lib/queries/progression.ts` computes it all.

## The three things a person builds

| | What it measures | Moves when | Rule |
|---|---|---|---|
| **Level** (and five skills) | Everything ever finished | Immediately | XP below |
| **Character growth** | How much of each day's list got finished | Immediately (today lighter) | `companions-growth.ts` |
| **This month** | The same day credit, summed for the month | Immediately | `creditBetween` |

They are deliberately separate. Level rewards volume (more done = more XP).
Growth and the month reward *finishing your own list*, as a share, so a long
list and a short list are on equal footing.

## 1. XP, level, skills, class

- Each completed task: `effort × 10` XP (`XP_PER_EFFORT`). Effort is the chore's
  1–5; everything else is 1 (`taskEffort`, `src/lib/scoring/weights.ts`).
- A scored test: up to +20 XP (`TEST_SCORE_BONUS_XP`) by score.
- Leisure reading → Scholar, 2 XP per chapter or 10 pages (`readingXpForBook`).
- Personal Bible reading → Wisdom, 2 XP per chapter (`bibleXpForChapters`).
- A confirmed team-sport event ("Yes, I did it") → Life, `SPORT_LIFE_XP` (10).
  The same confirmation also completes the day's workout task (Strength) — that
  one is the workout, this one is showing up for the team.
- Initiative bonuses (`loadBonuses`) add lifetime XP.
- Skills: task category → skill via `SCORE_GROUPS`: CHORE→Chores,
  EXERCISE→Strength, BIBLE→Wisdom, SCHOOL→Scholar, WORK/APPOINTMENT/OTHER→Life.
  (WORK and APPOINTMENT are calendar events, never tasks, so Life is one-off
  tasks plus sport.)
- Level curve: `levelCost(n) = 100 × 1.18^(n-1)`.
- Class: the skill most above the family's baseline (`classFromSignature`), so
  work everyone does (daily Bible) doesn't decide anyone's class.

## 2. Day credit — the unit behind growth and the month (v0.603)

`dayCredit(day) = effort finished ÷ effort due that day`, 0..1. A day with
nothing due is worth 0. Every task due that day counts, finished or not
(skipped tasks are excluded upstream). A late finish raises its due day.

- **Today counts live.** It rises as tasks are finished and can fall the same
  day if one is unchecked or a new one lands. The bar draws today's part lighter.
- **Past days only rise** (a late finish), never fall.
- A **perfect week** (all effort done) adds `WEEK_GROWTH` (2) once it has ended.

Before 0.603 a day counted 1 only if *everything* was done, and 0 otherwise.
With 8+ items a day the kids almost never had a perfect day, so their
characters stalled while a parent with one Bible reading a day grew every day.
The new rule is never lower than the old one for any history (tested), so no
character shrank when it shipped.

## 3. Character growth, stages, eggs — one thing at a time

```
egg (none yet) → hatch → GROWING ──(growth reaches 12)──► ADULT: egg ready
                                                         ├─ hatch → new character starts GROWING;
                                                         │          this one goes to the gallery
                                                         └─ deepen → DEEPENING ──(6 more)──► SHINY: egg ready → hatch
```

- Growth = `growthBanked` (earlier tenures) + day credits and perfect weeks since
  this tenure began. Stages: juvenile at 6, adult at 12 (`CLEAN_DAY_STAGES`).
- **No egg while growing or deepening.** An egg exists only at adult or shiny
  (`companionPhase`). Hatching is never concurrent with growing: the next
  character can't be started until this one is grown (or made shiny).
- First character: with none active, the egg is ready immediately.
- Deepening growth is counted from the day deepening started.
- `phaseGoal` / `phaseProgress` are what the label shows ("7.4 / 12", or
  "2 / 6" while deepening). Adult and shiny show no label — they wait on a choice.
- Which species hatches: random, never one already owned (`pickHatch`), rarity
  tilted by **luck** = `(average credit over the last 14 settled days − 0.5) / 0.5`,
  clamped 0..1 (`luckFromCompletion`). Before 0.603 luck came from the streak,
  which one missed chore reset — the kids never had any.

## 4. Switching characters (the gallery)

A tenure = the span a character is active. Rules (`companions-growth.ts`):

- A **day belongs to whoever is active at its end.** A tenure starts on the
  household day it was activated (`todayISO(date)`, never the UTC date — that
  turned evening switches into "tomorrow" and lost the day; fixed 0.602).
- Retiring (switching away or hatching) **banks settled growth only** — up to
  yesterday (`settledGrowth`). Today moves with the character that takes over,
  so it is never counted twice (0.603).
- A **perfect week belongs to whoever holds it when it ends** (its last day on or
  after the tenure's start). Before 0.602 a mid-week switch lost the week.
- `bankedGrowthFloor(mintedStage)`: a shelved character never comes back below
  the stage the gallery showed. Rows shelved before 0.576 have `growthBanked 0`
  and rely on this floor — **they hold only the stage minimum, not what they
  earned**, so "everything earned − what the shelf holds" is NOT lost growth.
  0.602.0 assumed it was and turned a new hatchling into an adult (reverted in
  0.602.1). Growth lost to old switches can't be rebuilt: switches aren't logged.

Tested: random switch histories (several switches a day, today live) always sum
to exactly what was earned.

## 5. This month and the family goal

- `monthlyCredit` = sum of day credits in the season window, today live.
- A child meets the goal at `month.goalCleanDays` (admin: Season planner, "Days to
  finish the month", default 15) days of work. The family goal is met when every
  child meets it; a carried goal is judged on its own month (`creditBySeason`).
- `season.tier` (completion in eighths, +2 bonus tiers) is still computed for
  older apps but is no longer shown — "This month: X / target days" replaced it,
  so the month is one number that means the same as the family goal.

## 6. Streaks and badges

- Streak: days in a row with everything finished (a miss breaks; days with
  nothing due bridge). It is a badge only — it no longer drives luck.
- Perfect weeks, best week %, mastery titles (a chore done many times).

## 7. The bar

`growthRow` (`src/lib/scoring/growth-cells.ts`), sent to the phone as `xpCells`:
20 squares toward adult, break after 10 (juvenile). Coloured by **what earned
the growth** — each day's credit split by the effort finished per skill that
day (`growthMix`), grouped by skill. Before 0.603 the colours were the all-time
XP mix, so logging reading recoloured squares without filling any. Squares from
`pendingFrom` on are today's (lighter).

## Where to look when numbers seem wrong

1. Admin → Season planner → copy the scoring snapshot. It has, per person,
   days of work this month, completion by skill, today's credit, growth, phase,
   luck and the last 14 days' completion.
2. Low growth with high level: their list is long and partially done — check
   `completionBySkill` for the skill that's dragging.
3. A character "reset": check `mintedStage`/`growthBanked` on its row and whether
   it was switched on a day with the old (pre-0.602) code.
