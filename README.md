# Family Dashboard

Self-hosted chores, school, Bible reading, exercise, work and calendar
tracking for the household. Next.js + Postgres, published to GHCR and run
as a single Unraid container.

## First run

### 1. Create the database

The app expects its own database and user inside the existing
`postgresql18` container:

```bash
docker exec -it postgresql18 psql -U postgres
```

```sql
CREATE USER famdash WITH PASSWORD 'pick-something-long';
CREATE DATABASE familydashboard OWNER famdash;
\q
```

### 2. Push this repo to GitHub

The Actions workflow builds and pushes `ghcr.io/<user>/family-dashboard:latest`
on every commit to `main`. Make the package public, or add GHCR credentials
in Unraid, so the server can pull it.

### 3. Add the container in Unraid

| Setting | Value |
| --- | --- |
| Repository | `ghcr.io/<user>/family-dashboard:latest` |
| Network | `roguenet` |
| Port | `8642` → `3000` |
| Path | `/mnt/user/appdata/family-dashboard/uploads` → `/app/uploads` |
| Path | `/mnt/user/appdata/family-dashboard/backups` → `/app/backups` |
| Variable | `DATABASE_URL` (see `.env.example`) |
| Variable | `TZ` = `America/Chicago` |
| Variable | `PUID` = `99`, `PGID` = `100` |

Migrations apply automatically on start, and the household is seeded on
first boot.

## Notes

- The image is pinned to `postgres:18` conventions but only needs a
  reachable Postgres 14+.
- `AUTO_SEED=false` once people are managed through the UI.
- Nightly `pg_dump` writes to `/app/backups`, which maps into appdata so
  existing appdata backups cover it.

## Development

```bash
npm install
cp .env.example .env   # point DATABASE_URL at a local Postgres
npx prisma migrate dev
npm run seed
npm run dev
```
