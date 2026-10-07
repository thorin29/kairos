# Decisions

## 2026-10 — Completion is identity, not a label (v0.557.0)

Two planned workouts on one day both filed under Back are both *named* "Back", because a planned
workout's name is its muscle-group label. `TodayPlan` decided whether a row was logged with
`done.has(w.name.trim().toLowerCase())` against `doneLabels`, which is a list of session LABELS.
So logging one Back workout ticked both, the second could not be recorded through its own row, and
the only way to get it in was "Log a different workout".

Identity had been available the whole time: `loggedByPool` is keyed by pool-exercise id and was
already being used two functions away to prefill the weight fields. A planned workout is now done
when every one of its exercises has a logged weight for that date. A workout with no pool exercises
(HIIT, metric-only) still has nothing but its label to match on, so that path is unchanged and
keeps the same weakness.

The general shape: a label is a rendering of a thing, not the thing. Any time two rows can carry
the same label, matching on it is a coin flip that happens to be right while the data is sparse.

## 2026-10 — Gridlines, the rep floor, and the reset icon (v0.556.0 / app 0.370.0)

**The minor gridlines were invisible, not subtle.** They were `--color-hairline` — already a
near-white #dce3ea — dashed at 0.5 opacity, which on white is almost nothing. They are now a mid
grey at 0.28. Dashes read lighter than a solid line of the same colour, so this lands just under
the solid major lines rather than above them, keeping the hierarchy intact.

Compare draws them too. Without minor lines a bar that tops out above the highest common load (175
against a 155 label) floats over blank space with nothing to measure it by. `weightGrid` already
returned `minor`; Compare was only using `major`.

**A logged set is at least one rep.** `r.reps ?? 0` produced "175 lb × 0" for rows that predate
rep logging. Zero reps says the lift was not completed, which is the opposite of what a row in
`SessionSet` means — the set exists because it was done. The floor is 1.

**The reset button is a reset icon.** It was a calendar on both clients, which suggests opening a
date. The button undoes a selection and returns to today's plan, so `RefreshIcon` / `KairosIcons.Refresh`.

## 2026-10 — One axis, one chart per group (v0.555.0 / app 0.369.0)

**The axis is the dot chart's axis.** Compare was dividing its maximum into quarters and rounding,
which produced 0 / 44 / 88 / 131 / 175 — numbers nobody loads onto a bar. `weightGrid` in
`line-chart.tsx` already solved this for the dot plots: plate-step gridlines labelled at the common
loads. It is now exported and shared. Compare passes `lo = 0` so the bars keep a zero baseline — a
bar chart with a floating baseline lies about proportion — while the labels stay numbers a person
actually lifts.

**Charts belong to the group, not the movement.** Arms with a close-grip bench and an EZ bar curl
drew two "Additional charts" links and two near-identical plots with the same axis. The group is
what is being looked at, so one disclosure sits at the foot of it holding one plot with a line per
movement. Rep-max bars stay per movement inside it, since a rep-max table is about one lift.

**Width.** Bars went 16 to 26 with wider group gaps, and the SVG is centred and allowed to scale to
1.7x its natural width. Capped rather than unbounded: `width: 100%` on a wide screen scales the
labels along with the bars, and a chart whose text grows to 25px because the window is wide is not
better, only bigger.

## 2026-10 — Compare: a bar per weight, fixed width (v0.554.0)

One bar per person threw away the thing worth seeing. Someone who has worked up through 155, 175
and 185 has a progression; flattening it to a single "best" hides it, and the heaviest-weight /
most-reps toggle was two half-answers to a question better answered by showing the sets.

A bar is now one WEIGHT, carrying the best reps achieved at it. Not one bar per set: 175x2 and
175x3 are the same bar drawn twice, and for a given weight the honest number is the best you did.
`CompareSeries.bars` is therefore distinct weights, each with its best reps and the last date it
was lifted, sent newest-first so a cap on the client keeps what is current.

**Fixed width, never stretched.** A chart whose bars thicken as people are removed is a chart where
thickness means something it does not; the eye reads it anyway. Bars are 16px, gaps are constant,
and the SVG grows horizontally with scroll rather than redistributing.

**The budget is shared, not first-come.** `MAX_BARS / people` per person, so one prolific lifter
cannot crowd the others out. Within a person the slice is newest-first, then sorted lightest to
heaviest for display: a person's bars should climb rather than jump about in log order.

The axis starts at zero and the top rounds to something a person would have chosen (5/10/25/50),
because a bar chart with a floating baseline lies about proportion. Hover gives the exact weight,
reps and date, which the axis only approximates.

## 2026-10 — Compare as bars; colour follows the muscle (v0.553.0 / app 0.367.0)

**Compare is a bar per person.** It was a dot plot of everyone's sessions over time, which answered
a question nobody asks here: between people, the interesting thing is their best, not the shape of
their history. One bar each on one scale reads at a glance, and a toggle switches the scale between
heaviest weight and most reps.

Each bar carries the OTHER number above it — the reps at that weight, or the weight at those reps.
A bar alone is one number, and one number cannot tell you whether 175 for 2 beats 155 for 8.
`CompareSeries` therefore gained `bestWeight` and `bestReps` as whole sets rather than bare maxima,
so neither figure arrives without its context.

**Colour follows the muscle, not the theme.** Chart dots and rep-max bars now take the muscle
group's colour on both clients. That palette is a shared constant, identical on web and Android and
independent of the theme accent, so the chart reads as the same thing the body map just highlighted
and the two platforms agree regardless of which theme a device is set to.

Worth recording, because it looked like a bug and is not: the app's accent differs from the web's
because `ThemeScheme` is a LOCAL device setting in `SettingsStore`, not synced from the server. A
phone on OLIVE and a browser on TEAL are both behaving correctly.

Also: the rep-max pills under the app's chart said the same thing as the card directly above them,
detached from any chart and from each other. Removed. And "Best weight at each rep count" is now
"Best reps per weight" on both — note the rows are still keyed by rep count, so if the new name
means the data should pivot to one row per weight, that is a further change.

## 2026-10 — Both figures always; one disclosure, per movement (v0.552.0 / app 0.366.0)

**Both bodies stay.** `view` used to remove a figure — a deadlift showed only the back. Taking a
figure away made the layout jump and removed context the reader was looking at. Both are drawn
now, and `view` instead decides WHICH figure a movement paints: fills are computed per figure, so a
deadlift lights the back and leaves the front grey, a squat lights both, a bench press lights only
the front. The squat/deadlift distinction survives; the disappearing figure does not.

**One disclosure, and it is per movement.** The web had every section — rep maxes, lift progress,
workout days — behind a single "Show details" that got lost on the page; the app had already split
them. Both now agree:

