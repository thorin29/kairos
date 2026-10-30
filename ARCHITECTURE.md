# Kairos Android app — architecture

Native Kotlin / Jetpack Compose client for the Kairos household dashboard. Talks
only to the versioned REST API (`/api/v1`) in the web repo's `docs/API.md`. The
web app is the source of truth for behaviour and look; the app **mirrors the web
from source** rather than inventing its own UX.

## Stack / build

- AGP 8.13.2, Gradle 8.13, Kotlin 2.2.21, Compose BOM 2025.06.01.
- compileSdk / targetSdk 36, minSdk 26, JDK 17. `applicationId com.kairos.app`.
- Retrofit + OkHttp + `retrofit2-kotlinx-serialization-converter`, kotlinx.serialization.
- DataStore (settings + token blob). Coil (`io.coil-kt:coil-compose:2.7.0`) for avatars.
- Navigation-Compose type-safe routes. Manual DI (no Hilt).
- Release APK is signed in CI (`.github/workflows/android.yml`) with secrets
  `KEYSTORE_BASE64`, `KEY_ALIAS`, `KEYSTORE_PASSWORD`, `KEY_PASSWORD`
  (KEY_PASSWORD == KEYSTORE_PASSWORD; PKCS12 requires it). R8 minify OFF for now.

## Versioning — bump all three every release

- `app/build.gradle.kts`: `versionCode` (integer, +1) and `versionName` (semver).
- `SessionRepository`: `const val CLIENT_BUILD` — keep equal to `versionCode`.
- `CHANGELOG.md`: user-facing entry at the top.

## Networking (`data/remote`)

- `ApiClient.create(baseUrl, tokenProvider)` builds the Retrofit `ApiService`.
  `normalizeBase` turns the user's bare origin into `<origin>/api/v1/`.
- `AuthInterceptor(tokenProvider)` attaches `Authorization: Bearer <token>` to
  every request when a token is held (no per-method header). `tokenProvider` is
  `{ tokenStore.current() }` — an in-memory read, never a blocking decrypt on the
  network thread.
- JSON is lenient: `ignoreUnknownKeys = true`, `explicitNulls = false`,
  `coerceInputValues = true`. **Every DTO field should have a default** so a
  status-only response (`{ "status": "ok" }`) still deserialises. (See DECISIONS
  — a required `id` once silently broke a refresh.)
- `Response<T>.bodyOrThrow()` maps the `{ error }` envelope to a typed
  `ApiException(ApiError.*)`. `apiCall {}` turns transport failures into
  `ApiError.Network`.
- `ApiClient.resolveUrl(base, path)` resolves a relative URL (e.g. an avatar
  `/api/v1/avatars/x.png`) against the configured origin.

## Auth / session

- `SessionState` sealed interface: `Loading → NeedsSetup → NeedsEnroll → Ready`.
  It drives all top-level UI, which eliminates soft-navigation bypass as a class.
- Device token stored encrypted (Android Keystore AES-256-GCM) via `TokenStore`;
  `tokenStore.current()` is the in-memory copy used by the interceptor and Coil.
- Layered login+code enrollment; passwordless kids use a code alone.
  Credential-version gate: a password change server-side returns
  `reauth_required` (401) → the app shows the reauth screen (device stays enrolled).

## Dependency container (`di/AppContainer`)

Manual container built once in `KairosApp`. Holds `settingsStore`, `tokenStore`,
`sessionRepository`, `navExpanded` (rail state), and `imageLoader` (a Coil
`ImageLoader` whose OkHttp client reuses `AuthInterceptor { tokenStore.current() }`
so avatar requests carry the device token). Reach it in composables with
`rememberContainer()`.

## Navigation

- Routes are `@Serializable` objects/classes in `ui/nav/Routes.kt`.
- `AppRoot` hosts the `NavHost`; add a screen with `composable<Route.X> { ... }`
  and navigate with `navController.navigate(Route.X)` / `popBackStack()`.
- The nav shell is a custom overlay rail (`ui/nav/KairosRail.kt`), not a Material
  drawer: teal panel `#86A0A3`, collapsed 76dp (icons) / expanded 224dp (labels),
  expand state in `AppContainer.navExpanded`. Icons in `KairosIcons.kt` (SVG paths
  ported from the web). Section metadata in `AppSections.kt`.

## Screen pattern (used everywhere — follow it for new sections)

1. **DTOs** in `data/remote/dto/Dtos.kt` (`@Serializable`, all fields defaulted).
2. **ApiService** method (Retrofit) + **SessionRepository** wrapper using
   `runAuthed { requireService().call() }` (handles reauth/401).
3. **ViewModel** with a `StateFlow<XUiState>`; an `init { load() }`, and an
   `act { ... }` helper that runs a mutation then reloads (so the UI refreshes
   without the user re-navigating). Guard reentrancy with a `busy` flag.
