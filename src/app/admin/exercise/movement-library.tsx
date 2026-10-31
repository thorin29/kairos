"use client";

import { useState, useTransition } from "react";
import { Card, SectionHeading } from "@/components/ui";
import { PlusIcon, TrashIcon } from "@/components/icons";
import { CATEGORY_LABEL, MUSCLE_GROUP_LABEL, type MuscleGroup, type WorkoutCategory } from "@/lib/workouts/catalog";
import type { EquipmentItem } from "@/lib/workouts/library";
import type { LibraryStatus } from "@/lib/workouts/library-run";
import { applyMovementLibrary, saveHouseholdEquipment } from "@/lib/actions/workouts";

const FIELD =
  "h-9 rounded-full border border-hairline bg-surface px-3 text-sm outline-none focus:border-accent";
const BUTTON =
  "inline-flex h-9 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-40";
const QUIET =
  "inline-flex h-9 items-center gap-1.5 rounded-full border border-hairline px-4 text-sm font-semibold text-accent hover:border-accent disabled:opacity-40";

/** Movement library: add the starting movements (all or picked). */
export function MovementLibrary({ status }: { status: LibraryStatus }) {
  const [pending, startTransition] = useTransition();
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [done, setDone] = useState<{ added: number; tagged: number } | null>(null);

  const apply = (keys: string[] | null) =>
    startTransition(async () => {
      setDone(await applyMovementLibrary(keys));
      setPicking(false);
      setPicked(new Set());
    });

  const groups = new Map<string, LibraryStatus["add"]>();
  for (const m of status.add) {
    const label =
      m.category === "WEIGHTS" && m.muscleGroup
        ? MUSCLE_GROUP_LABEL[m.muscleGroup as MuscleGroup]
        : CATEGORY_LABEL[m.category as WorkoutCategory];
    groups.set(label, [...(groups.get(label) ?? []), m]);
  }
  const nothing = status.add.length === 0 && status.tag === 0;

  return (
    <section>
      <SectionHeading>Movement library</SectionHeading>
      <Card className="p-5">
        <p className="text-sm">
          {nothing ? (
            <span className="text-muted">All {status.total} library movements are in the pool.</span>
          ) : (
            <>
              <span className="font-semibold">{status.add.length} new</span>
              {status.tag > 0 && <span className="text-muted"> · {status.tag} to tag</span>}
            </>
          )}
          {done && (
            <span className="ml-2 text-muted" aria-live="polite">
              Added {done.added}, tagged {done.tagged}.
            </span>
          )}
        </p>
        {!nothing && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={pending} onClick={() => apply(null)} className={BUTTON}>
              <PlusIcon className="h-4 w-4" />
              Add all
            </button>
            {status.add.length > 0 && (
              <button type="button" disabled={pending} onClick={() => setPicking((p) => !p)} className={QUIET}>
                {picking ? "Close" : "Pick"}
              </button>
            )}
          </div>
        )}
        {picking && (
          <div className="mt-4 space-y-3">
            {[...groups.entries()].map(([label, items]) => (
              <div key={label}>
                <p className="pb-1 text-xs font-bold uppercase tracking-wide text-accent">{label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {items.map((m) => {
                    const on = picked.has(m.key);
                    return (
                      <button
                        key={m.key}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setPicked((prev) => {
                            const next = new Set(prev);
                            if (on) next.delete(m.key);
                            else next.add(m.key);
                            return next;
                          })
                        }
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                          on ? "border-accent bg-accent/10 text-accent" : "border-hairline text-muted"
                        }`}
                      >
                        {m.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <button
              type="button"
              disabled={pending || picked.size === 0}
              onClick={() => apply([...picked])}
              className={BUTTON}
            >
              Add {picked.size}
            </button>
          </div>
        )}
      </Card>
    </section>
  );
}

const sizesText = (e: EquipmentItem) => e.sizes.join(", ");
const parseSizes = (s: string) =>
  s
    .split(/[,\s]+/)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);

/** The household's equipment, with weights or sizes on hand. */
export function HouseholdEquipment({ items }: { items: EquipmentItem[] }) {
  const [list, setList] = useState(items.map((e) => ({ ...e, text: sizesText(e) })));
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const change = (i: number, patch: Partial<(typeof list)[number]>) => {
    setSaved(false);
    setList((prev) => prev.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  };
  const save = () =>
    startTransition(async () => {
      const clean = await saveHouseholdEquipment(
        list.map(({ text, ...e }) => ({ ...e, sizes: parseSizes(text) })),
      );
      setList(clean.map((e) => ({ ...e, text: sizesText(e) })));
      setSaved(true);
    });

  return (
    <section>
      <SectionHeading>Equipment</SectionHeading>
      <Card className="divide-y divide-hairline">
        {list.map((e, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 p-3">
            <input
              type="checkbox"
              checked={e.have}
              aria-label={`Have ${e.label}`}
              onChange={(ev) => change(i, { have: ev.target.checked })}
              className="h-4 w-4 accent-accent"
            />
            <input
              value={e.label}
              aria-label="Equipment"
              onChange={(ev) => change(i, { label: ev.target.value })}
              className={`${FIELD} min-w-[9rem] flex-1`}
            />
            <input
              value={e.text}
              aria-label={`${e.label} sizes`}
              placeholder="Sizes"
              inputMode="decimal"
              onChange={(ev) => change(i, { text: ev.target.value })}
              className={`${FIELD} tabular min-w-[12rem] flex-1`}
            />
            <select
              value={e.unit}
              aria-label={`${e.label} unit`}
              onChange={(ev) => change(i, { unit: ev.target.value as EquipmentItem["unit"] })}
              className={FIELD}
            >
              <option value="lb">lb</option>
              <option value="kg">kg</option>
              <option value="in">in</option>
              <option value="">—</option>
            </select>
            <button
              type="button"
              aria-label={`Remove ${e.label}`}
              onClick={() => {
                setSaved(false);
                setList((prev) => prev.filter((_, j) => j !== i));
              }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-red-50 hover:text-red-700"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2 p-3">
          <button
            type="button"
            onClick={() => {
              setSaved(false);
              setList((prev) => [...prev, { key: "", label: "", have: true, sizes: [], unit: "lb", text: "" }]);
            }}
            className={QUIET}
          >
            <PlusIcon className="h-4 w-4" />
            Add equipment
          </button>
          <button type="button" disabled={pending} onClick={save} className={BUTTON}>
            Save
          </button>
          {saved && (
            <span className="text-xs text-muted" aria-live="polite">
              Saved
            </span>
          )}
        </div>
      </Card>
    </section>
  );
}