- Under each movement's six tiles: **"Additional charts"**, holding that movement's dot plot (and
  its rep-max bars when it has any; the empty-state card is gone, because an empty card inside a
  disclosure called "Additional charts" is a chart that isn't one).
- Below everything, always visible: **"Lift progress"** (renamed from "Which lifts are moving")
  and **"Workout days"**.

**The whole-plan cards get the whole plan.** Both were being handed the body map's filtered
selection, so they shrank to whichever muscle was tapped. They describe the plan, so they take
every tracked movement. The web's dot chart also moved from per-group to per-movement, which is
where the app already had it.

## 2026-10 — The involvement table stays on the server (v0.551.0 / app 0.365.0)

Porting the body map to the app raised the obvious question: reimplement `involvement.ts` in
Kotlin, or send its answers? Send them. That table encodes what a deadlift works and which figure
it shows on — contested, researched, and already revised twice this month. Two copies would mean
two things to correct every time, and they would diverge silently, because nothing compares them.

`ProgressSeries` therefore carries `navRegion`, `shadePrimary`, `shadeSecondary` and `view`,
resolved once in `bodyMapFor()`. The clients render what they are told. The geometry is shared the
same way: one Python pass traces the artwork and emits both `body-map-paths.ts` and
`BodyMapPaths.kt`, so the two clients cannot show different bodies either.

What stays per-client is only what is genuinely per-platform: SVG paths and CSS variables on the
web, `PathParser` and `android.graphics.Region` on Android.

## 2026-10 — The body map needs the whole plan, not today (v0.550.1)

Tapping Legs on a Shoulders day did nothing. Not a click handler bug: `loadWorkouts` narrowed
`weightSeries` twice — to tracked movements, and then **to today's movements only** — so the page
was never sent a leg movement at all. Every region but today's was inert because it had nothing
behind it.

That narrowing was correct when the thing below the card was "today's chart". A body map is
navigation: its whole purpose is reaching a muscle group you are not training today. The payload
now carries `trackedSeries` (everything tracked, whatever day it belongs to) alongside the existing
`weightSeries` (today's slice, left intact for the places that really do mean today). The body map
and the whole-plan cards read `trackedSeries`; as a side effect the Workout days grid now spans the
whole plan instead of one muscle group.

The general shape of the mistake is worth naming: a UI that filters needs the unfiltered set.
Filtering upstream *and* downstream looks like defence in depth and is actually a dead end, because
the downstream filter can only ever narrow what it was given.

### typecheck-report.mjs: strict at the lines you edited, not across the file

"Any error in a touched file is fatal" resurfaced five pre-existing cascade errors in a 1200-line
query file where ten lines moved. The rule now uses `git diff -U0` hunk ranges (padded three lines
either side): noise is excused away from the hunks and still fatal inside them. Verified by
reintroducing a break at an edited line and confirming it is reported.

## 2026-10 — Body map: today first, one colour per group (v0.550.0)

**The bug.** 0.549.0 shipped two solid black figures. The component asked for `var(--accent)`,
`var(--hairline)`, `var(--surface)` and `var(--fg)`; the app defines `--color-accent`,
`--color-hairline`, `--color-surface` and `--color-ink`. An invalid `fill` is not ignored — SVG
falls back to black — so every region painted black and the whole map looked like a silhouette.
The lesson is narrow and worth keeping: a CSS variable name is an API, and this one was assumed
rather than read. The stray rectangle across the thigh in the same screenshot was the browser's
default focus ring on a focused `<path>`, which is drawn around its BOUNDING BOX; `outline: none`
is now set inline, and keyboard focus is shown as a dashed version of the selection ring instead.

**Today is the default, not a single group.** A day that trains Core and Legs is a Core-and-Legs
day, so the map opens with both lit and both sets of charts shown. Picking a region narrows to it;
a calendar button returns to today. With nothing planned — a rotation, or no plan — it falls back
to the most recently trained region, which is the same answer the server gives for `defaultGroup`.

**One fixed colour per muscle group** (`MG_COLOR`), used by the body, the heading above each chart,
and the Workout days legend. `GRID_COLORS` was positional: a group's colour depended on which
other groups happened to be present, which is tolerable for an ad-hoc legend and useless once the
colour has to mean something. Ungrouped movements still fall back to the positional list, having no
fixed colour of their own. The hues echo the source artwork's key, so the map reads like the
reference illustration rather than a recolour of it.

Shading resolves primary over secondary: a muscle one shown movement trains is not dimmed because
another shown movement merely assists with it.

**Said once.** The muscle group was named three times on screen — today's chips, a label under the
map, and the heading above the charts. The heading stays; the other two are gone. The highlight
says which group is meant, and the heading names it.

## 2026-10 — The body map: selection and shading are different fields (v0.549.0)

The progress page showed every muscle group at once, which was too much. A body you tap is the
replacement, and building it forced the question the deadlift had been asking all along.

**Selection is not shading.** Each traced region carries two attributes:
- `nav` — which tap target a click resolves to. One per region.
- `group` — which muscle group it lights up when a movement works it.

They diverge exactly where it matters. The lower back and glutes are one obvious place to press,
but the pixels under it belong to two groups: the obliques and lumbar erectors are CORE, the glutes
are LEGS. `navRegionFor()` answers "what did they click"; `groupsFor()` answers "what does it work".
Forcing one field to do both jobs is what made the deadlift unfileable for three releases.

**The lower back is part of the core.** Core is the whole trunk — rectus abdominis and obliques in
front, erector spinae and multifidus behind — not just the abs. Treating "core" as "abs" had led to
the conclusion that Core could not be shown on the posterior figure at all. It can: it is the
erectors. A plank now correctly lights the lower back on the back view.

**The artwork did the anatomy.** The source PNG has white separator strokes between individual
muscles, so flood-filling inside them yields real regions — traps, lats, erectors, glutes — rather
than one green mass to slice with an arbitrary horizontal line. Traced with cv2.findContours +
approxPolyDP into `body-map-paths.ts` (~16 KB, 81 paths). Nothing is hand-drawn.

**Selection rings trace the union, not each path.** Stroking every path in a target drew a ring
around all thirteen leg muscles and read as scribble. Each target therefore ships a separate
outline path, traced from the union of its regions after a binary closing to bridge the white seams.

**What the body cannot reach keeps its own block.** A movement with no muscle group, or a FULL_BODY
lift, has no region to be selected from, so those render below the map instead of becoming
unreachable. `navRegionFor` returns null for both.

Keyboard: one tab stop per TARGET, not per path — thirteen focusable leg regions per figure would
put seventy tab stops between the keyboard and the rest of the page.

## 2026-10 — Typechecking: excuse the noise, not the unknown (v0.548.1)

`prisma generate` cannot run in the sandbox — binaries.prisma.sh is unreachable — so
`src/generated/prisma` is absent and `tsc` reports ~460 cascade errors where Prisma row types
collapsed to `any`/`unknown`. The habit had been to grep the report for the error codes that look
build-breaking.

That is an **allowlist**, and it fails silently in the only way that matters: the first error code
nobody thought to list goes straight through. It let two real breaks reach a Docker build —
`TS2538: Type 'null' cannot be used as an index type` (from widening `muscle` to `MuscleGroup | null`
without guarding `MUSCLE_GROUP_LABEL[muscle]`), and two `TS2551`s where client code used the
server's field name `poolExerciseId` on `GraphSeries`, whose field is `exerciseId`.

`scripts/typecheck-report.mjs` inverts it. An error is excused only when it can be ATTRIBUTED to the
missing client: a known cascade code whose message actually names `unknown` or `{}`. Everything else
is fatal, including codes never seen before. And **any** error in a file the working tree has
touched is fatal regardless of code, because those are the files under test.

The distinction that matters: `TS2538` naming `'{}'` is a collapsed Prisma row and is excused;
`TS2538` naming `'null'` is a real bug and is not. Attribution is by message, not code alone.

The script is checked in and verified by reintroducing the 0.548.0 break and confirming it exits 1.
Run `node scripts/typecheck-report.mjs --changed` before packaging any web release.

## 2026-10 — A one-day swap is remembered on the set, not inferred (v0.538.0)

The app can swap a planned movement for a variation for one day (app 0.353). The set lands under the
variation's id, so the planned slot came back blank on the next load: the log was right, the screen
looked wrong. Inferring "this unplanned set must have replaced that planned one" is guesswork, so the
link is now **stored**: `SessionSet.swappedFromId` (migration `116_set_swapped_from`) holds the
planned movement's id, written only when it differs from what was logged.

`loadTodayPlannedWorkouts` keys the day's sets by `swappedFromId ?? poolExerciseId`, so a swapped set
fills the slot it replaced, and the movement reports `loggedAs: { poolExerciseId, name }` — what was
actually done. Clients show the slot with the variation's name and its value instead of a blank row.

## 2026-10 — A movement can belong to no muscle group (v0.548.0)

Seven muscle groups cannot file a deadlift. The EMG literature is no help: the 2020 PLOS ONE
systematic review found erector spinae and quadriceps *more* activated than glutes and hamstrings,
with glute-vs-hamstring results contradicting each other between studies. The biomechanical reading
cuts the other way — the erectors are near-isometric, holding the spine while the hip and knee do
the moving. Both are true; they measure different things. There is no filing that is simply correct.

So the model stopped requiring one. `muscleGroup` was already nullable; now the UI can actually set
it to null, and **a movement with no group charts as its own block, titled with its own name**,
sorted alphabetically among the groups rather than swept into an "Other" bucket. It is a peer, not
a leftover.

This matters beyond tidiness. Filing a deadlift under CORE puts a 300 lb hinge in the same progress
block as a 45-second plank and the chart stops meaning anything; filing it under BACK sits it with
rows and pull-ups, which share no joint action with it, and would have a rotation put a Back day
next to a Leg day while both tax the same glutes and erectors. Its own block avoids choosing.

Selection and highlighting are now deliberately separate concerns:
- **Highlighting** is `involvement.ts`: a deadlift shades glutes, lower back, legs and core, on the
  posterior figure only. Many regions, derived from the movement.
- **Selection** is one nav region per movement — for the deadlift, lower back/glutes. One region,
  chosen for navigation, not anatomy.
  Forcing these to be the same field is what made the deadlift awkward in the first place.

Rotation slots keep requiring a muscle group. A slot is a *day* and a day has a theme; `defaultGroup`
reads `slot.muscleGroup` to decide what opens. A day having a theme and a movement having an
identity are different questions.

Also: front squat's SHOULDERS secondary dropped. The delts are loaded isometrically in the rack
position, which is not shoulder training.

## 2026-10 — Three kinds of person, one progress view (v0.547.0)

A rotation and a weekly plan are not variants of one thing. `loadTodayPlannedWorkouts` queries
`plannedWorkout` by `dayOfWeek` and never consults the rotation, and **`RotationSlot` has no
exercises relation at all** — a slot is a name, a category, a muscle group and a rest flag. So a
person on a rotation has no planned movements in the database, and a person with no plan has
nothing either. Driving progress off the plan gave both of them an empty view while their logged
history sat in `SessionSet`.

Progress is now built from **logged sets**, with `tracked` kept as a flag per series rather than as
the filter. Clients prefer tracked movements when any exist, so a weekly plan still leads with its
own lifts; everyone else now has something instead of nothing. This deliberately softens the
earlier "only tracked movements should appear" rule, which was correct for the person who set it
and wrong for the two cases that have no tracked movements to show.

Three decisions the server now makes once, so the clients cannot drift:
- **Grid rows**: the plan's weekdays, else the rotation's non-rest weekdays, else the weekdays that
  carry a logged session, else empty and the card hides. A rotation is still a plan — what it
  lacks is a weekly shape, not meaning.
- **Opening group**: today's plan, else today's rotation slot, else the most recently trained
  group. Someone with no plan still has a last workout, and that is the one they want.
- **Muscle group per movement**: the plan's filing where there is one, the movement's own otherwise.

## 2026-10 — Movement involvement, and why a deadlift is a leg exercise (v0.546.0)

`src/lib/workouts/involvement.ts` maps a movement name to the groups it works beyond the one it is
filed under. Three rules keep it honest:

**The group a person filed a movement under always wins for primary.** The table only adds
secondaries, so it can never re-file someone's pool behind their back. Where the filing disagrees
with the anatomy — a deadlift kept under Core — the suggested primary demotes to a secondary
rather than vanishing, because otherwise that deadlift would shade no legs at all.

**Matched on name, not id.** The pool is user-created, so there are no fixed ids to key on. That
means no migration and it applies to existing data immediately; the cost is no per-exercise
override until a column earns its place.

**The deadlift is primarily LEGS.** Hip extension makes the gluteus maximus the prime mover; the
lumbar erectors and lats hold an isometric contraction. EMG work finds erector activity in
deadlifts comparable to hip thrusts and other lower-body lifts, so it is not uniquely a back
exercise however it feels afterwards.

That left squats and deadlifts both on LEGS with no way to tell them apart. The fix is not another
muscle group — it is the artwork: the body map has a front and a back, so each rule carries a
`view`. Hip-dominant pulls light the posterior legs, knee-dominant squats light both, leg
extensions the front. Seven groups stay seven groups and the body still distinguishes them.

Two bugs the table caught only because it was run against the real movement names rather than
invented ones: the deadlift demotion above, and `/\bplank\b/` failing on "planks" — the trailing
word boundary broke every plural. Test fixtures should be the user's own data.

## 2026-10 — A weights plan may hold something that is not a weight (v0.546.0)

`metricChoicesFor("WEIGHTS")` returned `["WEIGHT"]`, so every movement in a weights plan had to be
logged as a load. A plank in a Core session therefore asked for pounds. It now offers DURATION and
REPS as well, and the involvement table suggests which: holds are time, counted core work is reps.
Category sets the default, never the ceiling.

## 2026-10 — Shipped is not the same as reachable (v0.542.0)

The detail cards went into `PersonalTop`, which renders only when `personal` is true, the person's
overlay is open, and the overlay is on its menu step. The exercise page renders the per-person
cards with `personal` defaulting to **false**, so the work was live and invisible, and it was
reported as missing because it effectively was.

The check that would have caught it is tracing the component up to a route before claiming it is
done, not grepping that the symbol exists. A typecheck proves a component compiles; it says nothing
about whether anything renders it.

The headline is now its own `LiftHeadline` component used at both sites rather than markup living
inside one of them. Charts draw points with no connecting stroke (`dots` on `LineChart`), including
the Compare card. Compare keeps the chart only: its series are **people** on one movement, so the
per-lift cards ("which lifts are moving") would be meaningless there.

## 2026-10 — The lift detail: three cards, no new queries (v0.541.0)

Behind the headline numbers, "Show details" opens three cards, each answering one question:
**what you can lift** (best real weight at each rep count, bars per movement), **which lifts are
moving** (percent change over 90 days across every tracked lift), and **did you show up** (a
16-week grid of days with a logged set).

All three come from data already on the wire. The 90-day change is computed from the series
points, which carry full history rather than a window. The consistency grid is the union of dates
that carry a logged set — which is why it is labelled "sessions logged" and not "sessions": a
rested or untracked day leaves no mark on it, and the label has to say so rather than imply the
person did nothing.

Percent is used for the cross-lift card because it is the one honest way to put a deadlift and an
overhead press on a shared axis, and the real weights stay in the row so a 5 lb gain on a 95 lb
press cannot pass for a big one. Still no estimated 1RM anywhere.

Two fixes found while reading that code. A rep-max chip printed `\u00b7` as JSX **text**, where it
is not an escape, so it rendered as those six characters — the same bug already fixed once for
`\u00d7`. In JSX, an escape only works inside a string or template literal, never as element text.
And the web logging page grew the phone's three labelled tiles: `ActionButton` in `workouts-grid`
has the right shape but cannot be imported here, because that module already imports this one, so
the tile is defined locally rather than creating a cycle.

## 2026-10 — A name belongs in exactly one place on a card (v0.540.0)

The card had grown three places that print a name: the plan name under the muscle group, a
summary line listing every movement in the plan, and — added with the swap control — a name
above each movement's own fields. Together they read "Core / deadlift / deadlift". Reported as
a regression, which it was not; it was a new row landing on top of two that were already there.
Worth remembering before adding any label: check what the surrounding component already prints.

The layout now is one muscle group at the top, one rule, then each movement named once directly
above its fields with its swap control on the same line, and one rule between movements. The
plan name is hidden inside a group card entirely, since the group heads the card and every
movement names itself.

The same duplicate reached the board's workouts strip from a different direction: that row lists
the day's plan names, and two plans for one muscle group are two rows upstream, so it printed
"Core \u00b7 Core \u00b7 Legs". It now collapses repeats before truncating to three, since a duplicate
otherwise also costs one of the three slots.

The doubled rules came from the same kind of overlap: the group wrapper drew a divider between
plans and `PlanRow` drew its own above the fields, so the two sat together. Only one owner of a
rule per seam.

## 2026-10 — The swap list is grouped, and a log clears only what it sent (v0.539.0)

Two fixes that belong together.

**The picker.** Both clients sorted the pool with the current movement's muscle group floated to
the top and everything else alphabetical. That is not grouping: below the first few rows, chest,
calves and shoulders ran together in one list. Both now render a heading per muscle group — the
movement's own group first, then the rest alphabetically, unassigned last under "Other". The
lesson is that "sorted so the relevant ones are near the top" is not what people mean by grouped;
they mean they can see where one group ends.

**The log.** `logPlannedWorkout` did `deleteMany({ sessionId })` before rewriting, which is correct
only while every one of a plan's movements is always submitted together. It now clears just the
movements the submission covers, matched on **both** `poolExerciseId` and `swappedFromId` so a
swapped set does not survive alongside its replacement as a double. This is what makes a plan
splittable across several cards without one card wiping another's work.

Note the two clients still differ here: the web action creates a fresh session per planned log
while the phone reuses the day's session for that plan. The scoped delete fixes the phone's path;
the web's duplicate-session behaviour is untouched and is the thing to settle before cards are
split by movement.

## 2026-10 — The sandbox can typecheck after all; use it (v0.538.1)

0.538.0 failed its Docker build on a one-word mistake: `PlanRow` gained a `bare` prop in its type
and at every call site, but not in the destructuring, so `bare` was an undeclared name (`TS2304`).
Brace-balance and symbol greps — the verification relied on until now — cannot see that, and it
cost a build.

`npm ci` **does** work in the sandbox (~45s, 247 packages), so `npx tsc --noEmit` runs. What still
does not work is `prisma generate`: the schema engine comes from `binaries.prisma.sh`, which the
sandbox proxy refuses with 403 (`PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1` and `--no-engine` do not
get around it). Without the generated client every Prisma result is `any` or `{}`, so the repo
reports ~459 errors that are pure cascade. The usable check is therefore a **filtered** one: run
`tsc --noEmit` and discard `TS7006`/`TS7031`, `TS2307` on `@/generated`, and the `unknown`/`{}`
errors downstream of them. Whatever survives the filter is real — and crucially the errors that
break builds (`TS2304` undeclared name, `TS2322` bad prop type, `TS2554` wrong arity) do survive it,
because none of them depend on Prisma types.

Run it before packaging any web release. Inspection is the fallback, not the method.

## 2026-10 — Same-muscle plans share a card (v0.538.0)

Two chest plans on a Monday used to be two separate cards with nothing saying they were the same
session's work. They now group: one card, the muscle group named once at the top, each workout with
its own fields and buttons below a divider. Grouping is by `PlannedWorkout.muscleGroup` only —
grouping by name would merge two unrelated plans both called "Workout" — and a plan without a muscle
group keeps its own card. `muscleGroup` now rides along on the planned-day payload so the phone can
group identically.

## 2026-10 — The lift view answers "where am I now" first (v0.538.0)

A line over all history answers a question people rarely ask. Each tracked lift now leads with its
**record** (heaviest set and the reps it was done for), then **change over 30 days**, **how long
since that best** (a stall is information), **session count**, the **last five sessions** as
weight×reps chips, and the **rep-max row**. The chart stays underneath for the long view.

Three rules behind it: every number is a real logged set (no estimated 1RM, anywhere); nothing is
compared across lifts, because a deadlift and a shoulder press share no scale; and the 30-day delta
is **null**, not zero, when there is nothing that old to compare against — a first session is not a
gain.

The web's graphable universe is now **tracked planned movements**, matching the phone, which has
always filtered that way. Before this the web also charted anything ever logged, so the same person
saw different lifts on the two clients.

## 2026-10 — Reps ride along with the weight; the record stays the weight (v0.537.0)

Progress was `Math.max(weight)` per movement per day with reps discarded, so 185x5 and 185x12 logged
identically and every week of rep progress between weight jumps was invisible. `SessionSet` has
always had `reps` and `setNumber` — the gap was in what the log UI collected, not the schema, so this
needed no migration.

The design decision, and it is the owner's: **the record is the weight.** Reps are context carried
beside it, not a number that redefines the record. Estimated 1RM is explicitly rejected as a stat —
its only acceptable use is as a "you could try this" hint when choosing a load, never stored and
never charted.

What that unlocks, all from real logged sets:

- **Day points carry their reps.** On a tie in weight the set with more reps wins the day, because it
  is the better set.
- **The record per movement**: the heaviest set ever, shown with the reps it was done for.
- **A rep-max table**: best weight actually lifted at each rep count that has been logged. No
  interpolation, no estimates, only rep counts that exist.

Deliberately NOT done: per-set logging. The schema supports it, but five sets x two fields per
session is friction that stops people logging at all. One top set with an optional rep count is two
taps and captures most of the signal. An optional "add set" can come later if it is ever wanted.

Both progress paths were updated — the web's `weightSeries` in `queries/workouts.ts` and the device
payload's `ProgressSeries` in `queries/workout-log.ts`. They are separate queries doing the same
thing; a change to one needs the other.

## 2026-10 — A missed workout must be clearable from where it is shown (v0.536.0)

The Overdue list on the exercise pop-out rendered each missed day's plan so it could be *logged*, but
offered no way to say "I'm not doing that". The only route was to switch the date picker to that day
and use the Rest day button there — which nothing on the Overdue list pointed at. The quick **Rest**
on the card header has always meant today (`restDay(user, todayISO)`), correctly, but that made it
look as if skipping were already available and broken.

Each overdue entry now carries **Skip this day**, calling `restDay(user, thatDate)` and bumping a
tick that re-reads `overdueWorkoutDates`, so the row disappears as soon as it is cleared.

This was the web half of the same mistake the app made (app 0.349.0): an action that can apply to
more than one day has to carry the day, and the UI that *shows* a day's problem has to offer that
day's resolution. Surfacing overdue work without a way to dismiss it just moves the nag.

## 2026-10 — The display name is a parent's call, not self-service (v0.535.0)

`updateProfile` is reachable by `requireAdminOrSelf`, which is right for a picture, a colour and a
birthday — those are yours. The name shown on every board, card and task in the house is not: anyone
could rename themselves to anything and it propagated everywhere (`displayName ?? name` is used
throughout). It is now admin-only.

The gate is in the **action**, not just the form: a non-admin's save writes back `user.displayName`
unchanged no matter what the field contains, so a hand-posted `displayName` does nothing. The form
shows the current name as read-only text with "Ask a parent to change this" for non-admins, and
renders the input only for an admin — who can still set it for anyone from the same page, so nothing
moved for parents.

Note the dependency on `isAdmin()` semantics: with no admin PIN set and sign-in not required, it
returns true, so a household running the open-tablet configuration is unchanged by design. Locking
the name down in that configuration means setting an admin PIN.

## 2026-10 — Deepen costs the egg, not a monthly hatch (v0.534.0)

"Deepen" consumed a ready egg **and** one of `EGGS_PER_SEASON_CAP` (3) hatches, in exchange for
`shiny = true` — which renders as a single ✦ beside the companion's name and nothing else. Nobody
would rationally trade a new creature for that, so the button was a trap sitting next to the one
people actually want.

A deepen now consumes the egg (base XP reset, `eggsHatched + 1`) but leaves `eggsThisSeason`
untouched, and is therefore offered in the **capped** state as well — all three hatched this month,
XP for the next egg already earned, nothing else to spend it on. That is where it earns its keep.
Writing `eggsThisSeason` back unchanged is also what keeps the month rollover correct: the value is
read as 0 when the stored `seasonKey` is a past season, so a deepen on the 1st rolls the key forward
without inventing a spend.

Two guards came with it: the server rejects a deepen on an already-shiny companion (it previously
wrote `shiny = true` over `shiny = true`, ate the egg and changed nothing), and both clients hide the
control in that state rather than relying on the error.

**Shiny is now visible, which is what makes the trade worth taking.** One gold, `#f5b400`, shared by
both clients: a radial glow behind the creature, an Overlay tint on the sprite, the name in gold, and
the star. `characters/collection` now selects `shiny` and marks a species shiny if any owned copy is,
so a deepened creature keeps its gilding on the shelf — gold frame, lit cell, star — long after it
stops being the active companion. The **egg** is never gilded; only what hatched from it. Shiny still
has no effect on growth, rarity or luck, and that is deliberate: it is a trophy, not a stat.

## 2026-10 — The egg meter must not round up past the gate (v0.533.0)

`incubationPct` was `Math.round(progress / cost * 100)` while the Hatch button is gated on
`progress >= cost`. Anything from 99.5% up therefore displayed **"Next egg 100%"** with no Hatch
action anywhere on the screen — which reads as a broken feature, not as "nearly there". The meter now
floors and holds at 99 until the egg is genuinely ready, so 100% means exactly one thing.

The gate itself is unchanged and is deliberately two conditions: `eggReady = progress >= cost &&
eggsThisSeason < EGGS_PER_SEASON_CAP`, and `eggCapped` is the same with the cap reached. Both false
means the XP isn't there yet; `eggCapped` means it is, but this season's three are spent and the
season (a calendar month by default) hasn't rolled. `eggsThisSeason` resets by comparison against
`currentSeasonWindow().startISO`, so a month rollover frees the cap without a write.

Diagnosing one of these is a data question, not a code one — the state lives in `CompanionState`
(`incubationBaseXp`, `eggsHatched`, `seasonKey`, `eggsThisSeason`) against the person's lifetime XP,
with the cost being `FIRST_EGG_XP` (80) for the first egg and `EGG_XP` (250) after. Read the row
before theorising.
## 2026-10 — Which dashboard sections are "the day's" and which are "now's" (v0.531.0)

The app prefetches tomorrow so a morning outage still has a page. That only works if a dashboard
asked for a future date is actually that day's page, so each section had to be classified rather than
left on the blanket `dayISO === today` gate it had grown:

- **Built for the requested day** (read-only, already take a date): the day's **schedule**,
  **chore badges**, and **reading progress**. These were gated for no reason beyond the gate being
  easy, and a prefetched tomorrow with no schedule on it is exactly what a user would notice.
- **Date-aware only after v0.532.0**: `loadReadingProgress` picked the active goal against
  `todayISO()` internally and `pendingBibleRewards` was handed the server's `today`, so moving them
  out of the gate in 0.531 made them *look* day-specific while still computing today's answer under
  tomorrow's date. Both now take the requested day (the reward one matters at a month boundary: which
  months count as ended changes on the 1st). The lesson: moving a call out of a `dayISO === today`
  branch is not the same as making it date-aware — open the function and check what it does with the
  date it isn't being given.
- **Current state, no date at all**: `pendingMoneyCount` — a pending approval is pending whenever you
  look; it is not a property of a day.
- **Still today-only, by meaning**: `getAhead`, school progress / get-ahead, `upForGrabs` and
  `alwaysOpen` (a chore is up for grabs *now*, not on a day that hasn't arrived), `workoutOverdue`
  (overdue is measured against the real today), and the admin money banner.

**`ensureGenerated` keeps its `dayISO !== today` guard — do not remove it.** It looks like the reason
a future day would be incomplete, and it isn't: `generateChores`, `generateRecurringTasks`,
`generateWorkoutTasks` and `generateReadingTasks` each run with a **14–30 day horizon from today**, so
tomorrow's rows already exist in the database by the time anyone asks for tomorrow. What the guard
actually prevents is those generators being re-run with a *future* `fromISO`, where their prune step
would be evaluated against a window that no longer starts at today — a mutation, triggered by a read,
on data for a day that hasn't happened. The only single-day generators (`generatePoolChores`,
`generateAnytimeChores`) feed exactly the two sections that remain today-only, so nothing is lost.
## 2026-09 — Icon batches are checked before they ship (`tools/check-grocery-icons.py`)

Two icon defects reached production because nothing looked at the art after slicing, and neither is
visible at 20px in a list row:

1. **The sheet's card and caption were kept** on 13 icons (sunscreen, sponges, plastic-cutlery,
   paper-plates, pain-reliever, lotion, hand-soap, light-bulbs, batteries-pack, allergy-medicine,
   air-freshener, first-aid, dryer-sheets) — the slice took the whole grid cell instead of the object,
   so the white tile, its grey stroke and the printed label all shipped as part of the icon. Repaired
   in v0.530.0 by removing the card's white fill (tight ≥242 threshold, seeded from the border so
   white *objects* like plates and bulbs survive — a looser grey threshold eats them, which was tried
   and rejected), clearing the 4px stroke ring, dropping the low-saturation caption glyphs in the
   bottom third, then re-cropping. No re-generation needed; the art itself was intact.
