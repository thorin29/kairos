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

/**
 * The line ranges this change actually touches, per file, from `git diff -U0`.
 *
 * "Any error in a touched file is fatal" is right for a small component and
 * wrong for a 1200-line query file where ten lines moved: it resurfaces
 * pre-existing cascade noise as if it were new. Noise is excused away from the
 * hunks and still fatal inside them.
 */
function changedRanges() {
  const ranges = new Map();
  try {
    const out = execSync("git diff -U0", { encoding: "utf8", maxBuffer: 1 << 26 });
    let file = null;
    for (const line of out.split("\n")) {
      const f = /^\+\+\+ b\/(.+)$/.exec(line);
      if (f) {
        file = f[1];
        if (!ranges.has(file)) ranges.set(file, []);
        continue;
      }
      const h = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
      if (h && file) {
        const start = Number(h[1]);
        const count = h[2] === undefined ? 1 : Number(h[2]);
        // A pad either side: an error often points just outside the edit.
        ranges.get(file).push([start - 3, start + Math.max(count, 1) + 3]);
      }
    }
  } catch {
    /* no git, or no diff: fall back to whole-file strictness */
  }
  return ranges;
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
const ranges = changedRanges();

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

/** Is this error inside (or beside) a line this change actually edited? */
const inHunk = (e) => {
  for (const [f, rs] of ranges) {
    if (!(e.file.endsWith(f) || f.endsWith(e.file))) continue;
    if (rs.some(([a, b]) => e.line >= a && e.line <= b)) return true;
  }
  // An untracked file is new in its entirety, so all of it counts as changed.
  return touched(e) && !ranges.has([...dirty].find((f) => e.file.endsWith(f)) ?? "");
};

/**
 * The one unconditional excuse: a missing-module error for the generated Prisma
 * client itself. That module's absence is a property of this sandbox, not of
 * the code — it exists in the Docker build — so proximity to an edit cannot
 * make it real, and the hunk padding would otherwise flag it as new.
 */
const isMissingClient = (e) => e.code === 2307 && /@\/generated/.test(e.message);

// Fatal unless attributable to the missing client — and never excused where
// this change actually edited, however familiar the error code looks.
const fatal = errors.filter(
  (e) => !isMissingClient(e) && (!isNoise(e) || inHunk(e)),
);
const noise = errors.filter((e) => !fatal.includes(e));

const inDirty = fatal.filter(inHunk);

console.log(`tsc errors: ${errors.length} total — ${fatal.length} fatal, ${noise.length} attributed to the missing Prisma client`);

if (onlyChanged) {
  console.log(`changed .ts/.tsx files: ${dirty.size}`);
}

if (inDirty.length > 0) {
  console.log(`\nIN FILES THIS CHANGE TOUCHES (${inDirty.length}) — always fatal:`);
  for (const e of inDirty) console.log(`  ${e.raw}`);
}

const elsewhere = fatal.filter((e) => !inHunk(e));
if (elsewhere.length > 0) {
  console.log(`\nELSEWHERE (${elsewhere.length}) — not attributable to the missing client:`);
  for (const e of elsewhere) console.log(`  ${e.raw}`);
}

if (fatal.length === 0) {
  console.log("\nOK — nothing fatal. Safe to build.");
}

process.exit(fatal.length > 0 ? 1 : 0);
