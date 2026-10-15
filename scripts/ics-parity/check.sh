#!/usr/bin/env bash
# Parity check: the web's ics-import.ts and the app's IcsImport.kt must give the
# same draft for the same file. Runs the hand-written cases plus a seeded random
# batch, in several household time zones, and diffs the two outputs.
#
#   scripts/ics-parity/check.sh <path-to-kairos-app-clone> [kotlinc] [tsx]
#
# Needs kotlinc (the JetBrains compiler zip from GitHub releases works) and tsx.
set -euo pipefail
APP="${1:?path to a kairos-app clone}"
KOTLINC="${2:-kotlinc}"
TSX="${3:-npx tsx}"
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# The one shared constant: the note cap must match on both sides.
TS_MAX=$(grep -oE 'NOTES_MAX = [0-9]+' "$ROOT/src/lib/calendar/event-notes.ts" | grep -oE '[0-9]+')
KT_MAX=$(grep -oE 'const val NOTES_MAX = [0-9]+' "$APP/app/src/main/java/com/kairos/app/ui/calendar/NoteField.kt" | grep -oE '[0-9]+')
[ "$TS_MAX" = "$KT_MAX" ] || { echo "NOTES_MAX differs: web $TS_MAX, app $KT_MAX"; exit 1; }

printf 'package com.kairos.app.ui.calendar\nconst val NOTES_MAX = %s\n' "$KT_MAX" > "$WORK/NotesMax.kt"
"$KOTLINC" -nowarn "$APP/app/src/main/java/com/kairos/app/ui/calendar/IcsImport.kt" \
  "$WORK/NotesMax.kt" "$HERE/Runner.kt" -include-runtime -d "$WORK/runner.jar" 2>&1 | grep -v '^warning' || true

mkdir -p "$WORK/gen"
python3 "$HERE/gen-cases.py" "$WORK/gen" "${ICS_PARITY_COUNT:-3000}" "${ICS_PARITY_SEED:-1}"

fail=0
for dir in "$HERE/cases" "$WORK/gen"; do
  for tz in America/Chicago Europe/London Australia/Lord_Howe Not/AZone; do
    (cd "$ROOT" && $TSX "$HERE/run-ts.ts" "$dir" "$tz") > "$WORK/ts.txt"
    java -jar "$WORK/runner.jar" 2>/dev/null "$dir" "$tz" > "$WORK/kt.txt"
    n=$(wc -l < "$WORK/ts.txt")
    if diff -q "$WORK/ts.txt" "$WORK/kt.txt" >/dev/null; then
      echo "ok   $(basename "$dir") $tz ($n files)"
    else
      echo "DIFF $(basename "$dir") $tz"; { diff "$WORK/ts.txt" "$WORK/kt.txt" | head -20 || true; }; fail=1
    fi
  done
done
exit $fail