2. **Clipped art** — ~55 icons run off the bottom of their own canvas, so a bottle has no base
   (grape-juice is the reported case). This one is **not repairable in post**: the pixels were never
   in the PNG. It needs the affected items re-generated, or the original sheets re-sliced with a box
   that follows the object rather than the cell.

`tools/check-grocery-icons.py` now detects both and exits non-zero, so an icon batch can be gated on
it. Clipping is detected by a **hard, fully-opaque run along a canvas edge** — a real silhouette
fades to alpha 0 at its boundary, a cut does not, which is what distinguishes "the art was cut" from
"a flat-bottomed object touches the edge". Run it against `public/grocery-icons/kairos` as the last
step of every icon batch, before bundling to the app. Note the known false positives: shopfront icons
(supermarket, convenience-store, delivery-truck, farmers-market, liquor-store, online-order) sit on a
deliberate flat baseline, and paper-plates trips the white-area check because the plates really are
white.

## 2026-09 — Grocery quantity lives on the line, not in the name (v0.529.0 / app 0.339.0)

`ShoppingItem.quantity` is a nullable 1-99 integer (migration `115_grocery_quantity`). The obvious
cheap alternative — letting people type "Distilled water x10" as the item name — was rejected: the
name is what the catalog remembers and what the icon matcher reads, so a count baked into it creates a
junk catalog entry with a 📦 icon and breaks the suggestion dedupe. Keeping it as its own column means
the catalog, the icons and Re-sync are all untouched by it.

- **Null is the whole "off" state.** `setItemQuantityCore` clears the value for null, a non-number, or
  anything outside 1-99, so an emptied box, a typo and a hostile API caller all land on "no quantity",
  and the line renders exactly as it did before the feature existed. There is no "× 0" and no "× 1"
  special case to explain — 1 is a legal quantity and displays.
- **One renderer rule, four surfaces**: `"<name> × <n>"` when set, the bare name when not — the web
  board, the web cart, and both the saved list and the trip list on the phone.
- The web puts it behind a small `#` button per line that swaps into a two-digit field (commit on
  blur or Enter, Escape reverts); the app shows the box only in edit mode, beside the move/delete
  icons, and commits **on focus loss rather than per keystroke**, so typing "10" is one write, not a
  write for "1" and another for "10".
- The app write goes through the same optimistic + offline queue path as move/purchase, with
  `groceries/quantity` added to the pending-write replay so a change made offline survives a reload
  instead of flickering back.

## 2026-09 — The shipped icon set is offerable as suggestions, without becoming catalog rows (v0.528.0)

The add-an-item list is the household's own catalog, which means an item nobody has bought yet can
only be typed — and a typo creates a second catalog row with a guessed icon instead of matching the
custom art. `src/lib/groceries/suggestions.ts` now holds all 244 `kairos:` items with their canonical
names, generated from the `kairos:` rules in `catalog.ts`, and both clients show catalog ∪
suggestions with the catalog row winning a name clash (case-insensitive).

**They are deliberately not rows.** Seeding them with a migration was the obvious alternative and was
rejected: it would put ~244 unused rows in every household's catalog, and "Re-sync catalog" (which
merges duplicates and refreshes icons) would then have real rows to reconcile against whatever the
household had typed. A suggestion carries no `catalogId`, so picking one goes through the ordinary
add-by-name path: the server creates the row and guesses the icon. Nothing to merge, nothing to
de-conflict.

That only works if a suggestion's name guesses back to its own icon. Every one of the 244 was
round-trip checked through `guessIconInfo`; seven didn't resolve (milk, soda, soup, spices,
mayonnaise, frozen vegetables, stir-fry — the first three matched an emoji rule, the rest nothing),
and the fix was to **widen the matcher rules**, not to rename the items to something that happened
to match. Bare "milk", "soda" and "soup" now resolve to the custom icon rather than 🥛/🥤/🥫; the
kairos rules sit first in `ICONS`, so on an equal-length tie they win. Re-run that round-trip check
after any icon batch — it is what caught the mismatch.

The app carries the same list bundled (`GrocerySuggestions.kt`) so it works offline, which means an
icon batch now touches `catalog.ts`, `suggestions.ts` and the Kotlin mirror together.

## 2026-09 — Custom `kairos:` grocery/store icon set (v0.510–0.521)

Grocery and store icons are stored as a short **token** on the row and rendered by a single
component per client. Three token forms exist:

- a plain **emoji** (still the default for anything an emoji renders well);
- **`ic:<name>`** — five legacy hand-made PNGs (napkin, papertowel, waterbottle, protein, sorbet);
- **`kairos:<slug>`** — the custom colourful set (~226 PNGs today), which is where all new art goes.

**MDI (`mdi:*`) is retired** (v0.516). The bundled Material Design Icons were monochrome and read as
"black blobs" next to emoji; every generic item they covered now resolves to an emoji or a `kairos:`
icon. Do not reintroduce a monochrome icon family. (The earlier "bundled MDI for the emoji gaps"
decision below is superseded by this one; `public/grocery-icons/MDI-LICENSE.txt` is kept only as the
attribution record for the retired set.)

**Rendering.**
- Web: `GroceryGlyph` in `src/components/icons.tsx`. `kairos:<slug>` →
  `<img src="/grocery-icons/kairos/<slug>.png">`; `ic:*` → the map of legacy paths; a bare emoji is
  printed as text. Any **prefixed token we can't resolve renders 📦**, never the raw string — that box
  is the true fallback and the signal that art is missing on this client.
- App: `GroceryGlyph.kt` (`ui/groceries/`) with two maps, `GLYPH_DRAWABLES` (`ic:*`) and
  `KAIROS_DRAWABLES` (`kairos:*`) → `drawable-nodpi/grocery_<slug>.png`. Hyphens in the slug become
  underscores in the Android resource name. Same 📦 fallback.
- Store icons render through the **same** component as item icons (v0.513/0.521), so a store shows its
  picture on the shopping board, the cart page and the add-to-store picker.

**Matching and picking.** `src/lib/groceries/catalog.ts` holds all three: `ICONS` (the name → token
matcher), `GROCERY_ICON_LIBRARY` and `STORE_ICON_LIBRARY` (the searchable picker pools the admin UI
queries). Specific `kairos:` phrase rules are ordered **before** the generic emoji rules and win by
phrase length, so "cherry tomatoes" matches the tomato rule rather than the cherry one.

**Gotchas that cost real releases:**
1. `setStoreIcon`/`setCatalogIcon` once truncated the saved value to **8 characters**, which silently
   mangled every `kairos:` token into a broken image (v0.517). The cap is now 40 — never reintroduce a
   short slice on an icon value.
2. **Ship the server before the app.** The phone can only render art it has bundled, so a token the
   server starts emitting before the matching APK is installed shows 📦. Server first, app second.
3. An HTML `<option>` cannot contain an image, so store **dropdowns** show text; every other surface
   shows the picture.

**Icon creation pipeline (repeatable).** An image tool generates a labelled grid sheet; the sheet is
sliced programmatically (border flood-fill background removal, connected-component detection,
OCR/positional label stripping), each icon named by slug, verified to carry no baked-in label text
(OCR plus an eyeball), downscaled to ~160px, and bundled to **both** repos with the token wired into
`catalog.ts` and `KAIROS_DRAWABLES`. The generation prompt must demand the **label stay clear of the
art** — bold labels touching the object get sliced in, which is exactly what forced the re-cuts in
v0.514 (prepared meals) and v0.515 (stores).

## 2026-09 — Calendar time model: real instants, day segments, exact bounds (v0.521–0.526)

This is settled architecture. Do not reopen it; extend it.

**Storage.** An event stores real `startsAt`/`endsAt` instants. Nothing stores a "day + minutes" pair.

**Layout.** The grid DTO (`src/lib/queries/calendar-page.ts`, `CalEvent`) flattens an event into
per-day **segments**: `dayISO`, `startMin`, `endMin`. In a segment, **`1440` means "the end of this
day" and is a layout boundary only** — it is never an editable clock value and never round-trips to
the server.

**Editing.** The same DTO carries the event's **true bounds**: `startDayISO`, `startMinExact`,
`endDayISO`, `endMinExact` (`toWire` falls back to the segment values when an event doesn't span
days). The editor loads these, so an overnight event (10 PM → 1 AM) opens as the whole event no
matter which day's segment was tapped, and saving a title-only change can't rewrite its end (v0.523).

**Midnight is 00:00 on the next day, never 23:59.** Clock values stay in 0–1439. The app's
`TimePickerDialog` clamps input to 0..23:59 purely as a crash guard (Material3's
`rememberTimePickerState` throws on hour ≥ 24 — the original bug); the clamp is not the time model.

**Two server paths — don't confuse them.**
- The **app** posts to `/api/v1/calendar/event*`, which calls `computeTimes()` / `createPersonalEvent`
  / `updatePersonalEvent` in `src/lib/calendar/create-event.ts`. That path honours `endDate` and
  rejects an end at or before the start.
- The **web** form uses its own server actions in `src/lib/actions/events.ts`, with separate all-day
  handling; it does **not** call `computeTimes`. A change to one path is not automatically a change to
  the other — this has been mis-stated in review before, so check the file.

**All-day is inclusive in the UI, exclusive in storage.** A one-day all-day event shows the same start
and end date; storage keeps the exclusive end (last day + 1). Convert −1 on load and +1 on save.
Both clients have Starts/Ends date fields for multi-day all-day events (app v0.333, web v0.525), and
flipping the All-day switch normalises the dates/times on both (v0.526) instead of producing a
zero-length timed event or gaining a day at the midnight boundary.

**Feedback.** An invalid interval disables Save and reddens the offending field. The app has this;
the web form's version of the red-field/disable feedback, and hiding the exclusive end, are the small
remaining cosmetic gaps (tracked in ROADMAP).

## 2026-09 - Concurrent weekly + rotation (union, each pausable)