4. **Screen** composable: `rememberContainer()` → build the VM via
   `viewModelFactory`; render loading / error / content; pass navigation as
   lambdas from `AppRoot`.

## Images / avatars

- Uploaded avatars are served by the device-authed `GET /api/v1/avatars/[file]`
  (the web's `/api/avatars/*` sits behind Authelia and the app can't reach it).
- `/me` sends `avatarUrl` (relative, `/api/v1/...`), `avatarIcon` (emoji), and
  `avatarPosition` (`"tx ty scale"`). Render with `SubcomposeAsyncImage`
  (`imageLoader = container.imageLoader`, `ContentScale.Crop`) inside a circle,
  falling back to emoji/initials on null/error. Apply `avatarPosition` with a
  `graphicsLayer { scaleX/Y = scale; translationX = tx/100f*size.width; ... }` —
  this mirrors the web's `translate(tx%, ty%) scale(s)` on an `object-cover` image.
- A companion picture arrives as `avatarCompanion { species, stage, image }` and
  is drawn ONLY through `CompanionAvatarArt` (ui/common/PersonAvatar.kt): fitted
  whole at 76% of the circle, no framing. Any new avatar view must check it
  before `avatarUrl`. It is chosen in the gallery (`StagePickerDialog`) via
  `POST /me/avatar/companion`; the session adopts the returned person.

## Theme

**Type matches the web** (`ui/theme/Type.kt`): IBM Plex Sans for text and
Bricolage Grotesque for headings (display, headline, `titleLarge`), from the
web's own font files converted to TTF in `res/font/` (Bricolage cut to 600 and
700). Titles and labels are a step heavier than Material's defaults. Plain
`Text` picks it up through `MaterialTheme`; don't set `fontFamily` per screen.

**Eight colour schemes plus a light/dark mode, per device** (`ui/theme/Theme.kt`).
The mode is `SettingsStore.themeMode`: SYSTEM (default; follows the phone),
LIGHT or DARK — the old on/off `dark_mode` key still decides it for anyone who
set it. `widgetPalette(scheme, dark)` hands the home-screen widget the same
colours.
`ThemeScheme` is the enum — TEAL (default), OLIVE, GREEN, BLUE, PURPLE, PINK,
ORANGE, RED — resolved from a stored key with `ThemeScheme.fromKey`, and
`KairosTheme(scheme, darkTheme)` picks `lightScheme(p)` / `darkScheme(p)` and
publishes `KairosThemeState.accent` / `.sidebar` / `.dark` for non-Material
surfaces. `MainActivity` reads both from `SettingsStore` and passes them in.
Settings → Appearance also holds the 24-hour clock option. (The "light only,
dark mode deliberately off" rule this file used to carry was superseded when the
Settings epic shipped; the web has the same eight themes household-wide from
Admin → Appearance.)

## Grocery and store icons

Items and stores store a short **icon token**, rendered by `GroceryGlyph`
(`ui/groceries/GroceryGlyph.kt`) — the single renderer for both:

- a bare **emoji** → drawn as text;
- **`ic:<name>`** → `GLYPH_DRAWABLES` (five legacy PNGs);
- **`kairos:<slug>`** → `KAIROS_DRAWABLES` → `R.drawable.grocery_<slug>` in
  `res/drawable-nodpi/`. **Hyphens in the slug become underscores** in the
  resource name (`kairos:baby-wipes` → `grocery_baby_wipes`).
- anything else that looks prefixed (`^[a-z]+:`) → **📦**, never the raw token.

Two rules that follow from this: the web server must ship **before** the app when
a new token is introduced (a phone can only draw art it has bundled — otherwise
the user sees 📦), and every entry added to `KAIROS_DRAWABLES` must have a real
PNG bundled or the build fails on an unresolved resource. The web repo's
`DECISIONS.md` holds the token contract and the icon-sheet slicing pipeline.

## Calendar time model (shared with the server — don't improvise here)

The server sends per-day **segments** for layout (`dayISO`, `startMin`, `endMin`,
where `1440` means end-of-day and is *not* a clock value) plus the event's **true
bounds** (`startDayISO`, `startMinExact`, `endDayISO`, `endMinExact`).
`CalendarAddEvent.kt` initialises the editor from the exact bounds when they are
present and falls back to the segment (rolling a `1440` end forward to 00:00 of
the next day) when they aren't — so an overnight event opens whole regardless of
which day was tapped.

- **Midnight is 00:00 on the next day, never 23:59.** Clock state stays 0–1439.
- `TimePickerDialog` clamps input to 0..23:59 as a **crash guard only**
  (`rememberTimePickerState` throws on hour ≥ 24); it is not the time model.
- **All-day is inclusive in the UI, exclusive on the wire**: the editor shows
  Starts and Ends as the first and last covered day, and sends
  `endDate = endDateIso + 1 day` for `allDay`. A timed event sends its real end
  day. Reverse the conversion when loading.
