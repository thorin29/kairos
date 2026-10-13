#!/bin/sh
# Everything that must pass before a zip goes out.
#
# The Docker build is the only place the Prisma client exists, so it is the only
# place Prisma result types are real. These checks exist to catch, locally, the
# classes of mistake that otherwise surface as a failed deploy.
set -e
node scripts/typecheck-report.mjs --changed
python3 scripts/check-jsx-escapes.py src
python3 scripts/check-prisma-select.py src
echo "preflight OK"