A rotation used to suppress the weekly plan in the generator (rotationUsers skip in the planned and
schedule loops). Removed that: both plans now generate independently, so a weekly plan and a rotation
run together and a day is prompted if either schedules it (one prompt per day; the two plans' details
show/log in their own sections and screens). The weekly plan is gated by a per-user weeklyActive
setting (default on); "0" pauses it (no weekly prompts) so it can sit dormant beside a rotation and be
resumed later. The rotation's pause is the existing stop=deactivate (0.505). No migration (settings).
Both plans logging differently (weekly = tracked exercises; rotation = a session/slot) means the
overdue/day-detail merge stays weekly-centric for now; refine if needed after on-device use.

## 2026-09 - Weekly plan optional start date (no migration; via settings)

Weekly plans can now be scheduled to begin on a future day. Stored per-user as a `weeklyStart:<id>`
key in the existing appSetting store (no migration). setWeeklyStart writes it; the generator loads
all such keys and, in the weekly loop, skips any date before a user's weekly start (alongside the
trainsSince/createdAt clamp). Empty/absent = active now (unchanged default). Because a start date is
future-only, past overdue is unaffected. Web: a "Starts on" DateField on the plan editor. App control
and the concurrent weekly+rotation work (each independently pausable, both workouts allowed on the
same day - union, no per-day resolution) are the next releases; both also settings-based, no
migration.

## 2026-09 - Switching weekly <-> rotation preserves both (stop = deactivate)

