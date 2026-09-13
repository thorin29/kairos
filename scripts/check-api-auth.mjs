// Build-time guard: every /api/v1 route must either be an explicitly
// allowlisted public endpoint or reference a device-auth guard. This makes
// authorization structurally hard to forget — a new route that ships without a
// guard (and isn't allowlisted) fails the build instead of going live open.
//
// Wired into `npm run build` (see package.json), so it runs in the Docker
// image build, which is the real validation gate.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = join("src", "app", "api", "v1");

// Genuinely public endpoints (no bearer token by design). Keep this tiny and
// deliberate; adding to it is a conscious decision to expose a route.
const PUBLIC = new Set([
  "meta/route.ts",
  "auth/login/route.ts",
  "auth/enroll/route.ts",
  "auth/join/route.ts",
  "auth/join/check/route.ts",
  "auth/forgot/route.ts",
  "game-time/ingest/route.ts", // service-token (GAMETIME_INGEST_TOKEN), not device auth
]);

// Any of these in a route's source counts as "this route authenticates".
const GUARDS = ["requireDevice", "requireDeviceForReauth", "withDeviceAuth"];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name === "route.ts") out.push(p);
  }
  return out;
}

const routes = walk(ROOT);
const offenders = [];
for (const abs of routes) {
  const rel = relative(ROOT, abs).split(sep).join("/");
  if (PUBLIC.has(rel)) continue;
  const src = readFileSync(abs, "utf8");
  if (!GUARDS.some((g) => src.includes(g))) offenders.push(rel);
}

if (offenders.length > 0) {
  console.error(
    "\nAPI auth check FAILED — these /api/v1 routes reference no device-auth guard and aren't allowlisted:",
  );
  for (const o of offenders) console.error("  - " + o);
  console.error(
    "\nFix: use withDeviceAuth / requireDevice in the route, or (if it is truly\n" +
      "public) add it to PUBLIC in scripts/check-api-auth.mjs.\n",
  );
  process.exit(1);
}

console.log(
  `API auth check OK — ${routes.length} routes: ${PUBLIC.size} public, ${
    routes.length - PUBLIC.size
  } guarded.`,
);
