"use server";

import { revalidatePath } from "next/cache";
import { EventKind, PauseType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { addDays, fromDateColumn, toDateColumn } from "@/lib/dates";
import { isAdmin } from "@/lib/session";
import { generateChores } from "@/lib/chores/generate";

export type PauseRow = {
  id: string;
  name: string;
  type: PauseType;
  startISO: string;
  endISO: string;
};

export async function loadPauses(): Promise<PauseRow[]> {
  const rows = await prisma.pause.findMany({
    orderBy: { startDate: "asc" },
  });
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type as PauseType,
    startISO: fromDateColumn(p.startDate),
    endISO: fromDateColumn(p.endDate),
  }));
}

export type PauseState = { error: string | null };

export async function createPause(
  _prev: PauseState,
  formData: FormData,
): Promise<PauseState> {
  if (!(await isAdmin())) return { error: "Only a parent can do that." };

  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const rawType = String(formData.get("type") ?? "VACATION");
  const startISO = String(formData.get("start") ?? "").trim();
  const endISO = String(formData.get("end") ?? "").trim();

  const type: PauseType = rawType === "OTHER" ? "OTHER" : "VACATION";
  const label = name || (type === "OTHER" ? "Break" : "Vacation");

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(startISO) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(endISO)
  ) {
    return { error: "Pick a start and end date." };
  }
  if (endISO < startISO) {
    return { error: "The pause ends before it starts." };
  }

  // A multi-day all-day event marks the break on the calendar and shades its
  // days. endsAt is exclusive, so it runs to the day after the last paused day.
  const event = await prisma.event.create({
    data: {
      isFamily: true,
      kind: EventKind.OTHER,
      title: label,
      startsAt: toDateColumn(startISO),
      endsAt: toDateColumn(addDays(endISO, 1)),
      allDay: true,
      shadeDay: true,
    },
    select: { id: true },
  });

  await prisma.pause.create({
    data: {
      name: label,
      type,
      startDate: toDateColumn(startISO),
      endDate: toDateColumn(endISO),
      eventId: event.id,
    },
  });

  // Clear any chores already generated inside the window.
  await generateChores();

  revalidatePath("/calendar");
  revalidatePath("/admin/chores");
  revalidatePath("/");
  return { error: null };
}

export async function deletePause(id: string): Promise<{ error: string | null }> {
  if (!(await isAdmin())) return { error: "Only a parent can do that." };

  const pause = await prisma.pause.findUnique({
    where: { id },
    select: { eventId: true },
  });
  if (!pause) return { error: null };

  if (pause.eventId) {
    await prisma.event.delete({ where: { id: pause.eventId } }).catch(() => {});
  }
  await prisma.pause.delete({ where: { id } }).catch(() => {});

  // Bring chores back for the freed-up days.
  await generateChores();

  revalidatePath("/calendar");
  revalidatePath("/admin/chores");
  revalidatePath("/");
  return { error: null };
}
