"use client";

import { useState, useTransition } from "react";
import { Modal } from "./plan-file-panel";
import { PRIMARY_BTN } from "./buttons";
import { EffortPicker } from "@/components/effort-picker";
import { editSportSession } from "@/lib/actions/sport";
import type { Effort, HurtArea } from "@/lib/workouts/catalog";

/**
 * A calendar-confirmed session, edited from the day's Additional card
 * (v0.656): how hard it was, and how long you stayed when its event type's
 * time varies (stick and puck, drop-in).
 */
export function SportEditModal({
  userId,
  title,
  sport,
  onClose,
  onSaved,
}: {
  userId: string;
  title: string;
  sport: { sessionId: string; minutes: number | null; flexTime: boolean; effort: string | null; hurt: string | null };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [effort, setEffort] = useState<Effort | null>((sport.effort as Effort) ?? null);
  const [hurt, setHurt] = useState<HurtArea | null>((sport.hurt as HurtArea) ?? null);
  const [minutes, setMinutes] = useState(sport.minutes != null ? String(sport.minutes) : "");
  const [pending, start] = useTransition();
  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-4">
        <EffortPicker
          question={`How hard was ${title}?`}
          effort={effort}
          hurt={hurt}
          onChange={(e, h) => {
            setEffort(e);
            setHurt(h);
          }}
        />
        {sport.flexTime && (
          <label className="flex items-center gap-3 text-sm">
            <span className="font-semibold">How long you stayed</span>
            <input
              type="number"
              inputMode="numeric"
              min={5}
              max={600}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              className="h-10 w-20 rounded-lg border border-hairline bg-surface px-2 text-right tabular"
            />
            <span className="text-muted">min</span>
          </label>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await editSportSession(userId, {
                sessionId: sport.sessionId,
                effort,
                hurt,
                minutes: sport.flexTime && minutes ? Number(minutes) : null,
              });
              onSaved();
            })
          }
          className={`${PRIMARY_BTN} w-full disabled:opacity-50`}
        >
          Save
        </button>
      </div>
    </Modal>
  );
}
