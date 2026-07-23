#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set. Add it as a container variable and restart."
  exit 1
fi

# The pg driver parses DATE columns at the process's local midnight, so the
# process must run in UTC for stored dates to read back as written. The
# household's real timezone moves to HOUSEHOLD_TZ, which is what decides
# when "today" rolls over.
export HOUSEHOLD_TZ="${HOUSEHOLD_TZ:-${TZ:-UTC}}"
export TZ=UTC
echo "Household timezone: ${HOUSEHOLD_TZ}"

echo "Waiting for the database..."
i=0
until npx prisma migrate status >/dev/null 2>&1 || [ $i -ge 30 ]; do
  i=$((i + 1))
  sleep 2
done

echo "Applying migrations..."
npx prisma migrate deploy

# Single mapped volume; the container builds its own structure inside.
DATA_DIR=${DATA_DIR:-/app/data}
mkdir -p "$DATA_DIR/uploads" "$DATA_DIR/backups"

PUID=${PUID:-99}
PGID=${PGID:-100}
chown -R "$PUID:$PGID" "$DATA_DIR" 2>/dev/null || true

echo "Starting on port ${PORT}. Open the web UI to create the first account."
exec su-exec "$PUID:$PGID" "$@"