- Save is disabled and the offending field reddens while the end is at or before
  the start; the All-day switch normalises the dates/times rather than leaving a
  zero-length span.

## Calendar file import (`ui/calendar/IcsImport.kt`)

An `.ics` opened or shared into the app becomes a pre-filled New event:
MainActivity's VIEW/SEND filters → the file read on IO (≤1 MB) into
`AppContainer.pendingIcs` + `pendingRoute = "calendar"` → CalendarScreen waits
for its data, parses on `data.timezone`, and opens `AddEventOverlay(importDraft)`
or explains why not. Only a fresh activity imports (not a rotation/restore).
Both `pendingRoute` and `pendingIcs` are consumed only where
`rememberActivityOnScreen()` is true — several MainActivity instances can be
alive, and a stopped one must not take the hand-off.
`IcsImport.kt` is a line-for-line mirror of the web's
`src/lib/calendar/ics-import.ts`; the web repo's `scripts/ics-parity/check.sh`
compiles this file with `kotlinc` and diffs the two over thousands of files.
Never change one without the other and a parity run.

## Scoring (`ui/character/`, `ui/settings/ScoringGuideScreen.kt`)

The phone computes no scoring. `/api/v1/characters` sends the growth row
(`xpCells`, `cellGaps`, `pendingFrom`, `growthLabel`) and `month`; the How
scoring works screen draws `/api/v1/scoring/guide`. Rules: web docs/SCORING.md.

## Hockey (`ui/hockey/`)

A read-only client of `GET /api/v1/hockey`; the server does all the shaping
(web `buildHockeyView`). Add to calendar goes through
`container.pendingCalendarOpen` (`CalendarOpen.NewFromDraft`) to the Calendar's
New event, with the event type preset via `AddEventOverlay(presetEventTypeId)`.
Layout (order, open sections) comes from the server per person; changes are
applied locally, written to the Room page cache and posted to
`/api/v1/hockey/prefs` (queued when offline).

## Home-screen widget (`widget/`)

Glance (`androidx.glance:glance-appwidget`). `KairosWidget` draws
`WidgetStore.state`: the last `GET /api/v1/widget` feed (cached in DataStore,
so it draws offline) plus this phone's theme, colour, event style (SOLID/BAR)
and scope (FAMILY/MINE) from Settings → Appearance. The server colours events
exactly as the person's Calendar does (`personalEventRules` on the web) — never
recolour them here. It refreshes every 30 minutes (`updatePeriodMillis`), when
the app is left (`MainActivity.onStop`), after a sync, after an Appearance
change, and on its own button; `KairosWidget.refresh` does nothing when no
widget is placed. Taps open the app through `Notifications.EXTRA_OPEN`:
"calendar" (+ `EXTRA_EVENT`, the event as JSON → `pendingCalendarOpen`),
"tasks", "task:<id>" (→ `highlightTaskId`), "task-new", "calendar-new". A task's
checkbox completes it with `completeTaskFromNotification`, falling back to
`CompleteTaskWorker` offline. The + button is `WidgetAddActivity`, a
see-through activity drawn as a dialog (a widget can't show one itself). Both
header buttons are bare icons (`HeaderButton`): no fill, full-size tap area.
Rules learned the hard way: the launcher REUSES list rows, so every row must
draw the same views with every modifier set both ways (a background left off
in one branch keeps the last row's — stray "today" circles); light/dark is the
widget's own setting (`widgetTheme`, default "APP" = follow the app);
`SizeMode.Exact` + `LocalSize` shrink the header on narrow widgets (the
month is always written in full); the picker
preview is a static `layout/widget_preview.xml` with made-up events
(`previewLayout`, Android 12+) — never real household data.

## Docs that must stay current

`CHANGELOG.md` every release (it becomes the in-app release notes), `DECISIONS.md`
whenever a guardrail or a model is settled, and this file whenever the stack,
theming, or a cross-cutting model changes. Doc upkeep is part of the release, not
an afterthought — this file claiming "light only" months after dark mode shipped
is what that rule exists to prevent.

## Where things live

- `ui/<section>/` — screens + view models per feature (e.g. `ui/workout/`).
- `ui/workout/MovementSetsScreen.kt` — one planned movement's sets for a day.
  `WorkoutLogScreen.kt` mirrors the web's blocks.ts: `daySections` / `blockKind`
  (sections and order), `opensSetLogger` (the split rule), `dayProgress` and
  `stripState`; keep them in step.
- `ui/calendar/NoteField.kt`, `ui/calendar/IcsImport.kt` — the two rules mirrored
  from the web (`event-notes.ts`, `ics-import.ts`); keep them in step.
- `ui/common/` — `rememberContainer`, shared composables.
- `data/remote/` — ApiClient, ApiService, AuthInterceptor, dto/Dtos.kt, ApiError.
- `data/session/` — SessionRepository, SessionState.
- `data/secure/` — TokenStore. `data/settings/` — SettingsStore.
