#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set. Add it as a container variable and restart."
  exit 1
fi

echo "Waiting for the database..."
i=0
until prisma migrate status --schema=/app/prisma/schema.prisma >/dev/null 2>&1 || [ $i -ge 30 ]; do
  i=$((i + 1))
  sleep 2
done

echo "Applying migrations..."
prisma migrate deploy --schema=/app/prisma/schema.prisma

# Single mapped volume; the container builds its own structure inside.
DATA_DIR=${DATA_DIR:-/app/data}
mkdir -p "$DATA_DIR/uploads" "$DATA_DIR/backups"

PUID=${PUID:-99}
PGID=${PGID:-100}
chown -R "$PUID:$PGID" "$DATA_DIR" 2>/dev/null || true

echo "Starting on port ${PORT}. Open the web UI to create the first account."
exec su-exec "$PUID:$PGID" "$@"