Stopping a rotation used to delete it (slots cascaded), so switching to the weekly plan lost the
rotation. Both stop paths (stopRotation action, stopRotationCore) now set isActive=false instead,
keeping the rotation and its slots; the generator already ignores inactive rotations and loadRotation
already returns null when inactive, so nothing downstream changes. startRotation already reactivates
an existing rotation, so switching back restores the saved cycle. The weekly plan (PlannedWorkouts)
was always preserved across a rotation. Net: one active plan at a time, both saved, switch freely.
Web gap closed: the weekly editor now has a "Use a rotation instead" switch (it already had "Back to
weekly plan" on the rotation side); the app already had the Rotation entry + stop, so it inherits
this with no app change. Deferred (need their own design + a migration): a user-set start date for
the weekly plan, and running a rotation concurrently with the weekly plan (per-day source of truth).

## 2026-09 - Overdue workouts respect when a planned workout was added (weekly plans)

loadOverdueWorkoutDays judged each past day by loadTodayPlannedWorkouts(userId, iso), which loaded
the CURRENT weekly plan's exercises for that weekday with no time bound. So building or changing a
weekly plan made earlier days - already worked out under the previous plan - look overdue, because
the new plan's exercises hadn't been logged back then. (This was the actual bug behind the "overdue
last week" report; the earlier 0.502/0.503 rotation re-anchor work fixed a real but different
rotation path, not this - the user is on a weekly plan.) Fix: loadTodayPlannedWorkouts now filters
plannedWorkout by createdAt < start of the next day, so a workout only counts for dates on/after it
was added - the same trainsSince floor the task generator uses. The overdue list is computed live on
each load, so this clears an existing false backlog immediately with no data change and no effect on
logged history. Safe for the other caller (today's plan view): current workouts all have createdAt
<= today.

## 2026-09 - Rotation anchor (cycle start date) exposed to the Android app

The web rotation builder already had a "Cycle starts on" date field (setRotationAnchor action); the
Android editor had no equivalent, so a rotation user could only change slots/rest days, never the
start. Added a workouts/rotation/anchor API route (POST { date } -> setAnchorCore) so the app can set
the anchor, and a "Cycle starts on" control on RotationScreen that opens a date picker defaulting to
today. Setting it to today is the one-tap way to start an edited plan immediately and let the
generator sweep any stale overdue prompts - the deliberate version of the 0.502 re-anchor-on-edit fix.

## 2026-09 - Editing a rotation plan re-anchors it to today (no retroactive backlog)

The workout generator backfills an overdue window behind today and rebuilds each person's expected
workout days from their current plan. The weekly-schedule path clamps on effectiveFrom (reset to
today by setScheduleDays) and the weekly-planned path clamps on the earliest plannedWorkout
createdAt, but the rotation shape-edit cores (addSlot/removeSlot/moveSlot/setRestDays) changed the
cycle while leaving anchorDate untouched. So editing a rotation that was anchored weeks ago made the
generator recompute the whole backfill window under the NEW shape against the OLD anchor, inventing
"overdue" prompts for days the old shape never scheduled - even though those days were already
logged under the old plan. Fix: reanchorTodayIfPast() rolls a past anchorDate up to today on any
shape edit, so an edited plan takes effect immediately (from slot 0 today) and the generator's sweep
drops the phantom pending prompts. A future anchor the user set deliberately is left alone (only past
anchors are moved). This is the "assume it starts immediately" behavior; the alternative the user
floated - ask for a start date and keep the old plan running until then - needs the old shape kept
alongside the new one and was deferred. No migration (uses the existing anchorDate).

## 2026-09 - Grocery icons: bundled Material Design Icons for the emoji gaps (mdi: tokens)

> **Superseded (v0.516).** `mdi:` tokens are retired — see the `kairos:` icon-set decision at the
> top of this file. Kept for the history of why a monochrome set was tried.

Items that emoji represented poorly now use Material Design Icons (Pictogrammers, Apache-2.0),
stored as `mdi:<name>` tokens in the same icon string field: soda -> bottle-soda-classic, juice/oil
-> bottle-tonic-outline, yogurt/creamer -> cup-outline, flour -> sack, sugar -> spoon-sugar, spices
-> shaker-outline, sauces/condiments -> soy-sauce, cleaning -> spray-bottle, soap/shampoo -> pump,
tissues -> box, diapers -> diaper-outline, pet -> bowl-mix-outline. Chips/crackers/gum keep emoji
(MDI had nothing better) and the five ic:* customs stay. Rendering is bundled, not fetched (offline
first): web inlines the path from src/lib/groceries/mdi-paths.ts with fill=currentColor; Android
renders app res/drawable/mdi_*.xml vector drawables tinted to the content color. Both GroceryGlyphs
now also fall back to a box for any unknown prefixed token instead of drawing the raw string. This
is why the app (0.315) must ship before the web (0.501) emits mdi: tokens - an older app would draw
the literal text. Room caching is unaffected: the icon is just a longer string on the same payload.

## 2026-09 - Grocery icon matching by head noun + confidence, and locks folded into "manual"

The icon guesser was "first rule in the ICONS list whose keyword appears anywhere wins", so a
modifier stole compound names: "cherry tomatoes" -> cherry, "apple juice" -> apple, "fish sauce" ->
fish. guessIconInfo() now collects every matching rule and prefers the match that ends latest (the
head noun of a "modifier head" name), tie-broken toward the longer/more specific match so phrase
rules like "peanut butter" and "sweet potato" still win. It returns a `confident` flag: false when
nothing matched or two disjoint rules did (a real compound), true for a single match or a phrase
rule that spans its components. The admin derives `needsReview = !iconLocked && !confident` (not
stored, no migration) and surfaces those for one-tap confirm (setCatalogIconLock true) or correction
(picking an icon, which also locks). The visible lock toggle is gone: iconLocked now simply means
"set/confirmed by hand", which re-sync already skips -- so a manual icon is permanent without a
button to reason about. Also raised the setCatalogIcon length cap from 8 to 40 chars, which was
truncating prefixed tokens (ic:papertowel) picked from the palette. Verified the matcher on real
compound names before shipping. This is server-only Release 1; MDI artwork for the weak icons
(soda, juice, yogurt, flour, sauces, tissues, diapers, pet, ...) is the paired web+app Release 2.

## 2026-09 - Home card headline: "Nothing due today" instead of a get-ahead count

The School and Chores home cards headlined the get-ahead backlog when nothing was overdue or due
today, e.g. "180 to get ahead". That number is the sum of up to MAX_PER_SUBJECT (30) upcoming items
per subject, so it read as a to-do count ("do 180 things") when most of it is simply the rest of the
year's lessons - confusing and misleadingly large. Both cards now show "Nothing due today" in that
state. The get-ahead items are unchanged and still listed in the card's Get ahead section; only the
one-line headline changed. School's aheadCount, used only for that headline, was removed.

## 2026-09 — Grocery catalog: icon picker, lock, and custom-image display in admin

Three related admin improvements. (1) The item icon cell was a plain text input, so a custom image
icon showed its raw token ("ic:protein") instead of the picture; it now renders via GroceryGlyph
(image for ic:* tokens, emoji otherwise), same as the shopping board. (2) A picker on each row offers
the palette the guesser knows (exported as ICON_CHOICES from groceries/catalog.ts, the distinct icons
from the keyword map), rendered as their real glyphs; free-typing any emoji still works. (3) A new
iconLocked column (migration 102) lets a locked icon survive a catalog re-sync: resyncCatalogCore uses
the keeper's own icon when locked and re-guesses only unlocked items, while still merging duplicates.
Choosing an icon by hand (picker or type) auto-locks it (setCatalogIcon sets iconLocked=true), since a
deliberate choice shouldn't be re-guessed away; the per-row lock toggle (setCatalogIconLock) releases
it back to re-sync. Web-only; no app change.

## 2026-09 — Server idempotency regression tests (locking in the offline-create contract)

The offline-create idempotency now spans eight independent create paths (book, grocery add,
grocery catalog add, money, task, school, calendar event, recurring task) and exists for a failure
mode manual testing can't reproduce on demand — "DB commit succeeds, HTTP response is lost, the
client retries." Added a small vitest suite (test/idempotency.test.ts) that calls each core twice
with the same clientId against a real disposable Postgres and asserts one row / one id (for
recurring, one template, since a series has no single id to return). No production behavior changed
and there is no migration, so APP_VERSION is intentionally NOT bumped — this is test-only tooling.
The schema is built by replaying the project's own migration SQL in MIGRATIONS order via pg in a
vitest global-setup (the datasource carries no url and production applies migrations with its own
runner, so prisma db push isn't the mechanism here). server-only and next/cache are stubbed via
vitest aliases so the cores load outside the Next runtime. CI: a new Server tests workflow spins up
a Postgres service, runs prisma generate, and runs the suite; it uses npm install rather than npm
ci because the lockfile wasn't regenerated for the added vitest devDependency. test/ and
vitest.config.ts are excluded from tsconfig so the Docker/Next build ignores them.

## 2026-09 — Idempotency for calendar events and recurring tasks (completing the offline set)

Migration 100 gave clientId idempotency to Book/Task/MoneyEntry/ShoppingItem but missed the two
other offline creates. Migration 101 closes them. Calendar: Event gains a global `clientId @unique`
(family events have a null userId, so the key can't be per-owner; a random uuid is globally unique
anyway), createPersonalEvent does a findFirst on clientId before inserting and now returns the
event id, and the calendar route reads clientId and returns the id — so a calendar event created
offline reconciles its temp id to the real one exactly like every other item. Recurring tasks:
RecurringTask gains `clientId` + `@@unique([userId, clientId])`, and createRecurringTask recognizes
a retried create and skips making a second series. Deliberately, the recurring route still returns
only `{ status: "ok" }` with NO id: one recurring create fans out to many Task rows, and the
Android SyncManager treats a returned `id` as the real replacement for a `temp-...` Task id, so
returning a RecurringTask id there would mis-remap. The app needs no change for recurring — it
already sends the clientId on the same AddTask request. A newly created recurring placeholder can
still be acted on before it syncs; that is left as a known UX limitation rather than a queue
redesign. Also hardened the grocery cores: on a rare concurrent duplicate (two identical adds race
past the pre-check, one loses the unique-index insert) they now catch the unique conflict and
return the winning row instead of throwing. The other cores are left as-is: without the catch a
concurrent loser gets a 500, which the app already retries, and the retry's pre-check then finds
the committed row — eventually idempotent, with the unique index still preventing any duplicate row.

## 2026-09 — Server-side idempotency key for offline creates (clientId)

The Android app already sends a durable `clientId` (a random uuid, the client's temp-id) in the
body of every create it makes offline. The server now persists it and uses it as an idempotency
key, so a create the app retries after its response was lost — the row was committed but the id
never got back to the device — is recognized and returns the existing row instead of inserting a
duplicate. Each create core (books, groceries add + add-catalog, money entry, tasks, school work)
does a `findFirst` on the clientId before inserting and returns the existing id if found; the new
row stores the clientId. Migration 100_client_idempotency adds a nullable `clientId` column plus a
unique index to Book, Task, MoneyEntry and ShoppingItem. The column is nullable so every existing
row is unaffected, and a plain unique index over a nullable column allows unlimited NULLs while
enforcing uniqueness on real client ids (a race between two identical retries hits the index rather
than double-inserting). Book/Task/MoneyEntry key on `(userId, clientId)` since they have an owner
column; ShoppingItem keys on `clientId` alone (groceries are a shared household list with no direct
user column, and clientId is globally unique by construction anyway). School work and plain tasks
both write Task, so both are covered by the one Task key; recurring tasks never set a clientId and
so are exempt (their NULLs don't collide). This is the server half of the Android 0.311/0.312
offline-sync work; no app change is needed — the clientId was already on the wire.

## 2026-09 — Create endpoints return the created id (Android offline reconciliation)

The create APIs (books/add, groceries/add, groceries/add-catalog, money/entry, tasks/add,
school/add) returned only `{ status: "ok" }`, discarding the row they had just created. They
now return the created id (books `book.id`, money `entry.id`, tasks/school the created
`task.id`, groceries the `shoppingItem.id`). The success result types carry the id as
OPTIONAL (`{ ok: true; id?: string }`) so the shared update paths and other callers are
untouched, and because the Android client parses with `ignoreUnknownKeys` this is
backward-compatible with existing app builds (they ignore the new field). Recurring-task
creation is excluded — it can materialize multiple Task rows, so there is no single id to
return. Purpose: the Android app can swap an optimistic `temp-<uuid>` id for the real id after
an online create, so a later action (delete/move/complete) never references an id the server
never had.


## 2026-09 — Game time becomes monitoring-only; a collector container is the ingest boundary (pre-build)

Game time is being stripped down to **passive monitoring of minutes played by
children** — by game or in total, either is fine. The token / daily-allowance /
bonus-minute / manual-logging machinery is retired: it was web-only and already
hidden from web nav and the app sidebar, so nothing external calls it. No
enforcement or control; just an honest record of time played.

Collection is deliberately **decoupled** from Kairos behind a stable,
source-agnostic ingest contract, because every upstream Xbox source is fragile.
Microsoft is actively moving Family Safety's private APIs — in mid-2026 Xbox was
pulled out of the Family Safety mobile app into a separate **Xbox Family
Settings** app; the reporting data (daily/weekly totals, per-game, screen time)
still exists, but every reader of it is unofficial and breakable. Kairos never
holds Microsoft or Steam credentials and never talks to those services directly.

**The boundary is a small dedicated "playtime collector" container** — not Home
Assistant talking to Kairos directly, and not brittle HA YAML automations. The
collector owns every per-source adapter and emits one fixed JSON shape to Kairos
(`{child, date, source, game?, minutes}`); Kairos owns the history and the UI.
HA is used *as a source* the collector reads (so we don't hand-maintain the
Microsoft reverse-engineering, and MS credentials stay in HA's `.storage`, off
Kairos), but HA is not the contract — if HAFamilySafety breaks, that one adapter
is swapped inside the collector and Kairos never notices. Steam is its own
adapter polled directly (official Steam Web API `playtime_forever` deltas — no
reverse engineering). The weekly Xbox email is a reconciliation cross-check.
Kairos ingest needs a **new shared-secret service token**: no external-ingest
auth exists today (only per-device bearer + Authelia session). Data model +
contract land after direction is confirmed. (See ROADMAP → Game time.)

## 2026-09 — v0.301–0.349 decision log (reconstructed after the git slip)

DECISIONS.md fell ~69 versions behind when uncommitted entries were lost to a
stray `git checkout`; reconstructed from `version.ts` CHANGES and current code,
grouped by theme.

**Saved addresses (0.301–0.312).** A shared address book so event locations are
picked, not retyped, and carry a full address for phone navigation.
Self-contained — no external geocoder; type-ahead runs over the saved list.
Parent/admin submissions land approved; members' land pending an admin queue
(0.304–0.305). Simplified from categorized to a **single flat searchable list**
(0.308) — categories weren't earning their keep. Calendar "Where" is a
saved-address combobox with a "did you mean?" dedup (0.303); a matched location
shows its friendly name over the raw address (0.309), with a per-address "open
in maps by name" toggle (on for businesses, off for homes). Addresses is its own
page under Calendar admin, edit-gated with pencil/trash per row (0.310–0.312).

**Admin menu + lock (0.311, 0.313).** Admin menu reordered to follow the
sidebar; Device/appearance/email/household/season grouped under Settings. The
lock icon now does a **full page load** after the PIN so the admin session is
recognized on the current page's section — a soft navigation was bouncing back
to the general hub. (Same class as the existing "full navigation after
auth/admin-lock" rule.)

**Calendar & class overlays, and an app-styled date picker (0.314–0.328,
0.331, 0.335).** Event and class overlays unified: same width, side-by-side
sections (Share with beside Reminders, Starts beside Ends), the same pill
dropdowns with one inset chevron everywhere, explanatory paragraphs removed.
Share-with/Reminders became class-style toggle buttons across every event type,
the bell shown only once a person is selected, the owner dropped from the share
list. Classes gained reminders (saved onto the class's meeting event, reusing
the notification pipeline), a Subject type-or-pick combobox, a Where field, and
a Color dropdown with swatches. The browser's native date popup was replaced by
an **app-styled DateField** — first in the calendar, then everywhere it appears
(School, Tasks, Money, Chores, Bible plans, exercise logs, profile birthday,
calendar pause); it closes on any outside click. Custom reminder lead times
replaced the fixed "1 day".

**Event types (0.282, 0.306).** "Other" → "Medical / Dental" (red by default).
"Appointment" → "Event" everywhere it shows; the underlying type is unchanged so
existing events keep their color and behavior.

**Recurring tasks (0.285, 0.293–0.298).** Repeating to-dos (daily /
weekly-on-days / monthly; end never / after-N / on-date) render on the right
days from a template. Recurring history is capped to the **last 2 completed
occurrences** per template (older pruned). Editing edits the **series in place**
(completed occurrences preserved); a recurring occurrence resolves to its whole
series for edit/delete. Recurrence is creatable from the app (task-add endpoint
takes frequency/interval/weekdays/ends; admin form and app share one core).
Optional per-task alert time flows to the app's scheduler.

**Onboarding: 8-character invitation codes (0.287–0.292).** Invitations are a
short 8-char code you can text, read aloud, or paste; entering it runs the full
setup (new password / confirm / reset) then enrolls the device — replacing email
links, which clients strip. Each person has an "Add a phone" action distinct from
"Reset password". (Web `/join` and the legacy enrollment-code path were retired
— see the `/join` entry below.)

**Workout integrity (0.329–0.332).** Fixed workouts silently disappearing:
rest-day / mark-done / log-scheduled were grabbing the day's *first* session and
overwriting it, clobbering a separately-logged workout. Those actions now only
ever reuse the day's own bare/scheduled placeholder and never touch a
separately-logged workout, sport confirmation, or rest marker. Logging the
**same movement** twice in a day now prompts update-or-cancel instead of
silently duplicating; a different movement still logs on its own.

**Subscribed calendars (0.323–0.324, 0.333, 0.342–0.345).** Feed names are
edit-gated with inline rename + remove. A subscribed event can carry per-phone
reminders and — briefly — a manual address; the **web** manual-address/reminder
editor was then **removed (0.333)**: reminders on feeds are set from the app,
and most feeds already include an address. A feed can be **shared with several
people** (names and profile colors blend on its events, like shared events).
**Retiring** a finished feed (all events past) converts its events to permanent
regular events, keeping owner + shared-with members as attendees so names
persist, then removes the subscription. Reminders on subscribed events are **per
person** — each phone keeps its own minutes.

**Subscribed-calendar internals.** Retiring converts owner + shared-with members
to `EventParticipant` rows first (names persist); feed members' profile colors
are added to `memberColors` (blend); reminders are per-person via
`SubscribedReminder(eventId, userId, minutes Int[])` with
`@@unique([eventId,userId])` and an Event back-relation. The app's calendar
payload builder (`calendar-page.ts`) overrides each feed event's `reminders`
with the viewer's own.

**Tasks screen collapse (0.346).** The tasks screen (web + `/api/v1/tasks`)
shows **one line per recurring template** with a repeat label ("Every week ·
Mon"), not a row per occurrence. The **web** tasks screen has **no check-off** —
ticking happens on the home card or a person's app; the web screen is a clean
overview.

**Shared-device "Family" profile (0.339–0.341).** A shared web device shows a
**Family** profile in the sidebar (family color + family picture, both set in
Appearance) instead of the signed-in admin; signing out is gated behind the
admin PIN. Tapping Family opens a page listing each phone and the app version it
runs. The family calendar color moved from Calendar settings into **Appearance**
(0.339).

**Time format (0.344).** A 12-/24-hour setting under Calendar settings; in
24-hour mode the picker reads a typed `2315` as 11:15 PM.

**Auth cleanup (0.347).** The legacy `loginToken` was removed from the login
response now that every phone is on a current build; the login route stays (it's
the phone-unlock password check) and still returns the person, just without the
unused token. `src/lib/api/login-proof.ts` deleted. Web-only.

**Event form (0.349).** The weekly "On these days" selector defaults to and
follows the **start date's weekday** until the user manually toggles days; a
manual pick stops the auto-follow.

## 2026-09 — Retired the web `/join` page; onboarding is app-only

Onboarding moved fully into the Kairos app (enter an invitation code → set/confirm
password → enroll, all in one step). The old web `/join` redeem page is now gone:
deleted `src/app/join/*`, removed `redeemInvite` + `inviteIsRedeemable`
(`lib/accounts.ts`), `redeemInviteAction` + `RedeemState` (`lib/actions/accounts.ts`),
and `baseUrl` + `inviteLink` (`lib/url.ts`, which now only exports `appJoinLink`).
Invite/reset emails dropped the "on a computer" web link and carry only the code
plus the `kairos://join?token=…` paste fallback. All `/join` path-guards
(middleware, gate, sidebar, top-date, user-badge, content-pad) were removed too.

**Done (v0.299):** retired the `EnrollmentCode` path — removed `/api/v1/auth/enroll`,
`issueEnrollmentCode`/`redeemEnrollmentCode`/`newEnrollmentCode` and the code
constants from `device-auth.ts`, `issueEnrollmentCodeAction` + the `qr.ts` lib,
and the `EnrollmentCode` model (migration `82_drop_enrollment_code`, idempotent
`DROP TABLE IF EXISTS`). The admin **"Phone app"** panel stays — it only lists /
revokes devices; enrolling is via the invite buttons (`/auth/join`).

**Correction (v0.300).** `/api/v1/auth/login` is **not** vestigial. Tracing the
shipped app (GitHub HEAD, v0.156) settled it: `SignInScreen`/`SignInViewModel`
are gone, but `SessionRepository.unlock()` calls `svc.login()` to re-verify a
locked phone's password before unlocking (it reads `person` and reuses the kept
device token; it ignores `loginToken`). So `/auth/login` + `signLoginProof` stay.
The `loginToken` field must also stay in the response: the client's
`LoginResponse.loginToken` is a **non-nullable, non-default kotlinx field**, so
omitting it would fail deserialization and break unlock on deployed builds — it
can only be dropped in lockstep with an app release that defaults/removes it.
Only `verifyLoginProof` (used solely by the removed `/auth/enroll`) was truly
dead and was deleted. `docs/API.md` was rewritten to match: onboarding via
`/auth/join` + `/auth/join/check` + `/auth/forgot`, `/auth/login` as the unlock
password check, and the retired enrollment-code flow noted as history.

**How to verify a route is dead before removing it:** re-clone the *app* repo
fresh from GitHub (it tracks what's deployed), then trace the call graph — an
`ApiService` method or a `SessionRepository` method can linger with no reachable
caller, or (as here) turn out to have a live one in a place you didn't expect
(`unlock`). A grep for the endpoint string alone isn't enough.

## 2026-09 — App-facing API: device-authed cores, lenient responses, avatars

Building the Android client to full parity settled a few patterns worth keeping.

- **Device-authed routes call `requireDevice`, not the `"use server"` actions.**
  The actions gate on an Authelia session (`requireInteractive`/`requireCanActFor`)
  which a device token doesn't have. So each `/api/v1` route authenticates the
  bearer token and delegates to a **shared core** extracted into a lib
  (`lib/workouts/mark.ts`, `plan-edit.ts`, `rotation-edit.ts`,
  `queries/workout-log.ts`). Cores skip the session gate but still run side
  effects (`generateWorkoutTasks()` after any plan/rotation change).
- **Return shapes must be tolerant.** The Kotlin client defaults every DTO field.
  Mutation routes may return `{ status: "ok" }`; that's fine. Don't rely on the
  client to reject a partial body.
- **Avatars for the app.** `/api/avatars/*` sits behind Authelia and the app
  can't reach it, so there's a device-authed mirror `GET /api/v1/avatars/[file]`.
  `personPayload` sends `avatarUrl` pointing at that path plus `avatarPosition`
  (`"tx ty scale"`); the app reproduces the web's `translate()/scale()` transform.
- **Bible reading (v0.204).** Personal-reading writes moved into a guard-free
  core `lib/bible/personal-core.ts` (plan create/delete, day mark, book chapters,
  bulk books); the `"use server"` actions (`actions/personal-plan.ts`,
  `personal-bible.ts`) now just gate and delegate, and the `/api/v1/reading/*`
  routes call the same core after `requireDevice`. Reads use one aggregate
  (`queries/reading-page.ts` → `GET /api/v1/reading`) mirroring the Bible page.
  The family reading has **no completion endpoint** — family completion is a
  BIBLE task on the dashboard, not the Bible screen, matching the web page.
  `color` was added to `personPayload` (so `/me` and every person object carry
  the person's colour, used for their coverage bars and trophy).
- **Chores overview (v0.206).** `GET /api/v1/chores` (`queries/chores-page.ts`)
  is a read-only aggregate mirroring the web `/chores` page — no completion (that
  stays dashboard tasks) and no management (that stays the PIN-gated
  `/admin/chores`, web-only). Scope is driven by the **token's** person, not a
  session: the web uses `personalVisibleIds()` (kind only — parent sees kids); the
  app deliberately widens this to **parent OR admin** sees the household, per
  product call, so an admin who isn't parent-kind still gets the household view.
  Non-admin children see only themselves. Always-open + pool stay household-wide.
  (v0.209: the household view shows the **whole active household — every parent
  and child**, not just self + kids, so a parent sees their own and other parents'
  chores here even when none are assigned. App `/chores` endpoint only; the web
  `/chores` page keeps the shared `personalVisibleIds` scoping, reused by
  school/money/game-time.)
- **Dashboard shared chores (v0.207–0.208).** The app Home mirrors the web
  person-page "home" block: the day's **personal reading** (`personalReading`,
  toggled via `/reading/mark`), plus **up-for-grabs** and **always-open** chores
  (`upForGrabs`/`alwaysOpen` on `/dashboard`), shown to **everyone** (not gated).
  Up-for-grabs is **chores only** — the web only ever releases chore-generated
  (`locked`) tasks, so schoolwork etc. is never releasable; the API filters to
  `CHORE` to enforce it. On a single-person device "anyone can take these"
  resolves to the enrolled person, so `POST /chores/claim` and
  `POST /chores/always-open` act for the token's person (no person-picker like the
  shared tablet). Shared guard-free cores in `lib/chores/dashboard-actions-core.ts`;
  the web actions gate then delegate.
- **Calendar — phased (v0.210, Phase 1).** The calendar is large, so it ships in
  phases. Phase 1 is read-only Month/Agenda/Day: `GET /api/v1/calendar`
  (`queries/calendar-page.ts`) mirrors the web personal calendar's data exactly —
  same saved prefs (view, shown people/subs, family, school-work), same filter,
  and the same server-side `recolorForPersonal`, so a person's web colour and
  filter choices carry straight over. Colours are resolved on the server because
  the in-app colour-personalisation UI is deferred to Phase 5 (the DECISIONS
  "colour model rework" — best tuned hands-on once the base is in). Time-grid
  views (week/3-day) + swipe paging are Phase 2, add/edit is Phase 3, the options
  drawer is Phase 4.
- **Calendar timezones — viewer-local (fixed-instant).** The household model: an
  event is pinned to a timezone (default the home-server tz, and — once Phase 3
  event creation lands — selectable per event), and the calendar shows it at the
  wall-clock time it **actually occurs where the viewer is**. On a travelling phone
  a 9 AM home-tz event displays at its device-local equivalent; at home (device tz
  == home tz) nothing shifts; all-day events never shift. The server keeps sending
  home-tz times + the home tz id; the **app** converts each timed event to the
  device tz via its real instant (DST-safe, `withZoneSameInstant`), and the
  now-line runs on device time. App-side only for now; covers the common travel
  case (same calendar date, a few hours of offset). Cross-date-line, per-event tz
  overrides, and any server-side re-bucketing come with Phase 3. (This replaced an
  earlier now-line-in-household-tz approach — the opposite of the desired model.)

## 2026-09 — Edit plan on the app mirrors the web builder

Weekly plan editor (view + add via category→muscle→exercise / named workout /
rest, remove, mark-rest, copy-from-day) and Rotation (start/stop, rest-weekday
mask, 10-day preview computed server-side via `slotForDate`, slots add/remove/
reorder). Slot **edit** and **anchor date** are the remaining rotation bits.


Standing decisions for Kairos: the choices that are settled, and why, so they
aren't relitigated and so any tool or person working on the repo can see the
reasoning without reconstructing it from old conversations. ARCHITECTURE.md
covers *how the system is built*; this file covers *what was decided and why*,
especially security and product-shape calls.

**Update discipline.** This file is updated in the same commit as any change
that makes, reverses, or narrows a standing decision — the same way
`src/lib/version.ts` and ROADMAP.md are touched every release. If a release
changes a security posture, an auth boundary, a scoring rule, or the mobile
contract, it adds or edits an entry here. Entries are append-mostly: when a
decision changes, the old entry is marked superseded rather than deleted, so
the history stays legible.

Format: newest first. Each entry has a date, a short title, the decision, and
the reason.

---

## 2026-09 — No function props from Server to Client Components
A Client Component (`"use client"`) must only receive serialisable props from a
Server Component. Passing a function — e.g. an `hrefFor(iso)` builder or an
event handler — compiles and even builds cleanly, then throws at render:
"Functions cannot be passed directly to Client Components." Instead, pass the
plain data the client needs and build the value inside the client (e.g. pass the
current `view` string and construct `/calendar?view=…&date=…` there). Server
Components may still pass functions to other Server Components, which is why the
shared tablet calendar's `hrefForDay` into `MonthGrid`/`MiniMonth` is fine.

Reason: this class of bug is invisible to both the local typecheck and the
Docker build (it's a runtime serialisation error), so it only surfaces when the
page actually renders. It bit the calendar month-dropdown once; worth keeping in
mind especially as the Kotlin app adds more client/server boundaries.

## 2026-09 — Sport events are never auto-counted; they always ask
Calendar events that count as a sport workout — whether flagged on the event
type or coming from a subscribed feed marked "counts as a sport workout" — no
longer log a workout on their own. They surface a "did you do it?" prompt on the
dashboard, and only become a logged SPORT session when the person confirms (a
decline is remembered per person per occurrence). The old auto-logger
(`autoLogSportFeeds`) is removed.

Reason: auto-counting was both wrong and confusing. It credited a workout the
person may not have done, and it dated events off the raw UTC timestamp, so an
evening game slid onto the next day and could land in the wrong week. The prompt
path already dates each occurrence in the household timezone and only counts on
confirmation, so routing subscribed feeds through it fixes the day/week
attribution and the false "completed" at once. "This week" on the activity card
is the calendar week (Sunday–Saturday). Note: any SPORT sessions the old
auto-logger already wrote stay in the data until cleared by hand.

## 2026-08 — Personal calendar: per-user preferences, colour precedence, native-first gestures (planned)
Records the design agreed before building, so the plan survives across sessions.
The signed-in ("personal") calendar becomes per-person; the shared wall tablet
is untouched and keeps the household-wide settings. Built on the **web personal
view first**, then the Kotlin app renders the same model.

**Storage:** a new per-user `UserCalendarPref` (server-side, so a phone and the
web personal view always agree and a new device inherits the prefs). Holds:
default view; `othersMode`; per-kind / per-EventType / holiday / subscription
colour overrides; a `personalizeColours` master toggle; now-line override; shown
people; checked subscriptions; `showFamily` (default off); `showSchoolWork`
(default on).

**Two enums, not to be confused:** calendar events use `EventKind`
(CLASS/WORK/APPOINTMENT/BIRTHDAY/EXTERNAL/OTHER) plus admin `EventType` custom
types; tasks use `Category`. Personalisation is by event kind/type — a **new
colour axis**, since events are currently coloured by owner (person) and the
only category colouring today is for tasks.

**Others-mode** (how *other people's* items look to me): `OWN` (their profile
colour) / `GREY` (one colour, default grey, personalisable) / `FAMILY` (tablet
parity — the household scheme, for admins who want to see everyone as the
tablet does).

**Colour precedence for a personal viewer:**
1. `othersMode = FAMILY` → use the exact shared-tablet precedence
   (EventType.colour → family colour → owner colour, with bands/blend for
   shared events). Admin parity.
2. Item is someone else's **and** `othersMode = GREY` → grey / chosen colour.
3. Otherwise (mine, or `OWN`): my kind/type override if personalisation is on →
   else the system default (EventType.colour → owner colour → family). Holidays
   and subscriptions follow the same "my override else system" rule.

**Personalisable set:** Appointment, Class, Work, Birthday, each custom
EventType, holidays, subscriptions. **School work follows the Class colour** (no
separate row). `OTHER` stays system. **Vacations** stay admin-only on the family
colour scheme and are never user-recoloured. The now-line ("hour line") is
admin-set but a personal user may override it.

**Defaults on first open:** personal (family filter off), school work on,
others shown in their own colour, personalisation off (everything follows
system) until the user turns it on.

**Phasing:** A structure (model + right-side options drawer + all five views,
adding 3-day and agenda + persistent filters) → B colours (overrides +
others-mode + now-line) → C month-name mini-month dropdown + polish (clean menus,
**no explanatory text**). Web first each phase; the app follows.

**Gestures are native-first.** Swipe / one-finger scroll gets built in the
Kotlin app, not the web view — web touch handling wouldn't transfer to Compose
and would mean debugging gesture physics and colour precedence at once. Web
views navigate with prev/next; a web-swipe phase (D) is deferred and optional.
**Known issue to fix if web swipe is ever built:** the current web calendar
needs a two-finger drag to page because a single finger scrolls the grid —
single-finger should page.

## 2026-08 — Device enrollment lives on the household page; QR holds the raw code (v0.179)
**Decision:** the parent-facing enrollment surface is a per-person "Phone app"
panel in the household list (`/setup`), beside the web-login controls — not a
separate admin screen. It generates a one-time code (shown once as a short code
**and** a QR) and lists/revokes that person's devices. The **QR encodes the raw
enrollment code string itself** (not a URL or deep link), so the eventual app
scanner reads the code and posts it to `/api/v1/auth/enroll` exactly as if it
were typed. **Reason:** enrollment is per-person access management, so it belongs
next to the other per-person access controls; keeping the QR payload equal to
the typed code means scan and manual entry hit one code path, and defers any
deep-link scheme until the app actually needs one. The QR is rendered from the
dependency-free `qrcode-generator` on the server (`src/lib/qr.ts`), so it stays
out of the client bundle and the lean dependency set barely grows.

## 2026-08 — Invite links: single-use, validated at page load (v0.178)
**Decision:** an invite link is authority to set a person's *initial* password,
and nothing more. The guarantees, now made explicit and enforced end to end:
- **Unguessable / not replicable:** the token is 256 bits of randomness; only
  its SHA-256 is stored, never the raw value.
- **Single-use:** redeeming sets the password and deletes the invite in one
  transaction, and bumps `credentialVersion` so any prior sessions are voided.
  Issuing or re-issuing an invite deletes any existing one for that person.
- **Expiring:** 7-day TTL, checked on redemption.
- **Validated before the form is shown:** the redeem page (`/join`) now checks
  the token is live *on load* (`inviteIsRedeemable`) and shows an "already used
  or expired" message instead of the password form for a dead token. Previously
  the form rendered for any URL carrying a token, so a used link appeared
  reusable even though the backend correctly refused it — a fix to a
  perceived vulnerability, not a change to the (already sound) redemption path.
**Reason:** possession of the one-time link = authority to choose the first
password is the standard invite model and is fine for the household threat
model; the gap was purely that the UI re-showed the form. Validating at load
closes it without adding a heavier lock.

## 2026-08 — Sending an invite saves and uses the typed email (v0.178)
**Decision:** on the household page, "Send invite" persists the address in the
row and attempts to email the invite in one step; if it can't email (no address
on file, or SMTP not configured/failed) it reports why rather than silently
showing only a link. **Reason:** the email field had a separate Save button and
the action read the *saved* address, so a typed-but-unsaved email was ignored
and the fallback to a link was silent — it looked like sending was broken.

## 2026-08 — Native Kotlin for Android, not Capacitor
**Decision:** the Android client will be native Kotlin/Jetpack Compose, not a
Capacitor wrapper around the web UI.
**Reason:** with development driven by prompts rather than hand-coding, the
limiting cost is maintenance surface and rebuild risk, not typing. The web UI
is near feature-stable and the mobile surface is bounded, so building the native
UI once beats building a Capacitor UI now and a native one later. Native also
gives a cleaner path to notifications, background work, and widgets. The web
React app is unchanged; Android becomes a new client on a shared API.

## 2026-08 — A versioned REST API is the mobile boundary
**Decision:** the mobile client talks to `/api/v1` (see docs/API.md), not to
Server Actions. The web app keeps using Server Actions. Business logic stays on
the server, called by both doors.
**Reason:** decouples the client from Next.js internals, makes the contract
explicit, and is valuable even if the app is never built. Additive-only within
a major version.

## 2026-08 — Mobile identity: per-person device tokens (confirmed, built v0.177)
**Decision (confirmed):** enrollment binds a device to a Person; the device
token *is* the identity; there is no password login on the phone. A parent
generates a one-time enrollment code in the admin area (rendered as a short code
and a QR); redeeming it on the phone mints the token. This is the gating mobile
decision from docs/API.md, now settled as option 1.
**Shape as built:**
- A `Device` row per enrolled phone; only `sha256(secret)` is stored, never the
  raw token — same as an Invite. `Device.expiresAt` (365 d) refuses stale
  tokens; `refresh` rotates the secret; `revoke` soft-revokes the row.
- An `EnrollmentCode` row per pending enrollment: one-time, 15-minute TTL, hash
  only, deleted on redemption (or expiry). One live code per person.
- Surface: `POST /api/v1/auth/enroll` (no auth — the one internet-facing,
  rate-limited, code-gated endpoint), `POST /auth/refresh`, `POST /auth/revoke`,
  `GET /me`, `GET /meta`. All but enroll require `Authorization: Bearer`.
**Reason:** preserves the household model (no per-person passwords), keeps the
web app identity-free, and still lets a phone open to just that person. The
parent-facing "generate a code / see this person's phones" admin screen is the
next increment; the contract and token backend land first.
**Supersedes** the 2026-08 "per-person device tokens (proposed)" entry.

## 2026-08 — Authelia `/api/v1` bypass is unblocked (token surface now exists)
**Decision:** the token-based app authentication surface is built (v0.177), so
the precondition for an Authelia bypass is met. When the bypass is added it is
scoped to **`/api/v1` only**, never all of `/api`. Kairos still authenticates
every `/api/v1` request itself: a bearer token on all endpoints except
`/api/v1/auth/enroll`, which is intentionally public and guarded instead by a
one-time, short-lived, rate-limited enrollment code.
**Boundary that makes this safe:** `/api/v1` is exempt from the app's own
login-gate middleware and does its own per-request auth in the route handlers
(src/lib/api/device-auth.ts). The exemption is scoped by prefix, so no other
`/api` route is opened by it.
**Infra note:** enabling the bypass is a change to the Authelia config on the
server, not in this repo. This entry records that it is now permitted and how it
must be scoped.
**Supersedes** the 2026-08 "Authelia `/api` bypass stays off until app-auth
exists" entry — the condition it waited on is now satisfied.

## 2026-08 — Public exposure requires env enforcement, not the in-app toggle
**Decision:** for a public deployment, `REQUIRE_LOGIN=true` and `SESSION_SECRET`
must be set as container env vars. The in-app "Require sign-in" DB toggle alone
does not secure a public site.
**Reason:** middleware runs at the edge and cannot read the database, so
soft-navigation can bypass a DB-only flag. Env enforcement is checked on every
request. The Device settings page shows the green "Edge enforcement is on"
banner only when both env vars are present. (v0.172–0.176.)

## 2026-08 — Admin unlock is enforced at the edge, 4-hour TTL
**Decision:** the signed admin-unlock cookie is verified in middleware on every
`/admin` navigation; TTL is 4 hours.
**Reason:** a lapsed unlock must stop reads immediately, not linger until the
next hard reload. A true inactivity auto-lock is still open (ROADMAP). (v0.176.)

## 2026-08 — Admin PIN is internal convenience; Authelia is the front door
**Decision:** the 4-digit admin PIN is a low-friction internal lock, not the
public security boundary. Authelia in front of the whole domain is the real
front door.
**Reason:** the PIN stops a kid at the shared tablet; it is not meant to resist
a determined remote attacker, which is Authelia's job.

## 2026-08 — Config lives in the container template, not a file
**Decision:** real runtime config lives in Unraid container-template env vars.
No `.env` on the server; `.env.example` is documentation only.
**Reason:** single source of truth for deployment; avoids a stray file drifting
from the actual running config.

## 2026-09 — Android app: technical shape (scaffold, app v0.1.0)
**Decision:** the `kairos-app` client is built as: Jetpack Compose (Material 3,
single-activity) · Navigation-Compose with type-safe routes · Retrofit + OkHttp
with kotlinx.serialization (unknown fields ignored, per docs/API.md) · DataStore
for settings · the device token encrypted with an AES-256-GCM key in the Android
Keystore · **manual DI** (a small AppContainer), not Hilt. Toolchain is pinned in
a Gradle version catalog (AGP 8.13 line, Kotlin 2.2, compileSdk/targetSdk 36,
minSdk 26, JDK 17) — AGP 9 is deliberately deferred. Auth state is a single
`SessionState` flow that gates the whole UI (Setup → Enroll → Home); there is no
"navigate to login", so the soft-navigation bypass class can't occur.
**No deployment specifics in the repo:** the server base URL is user-entered at
first launch and editable any time; no host, handle, or LAN address is baked into
the source. The repo ships pointing at nothing.
**Reason:** keeps the maintenance surface and rebuild risk low (codegen-free
except serialization; lean dependency set), matches the identity model already
built server-side, and keeps a public repo free of any household's details.
Room/WorkManager/FCM and QR scanning are deferred to later increments.
**Avatars caveat:** uploaded avatar photos (`/api/avatars/*`) stay behind the
reverse-proxy auth and are not fetched by the app yet; the emoji `avatarIcon` or
initials cover identity display until a token-authed avatar path exists.

## 2026-09 — Mobile app auth: login + code (layered), code-only for kids
**Decision:** the phone app authenticates on the account credential, not on the
enrollment code alone. A person **with a password** enrolls with **login + code**:
`POST /auth/login` verifies username/email + password and returns a short-lived,
HMAC-signed **login proof** (carrying the user id and `credentialVersion`); the
app hands that back to `/auth/enroll` alongside a device code, and the server
mints a device token only when both are valid **for the same person**. A person
**without a password (a child)** enrolls by **code alone**, generated by a parent
in the admin panel — the parent's authenticated session is the auth, the code
binds the device to the chosen child.
**Reason:** device enrollment is one layer, not the whole identity. On a public
deployment the account password must be the gate (Authelia can't be assumed for
others running Kairos). Requiring both factors means a leaked password can't
enrol a new device and a leaked code can't impersonate a password-holder. The
no-password path stays only for passwordless kiosk/shared mode and local testing.
**Increment B (done, v0.188):** a `credentialVersion` column on `Device` records
the password version it authenticated at. When a password account's version
bumps (password change/disable), every request returns `reauth_required`; the
phone stays enrolled and clears it via `/auth/reauth` (password only). Explicit
revoke still cuts a device off entirely. Passwordless children are never gated.

## 2026-09 — Scoped `/api/v1` Authelia bypass: rule specified
**Decision:** the public-domain bypass is a single Authelia `access_control`
rule scoped to `resources: ^/api/v1(/.*)?$` with `policy: bypass`, ordered
**above** the host's catch-all. Everything else (including `/api/avatars` and
`/admin`) keeps its existing policy. `REQUIRE_LOGIN` + `SESSION_SECRET` stay set.
**Reason:** `/api/v1` self-authenticates every request (bearer on all routes
except the public, rate-limited `/auth/enroll`), so it never relies on Authelia —
exactly the condition that makes a *scoped* bypass safe. Broadening to `^/api/`
would expose the avatar route and any future `/api` route, so the scope is
strict. During build-out the app can instead point at a LAN base URL, avoiding
the proxy entirely.

---

## Product-shape decisions (from ARCHITECTURE.md, restated for the log)

- **No per-person sign-in on the web dashboard.** It is a shared household
  screen; the only lock is the admin PIN. (The mobile app is the first place
  per-person identity enters — see above.)
- **Derive at read time, never store computed values.** Scores, streaks, and
  expiry are computed from source rows, not persisted, to avoid backfills and
  keep logic centralized.
- **Levels never drop; no punishments; money rewards are cosmetic.**
- **Vacation pauses leave the scoring denominator** (not counted as misses);
  **rotation rest days pause the cycle** rather than consuming a slot.
- **School work stays out of scoring** until the scoring rework epic ships.
- **Idempotent migrations always** (`ADD COLUMN IF NOT EXISTS`, guarded
  `CREATE TYPE`, guarded FK creation).

---

## Approving Bible rewards from the phone (mobile admin, no PIN) — v0.248

The web's reward-payout approval lives in Admin → Money behind the PIN
(`approveBibleBase` / `approveBibleMonthAll` over `pendingBibleRewards()`). The
mobile app can't sit behind that PIN — the device token already establishes who
the person is — so a **parent admin (`person.role === "ADMIN"`) can approve from
the app** with no PIN. The two approval actions were split into session-free
cores in `lib/bible-rewards.ts` (`approveBibleBaseCore`,
`approveBibleMonthAllCore`, plus the moved `postReward`); the web actions and the
new device routes both delegate, so eligibility is re-checked server-side in one
place and a stale client can't force a payout. Same pattern as the add-entry core
(`lib/money-core.ts`), shared by the web action and `POST /money/entry`.

What stays web-admin-only (behind the PIN), by choice: approving/unapproving a
*filed* transaction, editing/deleting a row, setting starting funds, and CSV
import. The app mirrors the read-only `/money` page plus reward approval; those
management actions weren't requested for the phone.

---

## Money admin parity on the phone, minus import (v0.249)

The app now does everything the web Money admin (`/admin/money`, PIN-gated) does
except the one-time CSV import: approve / unapprove / approve-all, edit, delete,
and set starting funds — plus the Bible-reward payout approvals from v0.248. All
of it is admin-device-only: the route checks `person.role === "ADMIN"`, which
replaces the PIN because the device token already proves the parent. **The shared
web wall tablet keeps the PIN** — it's identity-free, so approval there still goes
through `/admin/money`; the app never exposes these on a non-admin device.

Every mutation is a session-free core in `lib/money-core.ts`
(`approveMoneyEntryCore`, `unapproveMoneyEntryCore`, `approveAllMoneyCore`,
`updateMoneyEntryCore`, `deleteMoneyEntryCore`, `setStartingFundsCore`) shared by
the web action and the device route, so validation/eligibility live in one place.
The home dashboard read carries admin-only `money: { pendingApprovals, rewardMonths }`
counts that drive the amber reminder banner (mirrors the web `MoneyReminder`);
Review opens Money rather than approving inline.

Still web-admin only, by choice: **CSV import** (a one-time setup task) and the
**Bible reward-settings config** (per-person opt-in/amounts, bonus, grace — a
set-once form). Both are named in ROADMAP; ask to bring either to the phone.

## Reading — leisure book-tracker (v0.250)
Strictly **self-only**, unlike Money: `personalUserId()` narrows the web page to
the signed-in person and every `/api/v1/books` route acts only on the enrolled
person's own books (mutations 403 otherwise). Parents do **not** see a child's
leisure reading here — deliberate.

A book keeps its size in **pages and/or chapters** (at least one; both allowed).
Progress runs on the single `unit`/`length` pair (pages win when both are set),
so leisure reading keeps feeding the Scholar stat unchanged.

Reading tracks a **current position** (`Book.position`, the page/chapter you're
up to). How far you've read (`read = min(position, length)`) and the Scholar XP
**derive from it at read time** — there is no per-day amount log anymore. Because
scoring is a function of the single current value (never a running sum), setting
the page back and forth can't bank extra credit: each page counts once. Marking
finished sets `position = length` (100%) and un-shelves. The old per-day `BookLog`
rows are unused now (migration 76 backfilled `position` from their sum); the table
is left in place (non-destructive).

**Bookmark was removed** (v0.250.2) as functionally redundant with Shelve — both
just moved a book to the shelf and both kept progress, so it was a second label
for one capability. The shelf is now **To read** (shelved) and **Read** (finished);
a shelved book shows where you left off and resumes there. The `bookmarked` column
is left in the DB unused rather than dropped. Operations live in session-free
`books-core.ts`, shared by the web actions (Authelia session) and the device
routes (bearer token) — same core/auth-at-the-caller split as Money.

## Groceries — device API (v0.251)
Groceries was built web-first long ago (shared list, stores, catalog, per-store
trips). To reach it from the app, the seven shopping operations moved out of the
`"use server"` actions into a session-free `groceries-core.ts`; the web actions
and the new device routes both delegate to it, so **web and app run the exact
same rules** (no drift). The shopping list is **shared family data** — the device
routes are device-authed but not self-only; any enrolled device may read and
write it, matching the web's "anyone can say we're out of milk". Store membership
follows the catalog (`GroceryItem.defaultStoreId`): a typed name that matches a
catalog entry defaults to that store; a new item's store is remembered on first
add. `trip/start` defaults the shopper to the enrolled person (it's their phone).
Store/catalog editing (admin) stays web-only — deferred, like Money's CSV import.

## workout-log.ts: explicit types for logged-set lookups (0.258.0)
The three non-noise type errors in src/lib/queries/workout-log.ts came from
Prisma-projected rows degrading to `{}` when the generated client isn't resolved
(sandbox). Fixed by typing the two lookup Maps explicitly (a shared `LoggedSet`
type; the first Map uses `Pick<LoggedSet,"weight"|"reps">`) and casting the
projected rows, which the selects back at runtime. valueForMetric now takes
`LoggedSet`. Remaining workout-log.ts noise is only the `@/generated/prisma`
type import + implicit-any params — the accepted baseline.

## Admin Tasks page + School assignment editing (0.275.0)
Admin > Tasks (/admin/tasks): server page loads all Category.OTHER tasks for active
users; TasksAdmin client has one pencil (top-left) toggling a whole-list edit mode.
In edit mode each row gets inline edit (title, due date, reassign person) + delete.
New action editTask({id,title,dueDate,userId?}) in actions/tasks.ts (reassign needs
requireCanActFor on the new owner too); deleteTask now also revalidates /admin/tasks.
Admin > School: assignments/tests are now editable, not just deletable. New action
editSchoolWork({id,title,type,subject,classId,dueDate}) updates the Task + its
SchoolWork detail; classId validated against ClassMember like add. school-admin ItemRow
gained a pencil -> inline EditForm (title, type, class-or-subject, due). Added classId
to SchoolItem query/type so the edit form pre-fills the class. No migration (selects an
existing column; edits existing rows). Next: app Settings menu.

## Web: Appearance / themes (0.276.0) - Phase 2b (household, admin-set)
Tailwind v4 @theme tokens are var()-backed, so themes = CSS overrides of the colour
variables. globals.css: added --color-on-accent (white default); html[data-theme="X"]
overrides --color-accent + --color-sidebar (light); html.dark flips neutrals (ground/
surface/ink/muted/hairline/shade) + brightens accent + darkens on-accent; html.dark
[data-theme="X"] per-scheme dark accent/sidebar/on-accent. Same 8 schemes + exact hexes
as the app for parity. Web is token-based (2175 semantic classes vs ~153 raw), so dark
mode is comprehensive; the one fix was accent buttons: migrated `text-white` ->
`text-on-accent` on every line that also had `bg-accent` (114 occ / 76 files, verified no
false positives against bg-black/ink). settings.ts: APPEARANCE_THEME/APPEARANCE_DARK +
getAppearance(); layout applies data-theme + .dark to <html> (force-dynamic already).
actions/settings.ts: setAppearanceTheme/setAppearanceDark (requireAdmin, revalidate layout).
New /admin/appearance page + tile (PaletteIcon). No migration (appSetting rows). Theme is
household-wide by decision; app theme stays per-device. Next epic items: profile (device
endpoints) + notifications.

## Web 0.276.1: server-only fix for the appearance client
0.276.0 failed the Docker build: appearance-admin.tsx (a "use client" component)
imported THEME_NAMES/THEME_LABEL as VALUES from settings.ts, which starts with
`import "server-only"` -> webpack error. (Pre-existing client imports of settings.ts
are `import type` only, which are erased, so they were fine.) Fix: moved the client-safe
constants to a new src/lib/themes.ts (THEME_NAMES, ThemeName, THEME_LABEL, THEME_SWATCH);
settings.ts + actions/settings.ts + appearance-admin.tsx import from there. Reconfirms the
standing rule: never import a server-only module's VALUES into a client component. This is
the class of bug only the Docker build catches.

## Web 0.276.2 + app 0.116.0: profile colour (ring) + toggle fix
Toggle: the dark-mode switch used absolute+translate with no explicit left, so the knob
drifted right / off-frame. Rebuilt with the reliable inline-flex + items-center pattern
(knob translate-x-0.5 off / translate-x-[22px] on, bg-white). Profile colour: new device
endpoint POST /api/v1/me/color sets the enrolled person's user.color (hex, validated) and
revalidates web paths - same field the web profile edits, so it flows to calendar + ring +
everywhere. App: ProfileScreen (settings) with the 8 PERSON_PALETTE swatches + a live ring
preview; setMyColor + refreshPerson (guarded to online so an offline save doesn't revert the
ring from cached me()). Profile is now navigable in Settings. Photo + framing (avatar upload +
pan/zoom cropper producing "tx ty scale") is the next profile phase - bigger Android build.

## Web 0.276.3 + app 0.117.0: finish profile (photo + framing, custom colour)
Web: new POST /api/v1/me/avatar (multipart: optional image + "position"). Replicates
profile.ts file-save (UPLOADS dir, 5MB cap, magic-byte check, random filename, unlink old);
image optional so it also re-frames the current photo (position only). App: ProfileScreen
finished - avatar preview now applies avatarPosition (parseXf + graphicsLayer, matches the
rest of the app so it's WYSIWYG); "Change photo" (PickVisualMedia) + "Adjust framing" open a
circular AvatarCropDialog (detectTransformGestures -> tx/ty % + scale, same transform math);
reads bytes off-main-thread and uploads via setAvatar (multipart). Custom colour: HSV
ColorPickerDialog (hue bar + SV square), last custom colour persisted per-device
(SettingsStore.lastCustomColor) and shown as an extra swatch. Text: "User color" +
"Avatar color shared across the platform" (US spelling by decision). PROFILE COMPLETE.
Remaining epic item: notifications.

## Web 0.276.4 + app 0.118.0: notifications - Phase 1 (settings + plumbing)
Notifications is the last epic item and the biggest, so phased. Phase 1 (this): the
config surface + Android plumbing, verifiable via a test notification; Phase 2 (next):
the scheduling engine that actually fires at event times. Web: GET /api/v1/notifications/
meta returns the household event types for the per-type toggles. App: NotifPrefs (per-device,
JSON in DataStore, all OFF by default) - master enabled, scope (MINE/ALL/FAMILY), per-type
{enabled,lead}, birthday {enabled,lead 1day}. Lead options: at start/15m/1h/1d. Notifications
helper: one "calendar_reminders" channel (IMPORTANCE_HIGH, created at MainActivity start),
POST_NOTIFICATIONS permission (manifest + runtime request when the master toggle is turned on),
post() no-ops without permission. ic_notification vector added. NotificationsScreen wired into
Settings. PHASE 2 TODO: web GET /api/v1/notifications/upcoming (events next ~48h + birthdays,
absolute start, type, mine/family flags); app scheduler (WorkManager periodic + AlarmManager
exact alarms + AlarmReceiver + BootReceiver) reading NotifPrefs -> posts event-name reminders.

## Web 0.277.0: per-event reminders foundation (schema + calendar API)
Migration 77_event_reminders (additive, idempotent): Event.reminders Int[] default {},
EventType.defaultReminder Int?. create-event.ts: EventInput.reminders, normalizeReminders
(non-neg whole minutes, <=40320, dedupe, sort, cap 5); create stores it; update stores it
only when the client sends it (undefined = leave unchanged). Device calendar event
create+update routes parse reminders[]. calendar.ts: GridEvent.reminders? (optional -
base/real events set it from the included row, synthetic birthday/task events omit it),
loadEventTypes + the events include now select defaultReminder. calendar-page.ts: CalEvent.
reminders + toWire + options.eventTypes.defaultReminder. App DTOs: CalEventDto.reminders,
CalEventTypeDto.defaultReminder, Create/UpdateEventRequest.reminders (Delete does NOT).
NEXT (sub-phase 2): app CalendarAddEvent reminder section (Proton-style: Add notification ->
picker, bell+label+X, multiple; new events pre-fill eventType.defaultReminder). Then web
event form + the firing engine.

## Web 0.278.0 + app 0.123.0: notification firing engine
Web: GET /api/v1/notifications/upcoming - events in the next 30 days with non-empty
reminders, scoped to the person (owned/family/participant, non-external, non-cancelled).
Non-recurring included directly; recurring expanded via occurrencesIn() (household tz),
skipping dates a cancelled single-occurrence override removes. Returns {id,title,startMs
(epoch),reminders}; recurring occurrence ids are "parentId:ms".
App engine: NotificationScheduler.refresh() fetches upcoming, computes each reminder's
fire time (startMs - min), schedules exact alarms (AlarmManager.setExactAndAllowWhileIdle,
RTC_WAKEUP; canScheduleExactAlarms guard on 31+, falls back to inexact) via a PendingIntent
to AlarmReceiver (carries title + notifId=code, code = hash("eventId|min")); cancels codes
no longer desired; tracks codes in SettingsStore. Gated by master toggle + POST_NOTIFICATIONS
(clears all if off). AlarmReceiver posts the event name. BootReceiver re-schedules on boot/
package-replace. NotificationWorker (WorkManager, work-runtime-ktx 2.9.1): periodic 2h KEEP
safety net + enqueueOnce. Triggers: MainActivity enqueues periodic+once; AppRoot enqueues
once on every dataRevision (so a calendar edit reschedules). Manifest: USE_EXACT_ALARM (33+)
+ SCHEDULE_EXACT_ALARM (<=32) + RECEIVE_BOOT_COMPLETED + the two receivers. NOTE: offline-
created reminders schedule only after sync (endpoint is server-side). NOTIFICATIONS COMPLETE.

## Web 0.279.0 + app 0.125.0: American spelling + app calendar/settings fixes
Replaced colour->color / Colour->Color across both repos (prose, comments, user-facing
strings; identifiers already used "color"). App-only fixes: (1) Settings Notifications blurb
-> "Reminders, sounds, and vibration settings"; (2) military clock now HH:00 (e.g. 13:00) not
HH; (3) CalendarViewModel.setTab resets date to today + clearPageCaches + navNonce bump, so
switching views always returns to the current day; (4) event editor "Share with" excludes the
owner (editEvent.ownerId, else the current person from session state) and uses KairosIcons.Share
(the workout-share icon) instead of the checklist icon.

## 2026-09 — Security hardening batch (v0.280.0)
From a source review (ChatGPT), verified against the tree before applying:
- **Calendar SSRF.** `syncCalendar` fetched an attacker-influenced subscription
  URL with no address checks and read the whole body unbounded. Fetching now goes
  through `lib/calendar/safe-fetch.ts`: scheme restricted to http(s), the host
  resolved and rejected if any address is loopback/private/link-local/CGNAT/
  reserved, redirects followed manually with each hop re-validated (max 5), and
  the body capped at 5 MB. Residual DNS-rebinding risk is documented in that file
  (only enrolled members can add feeds, so it's a proportionate defence).
- **Auth throttling no longer trusts a spoofable IP alone.** `clientIp` now prefers
  Cloudflare's `cf-connecting-ip` (overwritten by CF, not client-settable), with a
  `REAL_IP_HEADER` override, then XFF as a last resort — and, more importantly,
  every auth endpoint has a *secondary* limit that doesn't depend on IP: login per
  identifier, enroll per code, reauth per device. So rotating source IPs can't
  brute-force one account/code/device past the ceiling.
- **Rate-limit map is bounded** (`MAX_BUCKETS`, expired entries pruned) so varied
  keys can't grow it without bound.
- **API auth is structurally enforced.** `withDeviceAuth(handler)` is the sanctioned
  wrapper for new routes, and `scripts/check-api-auth.mjs` runs in `npm run build`
  (the Docker gate): it fails the build if any `/api/v1` route neither references a
  device guard nor is in the tiny public allowlist (meta, auth/login, auth/enroll).
  Existing routes were left as-is (all already guard); the check prevents a future
  route shipping open.
- **`lastSeenAt` throttled.** `touchDevice` now does a conditional update that writes
  only when the stamp is older than 15 min, so a chatty client doesn't amplify into
  a device write per request.
Not changed: the in-memory limiter stays process-local (single container, fine
behind Cloudflare/Traefik) — bounded now, but not moved to a shared store. The
Nodemailer bump and the false-positive enrollment-code "modulo bias" were left out
deliberately (see the review notes).

## 2026-09 — Nodemailer 7 → 9.1.1 (v0.280.1)
The source review flagged Nodemailer 7.x as carrying advisories; verified against current
sources: 7.x is affected by several (raw-option File Read/SSRF fixed 9.0.1; the *critical*
envelope.size SMTP CRLF injection fixed 8.0.4; jsonTransport/`list` issues fixed 8.0.9).
**Kairos was not exploitable through any of them** — `lib/mail/send.ts` passes only
host/port/auth/tls to `createTransport` and from/to/subject/text/html to `sendMail`: no
custom `envelope`, `raw`, `list`, `jsonTransport`, attachments, or attacker-controlled
addresses, and the only interpolated values (name/link/deviceName) are HTML-escaped.
Bumped to **^9.1.1** (top of the 9.x line — fixes all of the above) rather than 10.x, whose
only breaking change is a Node-20 floor (we run Node 22) with no functional gain and a
TypeScript-migration that could disturb the `@types/nodemailer` setup. 9.1.1 is a plain
drop-in: no code change, `@types/nodemailer ^8.0.1` kept, and nodemailer has zero runtime
deps so the lockfile delta is a single entry. `npm ci` stays valid.

## 2026-09 — Calendar UX, DateField, and workout integrity (v0.318–0.333)

**One `DateField` calendar, no native pickers.** Every `<input type="date">` across
the app was replaced with a single `src/components/date-field.tsx` — a styled popup
calendar (month nav, Today/Clear) so the picker matches the app instead of the
browser's chrome, which isn't CSS-styleable. Drop-in: `name`+`defaultValue` for
uncontrolled form fields, `value`+`onChange` for controlled, plus `min`/`max`/
`disabled`/`wrapperClassName`. All date math is on `YYYY-MM-DD` strings and local
`(y,m,d)` ints — never `new Date(iso)` — to avoid the UTC off-by-one. Outside-click
close uses a **capture-phase `pointerdown`** listener so a click on any element
(even one that stops bubbling) closes it, on touch and mouse.

**One global caret for every `<select>`.** The `.select-caret` rule was broadened to
`select, .select-caret` (unlayered, so it wins over Tailwind utilities) — every
dropdown app-wide gets the same inset chevron with no per-file class; the class is
kept for non-select triggers (the color-picker button).

**Subscribed-event reminders + address.** Migration 88 adds `Event.locationOverride`;
sync never writes it, so a manual address survives feed refreshes, and display/nav
resolve `locationOverride ?? location`. Reminders on external events already survived
refresh (sync doesn't touch `reminders`), so the `/notifications/upcoming` route was
opened to external-with-reminders. The **web** editor for these was then removed:
reminders on subscribed feeds are app-only by design, and the address editor was
dropped (most feeds already carry addresses). The backend (`saveSubscribedExtras`,
migration 88, pipeline) stays for the app to consume later.

**Workout session integrity.** A day can hold several sessions (custom logs each make
their own), but `findOrCreateSession` returned the day's *oldest* session and
`setRestDay`/`logPlannedWorkout`/`logWorkoutSession` mutated it in place — so resting
a day, marking it done, or logging a scheduled/planned workout could overwrite or hide
a real custom log (the oldest). Fixes: `findOrCreateSession` reuses only a day's
bare/scheduled session (null name/category/source); `setRestDay` converts only an
empty placeholder, else adds a separate rest marker; `logPlannedWorkout` reuses its
own plan-named session; `setWorkedOut(false)`'s delete is placeholder-only.

**Duplicate-workout prompt.** Logging a movement/plan already logged that day reports a
conflict (`{name, summary}`) instead of silently duplicating or overwriting; the client
shows "Update or Cancel." Date-scoped (works for backfilled past days). On the app the
log endpoints gate this behind a `detectConflict` flag for back-compat with old clients.

**Birthday type switch.** Selecting Birthday forces all-day + yearly; switching to a
non-birthday type now undoes them (web `chooseKind`, app kind selector) so an event
doesn't stay locked as all-day/annual.

## Game-time monitoring (Sep 2026)

The allowance/token model was retired; Game time is now automatic monitoring fed
by a standalone collector container. Source-side design lives in the collector
repo's DECISIONS.md — this covers the Kairos side.

- **Ingest is a service-token route.** `POST /api/v1/game-time/ingest` is authed
  by `GAMETIME_INGEST_TOKEN` (Bearer or `X-Ingest-Token`), not device auth — the
  only external-ingest auth in the app. It's allowlisted in
  `scripts/check-api-auth.mjs` (the build gate that requires every `/api/v1`
  route to be device-authed or explicitly public).
- **Idempotent + authoritative per day.** `GameDay` is upsert-**replace** (not
  increment) on `(userId, date)`, so the collector re-sending "today so far"
  every 5 min never accumulates. The day's `GameDayTitle` breakdown is
  delete-then-insert, so a corrected push clears stale games. (A collector bug
  that inflated a kid to ~6h was purely the collector including a bogus
  in-memory session — Kairos was replacing correctly.)
- **Data model:** `GameDay` (per person/day total), `GameDayTitle` (per
  person/day/game), `PlayerCard` (current gamerscore / gamerpic / hasGamePass /
  msBalance / platforms). Identity resolved by gamertag → steamId → name.
- **Device route for the app.** `GET /api/v1/game-time` returns the same rows as
  the web page, scoped by the enrolled person: a PARENT sees the household, a
  child sees only themselves. The app decides list-vs-detail from the count.
- **Weekly chart data is already stored** (`GameDay` per date), so the Sun–Sat
  bar chart needs no new backend — the query widens its fetch to cover the week
  even at a month boundary.
- **Per-system icon** comes from `PlayerCard.platforms` (comma-joined), set by
  the collector; the web/app just render Xbox/Steam logos.

## Sept 23–24 2026 run (web v0.458–0.483)

- **Reading goals.** New `ReadingGoal` model on `Book` (migration 107); each goal
  stores `startPage` (migration 108) so progress is measured across the goal's own
  segment `[startPage, target]`, not from page 1. `startPage` = the previous goal's
  target, or the reader's position when the first goal was set (captured in
  `syncBookGoals`, kept stable across edits). `loadReadingProgress` picks the active
  goal (earliest whose due date is today-or-later, else the last) and returns a pct
  that goes negative when you've fallen behind. Surfaced in a "Book reading" section
  on the person page and in the dashboard payload for the app home. Endpoints:
  `/api/v1/books/goals`, goals folded into add/update; `/api/v1/settings/reading-reminder`.
- **Workout overdue.** Root cause of vanishing scheduled lifts: `confirmSportCore`
  marked the day's binary EXERCISE task COMPLETE, so `loadOverdueWorkoutDays` (which
  only looked at PENDING) dropped it. Fixed by including COMPLETE tasks and filtering
  on whether the scheduled workout's exercises were actually logged. Generator now
  backfills `WORKOUT_OVERDUE_MAX` days internally. Dashboard exposes `workoutOverdue`.
- **Companions.** Growth is clean-days-since-acquired (`stageFromGrowth`); egg rarity
  is streak-driven (`luckFromStreak`) with a pity timer. **Egg cap raised 2→3 per
  month**; added `eggCapped` to the companion payload so a full-but-capped egg shows
  "hatch next month" instead of a dead full bar.
- **School catch-up note — ROOT CAUSE FOUND + FIXED (app).** The app has TWO
  school progress renderers: `SchoolScreen.ProgressRow` (has the "Do N a day…" note)
  and `HomeScreen.SchoolProgressRow` (the home school-detail view — the one users
  actually see). A refactor moved the detail to the home screen and never carried the
  note across, so behind subjects showed the orange finish date with no note. Fixed by
  adding the note to `HomeScreen.SchoolProgressRow` (app v0.288). The pace math and the
  web were always correct; the earlier "past spring term" theory was fabricated and
  reverted (first school year — impossible). Lesson: when a UI element "disappears,"
  find WHICH renderer draws the screen in the screenshot before touching the data path.
- **Subject colours are consistent per subject (web v0.484).** Class colours were manual
  (null by default → grey card dots) while the admin overlay assigned palette colours
  per student, by order — so a student missing a subject shifted everyone's colour.
  New `loadSubjectColors()` keys `CLASS_PALETTE` to the GLOBAL subject order
  (sortOrder, createdAt, name), so a subject is one fixed colour everywhere. Used by
  both `loadSchoolProgress` (card dots) and `loadStudentBars` (admin overlay); a manual
  class colour still wins.
- **School catch-up note — (was) OPEN.** The "Do N a day…" pace note
  stopped showing for behind subjects. A first theory (a past-year spring term skewing
  `targetISO`) was wrong and reverted — this is year one, so there is no past spring
  term. Verified the pace math is internally consistent: for a far-off target, any
  subject projected past `targetISO` (orange) also gets a non-null `catchUp`, so the
  computation is not the break. Remaining suspects: delivery (running server/app not
  carrying `catchUpRate`) or the subjects computing as on-track. Needs the live
  per-subject values (onTrack / finishISO / catchUp) to localize before any fix.
- **Monthly framing.** "Season" → "This month" across UI; scoring-start and
  days-to-finish controls moved to the admin "Scoring & rewards" page (off kid-reachable
  pages).

## Sept 24 2026 — base-subject colours (web v0.486)

- School colours key to a BASE SUBJECT, not the granular subject. Subject gained a
  nullable `baseSubject` (migration 109), and `loadSubjectColors` groups subjects by
  `baseSubject ?? name`, assigning one palette colour per group in first-appearance
  order. So Geometry + Pre-Algebra (both Math) share a colour everywhere: card dots,
  app home card, progress page, admin year-calendar overlay. Initial mapping baked into
  the migration (Math, Science, Foreign Language, History, Writing). Grammar/Writing/
  Handwriting currently share the Writing colour; per-subject override + an admin editor
  to set base subjects are the next step (owner: "use my mapping now, admin later").

## Sept 24 2026 — subject-colour admin editor (web v0.487)

- Added a per-subject colour OVERRIDE (Subject.color, migration 110) that wins over
  the base-subject group colour, and a "Subject colours" admin panel
  (school-structure.tsx) to set each subject's baseSubject + colour. Server action
  setSubjectMeta. loadSubjectColors resolves override ?? group colour, so all four
  surfaces update. This is the self-serve replacement for the baked-in migration-109
  mapping; that mapping stays as the seed.

## Sept 24 2026 — base subjects are first-class (web v0.491)

- Base subjects became a real table (BaseSubject: name, colour, sortOrder; migration 111)
  and Subject.baseSubjectId FK. Migration builds a BaseSubject per existing base string
  and per ungrouped subject, then links every subject. loadSubjectColors/loadBaseSubjectColors
  resolve a subject's colour from its base (base.color, else palette by base order).
  loadSubjectGroups feeds the admin editor. Legacy Subject.baseSubject/color columns kept
  but unused; setSubjectMeta retired in favour of group actions (createBaseSubject,
  renameBaseSubject, setBaseSubjectColor, deleteBaseSubject [empty only], assignSubjectToBase,
  promoteSubject). Editor: header-based, edit-mode toggle, HTML5 drag subject->group, promote,
  colour swatches per group. New subjects auto-create their own base.

## Sept 24 2026 — subject IS the colour group; classes are members (web v0.492)

- Collapsed to 2 levels: SUBJECT = colour group/header (colour on Subject.color,
  else palette by subject order), CLASS (SchoolClass) = member, grouped by subjectId.
  BaseSubject retired (table left in place, unused; migration 112 seeds Subject.color
  from base colours). loadSubjectColors back to subject-level; loadSubjectGroups returns
  subjects + distinct class names + an Unassigned bucket. New actions: assignClassToSubject
  (updateMany by class name — moves for all students), promoteClass (own subject),
  setSubjectColor, renameSubjectGroup (header only, does NOT rename classes),
  createSubjectGroup, deleteSubjectGroup (empty only). Editor: subjects as headers,
  draggable class rows (grip), promote, colour swatches per subject. Note: colours can
  shift vs the base-subject era because grouping changed base-order -> subject-order.

## Sept 24 2026 — colour consistency + feed default length (web v0.493)

- School surfaces (loadSchoolProgress, loadSchoolMetrics, loadStudentBars) now colour a
  class purely by its subject (subjectColors.get(subject.name)); the legacy class.color
  preference is dropped so cards match the subject-colours editor. class.color rows remain
  in the DB, just no longer drive display.
- ExternalCalendar.defaultDurationMin (migration 113): the length given to a feed event
  with no DTEND/DURATION (was hardcoded 60 in ics.ts). Threaded parseIcs -> buildEvent;
  sync passes calendar.defaultDurationMin ?? 60. Editable per feed in edit mode
  (setCalendarDefaultDuration, which re-syncs so existing events update).

## Sept 24 2026 — feed force-duration (web v0.494)

- ExternalCalendar.forceDuration (migration 114): when on, defaultDurationMin overrides
  every timed feed event's own end (for feeds publishing a wrong/short end). Threaded
  through parseIcs/buildEvent; sync passes calendar.forceDuration. Toggle in the feed
  edit mode (setCalendarForceDuration, re-syncs). Sandbox note: could not fetch the
  DigitalShift feed to confirm whether it sends DTEND (egress allowlist blocks
  digitalshift.ca; web_fetch refused the constructed URL) — shipped force-length so
  it works regardless.
