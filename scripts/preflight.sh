#!/bin/sh
# Everything that must pass before a zip goes out.
#
# Prisma result types are only real once the client is generated. Where the
# engine download is blocked (a sandbox), generate it anyway against a dummy
# schema engine: generation never runs the engine. With the real client the
# whole project must type-check clean; without it, fall back to the changed-file
# report, which can't see Prisma-typed mistakes.
set -e
GEN=src/generated/prisma
MADE=""
if [ ! -d "$GEN" ]; then
  FAKE=$(mktemp -d)
  printf '#!/bin/sh\nexit 0\n' > "$FAKE/schema-engine"
  chmod +x "$FAKE/schema-engine"
  if PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 PRISMA_SCHEMA_ENGINE_BINARY="$FAKE/schema-engine" \
      npx prisma generate >/dev/null 2>&1; then
    MADE=1
  fi
  rm -rf "$FAKE"
fi
if [ -d "$GEN" ]; then
  if npx tsc --noEmit -p tsconfig.json; then
    echo "Full type check with the real Prisma client: 0 errors."
  else
    [ -n "$MADE" ] && rm -rf src/generated
    echo "Type errors above. Not safe to build."
    exit 1
  fi
  # Never leave a client this script made behind: it isn't git-ignored.
  [ -n "$MADE" ] && rm -rf src/generated
else
  node scripts/typecheck-report.mjs --changed
fi
python3 scripts/check-jsx-escapes.py src
python3 scripts/check-prisma-select.py src
echo "preflight OK"
