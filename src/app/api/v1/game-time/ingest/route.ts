import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiOk, apiError } from "@/lib/api/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ingest endpoint for the game-time collector. The collector computes the
 * resolved per-person daily rollups (Steam-primary merge already applied) plus
 * each person's current profile status, and POSTs them here. Kairos just stores
 * and aggregates — no source credentials, no merge logic, live here.
 *
 * Auth: a shared secret in GAMETIME_INGEST_TOKEN, sent as `Authorization:
 * Bearer <token>` or `X-Ingest-Token: <token>`. This is a service token, not a
 * device/person session — it's the only external-ingest auth in the app.
 *
 * Body:
 *   {
 *     "days": [
 *       { "friend": "Ethan", "gamertag": "honda_c_type_r", "steamId": "765...",
 *         "date": "2026-09-12", "minutes": 143,
 *         "games": [ { "game": "Grounded", "minutes": 143 } ],
 *         "status": { "gamerscore": 1240, "gamerpic": "https://...",
 *                     "hasGamePass": true, "msBalance": "$12.50" } }
 *     ]
 *   }
 * Idempotent: safe to re-send "today so far" repeatedly.
 */

type DayEntry = {
  friend?: string;
  gamertag?: string;
  steamId?: string;
  date: string;
  minutes?: number;
  games?: { game: string; minutes?: number }[];
  status?: {
    gamerscore?: number | null;
    gamerpic?: string | null;
    hasGamePass?: boolean | null;
    msBalance?: string | null;
  };
};

function tokenOk(req: NextRequest): boolean {
  const expected = process.env.GAMETIME_INGEST_TOKEN;
  if (!expected) return false;
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : null;
  const header = req.headers.get("x-ingest-token");
  return bearer === expected || header === expected;
}

async function resolveUserId(e: DayEntry): Promise<{ id: string; name: string } | null> {
  if (e.gamertag) {
    const u = await prisma.user.findFirst({
      where: { gamertag: { equals: e.gamertag, mode: "insensitive" } },
      select: { id: true, name: true },
    });
    if (u) return u;
  }
  if (e.steamId) {
    const u = await prisma.user.findFirst({
      where: { steamId: e.steamId },
      select: { id: true, name: true },
    });
    if (u) return u;
  }
  if (e.friend) {
    const u = await prisma.user.findFirst({
      where: { name: { equals: e.friend, mode: "insensitive" } },
      select: { id: true, name: true },
    });
    if (u) return u;
  }
  return null;
}

const clampMin = (n: unknown) => Math.max(0, Math.round(Number(n) || 0));

export async function POST(req: NextRequest) {
  if (!tokenOk(req)) return apiError("unauthenticated", "Bad or missing ingest token.");

  let body: { days?: DayEntry[] };
  try {
    body = await req.json();
  } catch {
    return apiError("validation", "Invalid JSON.");
  }
  const days = Array.isArray(body?.days) ? body.days : [];

  const matched: string[] = [];
  const unmatched: string[] = [];

  for (const e of days) {
    if (!e?.date) continue;
    const user = await resolveUserId(e);
    if (!user) {
      unmatched.push(e.friend ?? e.gamertag ?? e.steamId ?? "?");
      continue;
    }
    const date = new Date(`${e.date}T00:00:00Z`);
    const minutes = clampMin(e.minutes);

    await prisma.gameDay.upsert({
      where: { userId_date: { userId: user.id, date } },
      create: { userId: user.id, date, minutes },
      update: { minutes },
    });

    for (const g of Array.isArray(e.games) ? e.games : []) {
      if (!g?.game) continue;
      const m = clampMin(g.minutes);
      await prisma.gameDayTitle.upsert({
        where: { userId_date_game: { userId: user.id, date, game: g.game } },
        create: { userId: user.id, date, game: g.game, minutes: m },
        update: { minutes: m },
      });
    }

    if (e.status) {
      const s = e.status;
      await prisma.playerCard.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          gamerscore: s.gamerscore ?? null,
          gamerpic: s.gamerpic ?? null,
          hasGamePass: s.hasGamePass ?? null,
          msBalance: s.msBalance ?? null,
        },
        update: {
          gamerscore: s.gamerscore ?? undefined,
          gamerpic: s.gamerpic ?? undefined,
          hasGamePass: s.hasGamePass ?? undefined,
          msBalance: s.msBalance ?? undefined,
        },
      });
    }

    matched.push(user.name);
  }

  return apiOk({ matched, unmatched });
}
