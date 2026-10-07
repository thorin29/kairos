#!/usr/bin/env node
/**
 * Typecheck the app and separate real errors from sandbox noise.
 *
 * WHY THIS EXISTS
 * ---------------
 * `prisma generate` cannot run in every environment (binaries.prisma.sh is not
 * always reachable), and without it `src/generated/prisma` does not exist. Every
 * query file then resolves to `any`/`unknown` and `tsc` emits a few hundred
 * cascade errors that say nothing about the code.
 *
 * The obvious workaround — grep for the error codes you think matter — is a trap:
 * it is an ALLOWLIST, so the first error code you did not think of sails straight
 * through into a Docker build. That is exactly how `TS2538: Type 'null' cannot be
 * used as an index type` reached a release.
 *
 * So this inverts it. An error is excused only when it can be ATTRIBUTED to the
 * missing client. Everything else is fatal, including error codes nobody has
 * seen yet. And any error at all in a file this change touches is fatal, because
 * those files are the ones under test.
 *
 * Usage:
 *   node scripts/typecheck-report.mjs                 # whole repo
 *   node scripts/typecheck-report.mjs --changed       # also fail on ANY error
 *                                                     # in files git reports dirty
 * Exit code is 1 when anything fatal is found.
 */
import { execSync } from "node:child_process";

const ERROR_RE = /^(.+?)\((\d+),(\d+)\): error TS(\d+): (.*)$/;

/** Cascade classes the missing generated client is known to produce. */
const NOISE = [
  // Implicit `any` on a parameter or a destructured binding, which happens
  // wherever a Prisma row type collapsed to `any`.
  { code: 7006 },
  { code: 7031 },
  // The missing module itself.
  { code: 2307, message: /@\/generated/ },
  // `unknown` / `{}` landing somewhere a real type was expected. Only counts
  // when the message actually names `unknown` or `{}` — a genuine type
  // mismatch between two real types is NOT excused.
  { code: 2345, message: /type 'unknown'|type '\{\}'/i },
  { code: 2339, message: /on type 'unknown'|on type '\{\}'/i },
  { code: 2322, message: /type 'unknown'|type '\{\}'/i },
  // `{}`/`unknown` used as an index type, which is a collapsed Prisma row.
  // NOT excused when it names 'null' — that is the real bug this script was
  // written after.
  { code: 2538, message: /type '\{\}'|type 'unknown'/i },
  { code: 18046 },
  { code: 18047 },
];

const isNoise = (e) =>
  NOISE.some((n) => n.code === e.code && (!n.message || n.message.test(e.message)));

function tsc() {
  try {
    execSync("npx tsc --noEmit", { encoding: "utf8", stdio: "pipe" });
    return "";
  } catch (err) {
    // tsc exits nonzero when it finds errors; the report is on stdout.
    return `${err.stdout ?? ""}${err.stderr ?? ""}`;
  }
}

function changedFiles() {
  try {
    const out = execSync(
      "git diff --name-only; git ls-files --others --exclude-standard",
      { encoding: "utf8" },
    );
    return new Set(
      out
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.endsWith(".ts") || l.endsWith(".tsx")),
    );
  } catch {
    return new Set();
  }
}

const onlyChanged = process.argv.includes("--changed");
const dirty = changedFiles();

const errors = [];
for (const line of tsc().split("\n")) {
  const m = ERROR_RE.exec(line.trim());
  if (!m) continue;
  errors.push({
    file: m[1],
    line: Number(m[2]),
    code: Number(m[4]),
    message: m[5],
    raw: line.trim(),
  });
}

const touched = (e) => [...dirty].some((f) => e.file.endsWith(f) || f.endsWith(e.file));

// Fatal unless attributable to the missing client — and never excused in a file
// this change touches, however familiar the error code looks.
const fatal = errors.filter((e) => !isNoise(e) || touched(e));
const noise = errors.filter((e) => !fatal.includes(e));

const inDirty = fatal.filter(touched);

console.log(`tsc errors: ${errors.length} total — ${fatal.length} fatal, ${noise.length} attributed to the missing Prisma client`);

if (onlyChanged) {
  console.log(`changed .ts/.tsx files: ${dirty.size}`);
}

if (inDirty.length > 0) {
  console.log(`\nIN FILES THIS CHANGE TOUCHES (${inDirty.length}) — always fatal:`);
  for (const e of inDirty) console.log(`  ${e.raw}`);
}

const elsewhere = fatal.filter((e) => !touched(e));
if (elsewhere.length > 0) {
  console.log(`\nELSEWHERE (${elsewhere.length}) — not attributable to the missing client:`);
  for (const e of elsewhere) console.log(`  ${e.raw}`);
}

if (fatal.length === 0) {
  console.log("\nOK — nothing fatal. Safe to build.");
}

process.exit(fatal.length > 0 ? 1 : 0);
