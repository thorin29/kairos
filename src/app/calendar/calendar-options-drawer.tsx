"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  SlidersIcon,
  CheckIcon,
  PeopleIcon,
  SchoolIcon,
  PaletteIcon,
} from "@/components/icons";
import {
  CAL_VIEWS,
  CAL_VIEW_LABELS,
  type CalView,
  type OthersMode,
} from "@/lib/calendar/views";
import {
  setCalendarView,
  setCalendarPeople,
  setCalendarFamily,
  setCalendarSchoolWork,
  setCalendarSubs,
  setCalendarPersonalize,
  setCalendarOthersMode,
  setCalendarOthersColor,
  setCalendarNowColor,
  setCalendarHolidayColor,
  setCalendarKindColor,
} from "@/lib/actions/calendar-prefs";

type Person = { id: string; name: string; color: string };
type Sub = { id: string; name: string; ownerName: string | null; color: string };

const GREY = "#9ca3af";

export function CalendarOptionsDrawer({
  view,
  people,
  selectedPeople,
  showFamily,
  showSchoolWork,
  subscriptions,
  selectedSubs,
  personalizeColors,
  othersMode,
  othersColor,
  nowColor,
  nowSystem,
  holidayColor,
  holidaySystem,
  kindColors,
  meColor,
}: {
  view: CalView;
  people: Person[];
  selectedPeople: string[];
  showFamily: boolean;
  showSchoolWork: boolean;
  subscriptions: Sub[];
  selectedSubs: string[];
  personalizeColors: boolean;
  othersMode: OthersMode;
  othersColor: string | null;
  nowColor: string | null;
  nowSystem: string;
  holidayColor: string | null;
  holidaySystem: string;
  kindColors: Record<string, string>;
  meColor: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  const peopleSet = new Set(selectedPeople);
  const subsSet = new Set(selectedSubs);

  const chooseView = (v: CalView) => {
    // Persist the preference and reflect it now by clearing any transient
    // ?view drill-down and landing on the chosen view.
    start(() => setCalendarView(v));
    router.push(`/calendar?view=${v}`);
    setOpen(false);
  };

  const togglePerson = (id: string) => {
    const next = new Set(peopleSet);
    next.has(id) ? next.delete(id) : next.add(id);
    start(() =>
      setCalendarPeople(people.map((p) => p.id).filter((i) => next.has(i))),
    );
  };
  const toggleSub = (id: string) => {
    const next = new Set(subsSet);
    next.has(id) ? next.delete(id) : next.add(id);
    start(() =>
      setCalendarSubs(subscriptions.map((s) => s.id).filter((i) => next.has(i))),
    );
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Calendar options"
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-hairline text-ink transition-colors hover:border-accent hover:text-accent"
      >
        <SlidersIcon className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/40"
          />
          <div className="absolute right-0 top-0 flex h-full w-[19rem] max-w-[85vw] flex-col overflow-y-auto border-l border-hairline bg-ground shadow-xl">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="font-display text-lg font-semibold">Calendar</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-ink/10"
              >
                ✕
              </button>
            </div>

            <Section>
              <div className="grid grid-cols-2 gap-1.5">
                {CAL_VIEWS.map((v) => (
                  <Choice
                    key={v}
                    active={view === v}
                    onClick={() => chooseView(v)}
                    label={CAL_VIEW_LABELS[v]}
                  />
                ))}
              </div>
            </Section>

            <Section>
              {people.map((p) => (
                <Row
                  key={p.id}
                  checked={peopleSet.has(p.id)}
                  onClick={() => togglePerson(p.id)}
                  dot={p.color}
                  label={p.name}
                />
              ))}
              <Row
                checked={showFamily}
                onClick={() => start(() => setCalendarFamily(!showFamily))}
                icon={<PeopleIcon className="h-4 w-4" />}
                label="Family"
              />
              <Row
                checked={showSchoolWork}
                onClick={() =>
                  start(() => setCalendarSchoolWork(!showSchoolWork))
                }
                icon={<SchoolIcon className="h-4 w-4" />}
                label="School work"
              />
            </Section>

            {subscriptions.length > 0 && (
              <Section>
                {subscriptions.map((s) => (
                  <Row
                    key={s.id}
                    checked={subsSet.has(s.id)}
                    onClick={() => toggleSub(s.id)}
                    dot={s.color}
                    label={s.name}
                    sub={s.ownerName}
                  />
                ))}
              </Section>
            )}

            <Section>
              <Row
                checked={personalizeColors}
                onClick={() =>
                  start(() => setCalendarPersonalize(!personalizeColors))
                }
                icon={<PaletteIcon className="h-4 w-4" />}
                label="Personalise colours"
              />

              {personalizeColors && (
                <div className="mt-1.5 space-y-0.5">
                  <div className="grid grid-cols-3 gap-1.5 px-1 pb-1">
                    {(["own", "grey", "family"] as OthersMode[]).map((m) => (
                      <Choice
                        key={m}
                        active={othersMode === m}
                        onClick={() => start(() => setCalendarOthersMode(m))}
                        label={
                          m === "own" ? "Own" : m === "grey" ? "Grey" : "Family"
                        }
                      />
                    ))}
                  </div>

                  {othersMode === "grey" && (
                    <ColorField
                      label="Others"
                      value={othersColor}
                      fallback={GREY}
                      onPick={(c) => start(() => setCalendarOthersColor(c))}
                      onClear={() => start(() => setCalendarOthersColor(null))}
                    />
                  )}

                  {othersMode !== "family" && (
                    <>
                      <ColorField
                        label="Now line"
                        value={nowColor}
                        fallback={nowSystem}
                        onPick={(c) => start(() => setCalendarNowColor(c))}
                        onClear={() => start(() => setCalendarNowColor(null))}
                      />
                      {[
                        ["APPOINTMENT", "Appointments"],
                        ["CLASS", "Class"],
                        ["WORK", "Work"],
                        ["BIRTHDAY", "Birthdays"],
                      ].map(([k, label]) => (
                        <ColorField
                          key={k}
                          label={label}
                          value={kindColors[k] ?? null}
                          fallback={meColor}
                          onPick={(c) =>
                            start(() => setCalendarKindColor(k, c))
                          }
                          onClear={() =>
                            start(() => setCalendarKindColor(k, null))
                          }
                        />
                      ))}
                      <ColorField
                        label="Holidays"
                        value={holidayColor}
                        fallback={holidaySystem}
                        onPick={(c) => start(() => setCalendarHolidayColor(c))}
                        onClear={() => start(() => setCalendarHolidayColor(null))}
                      />
                    </>
                  )}
                </div>
              )}
            </Section>

            <div className="h-4" aria-hidden />
            {pending && (
              <span className="sr-only" role="status">
                Saving
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-t border-hairline px-3 py-3 first:border-t-0">
      {children}
    </div>
  );
}

function Choice({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-10 rounded-lg text-sm font-medium transition-colors ${
        active
          ? "bg-accent text-white"
          : "border border-hairline text-ink hover:border-accent"
      }`}
    >
      {label}
    </button>
  );
}

function ColorField({
  label,
  value,
  fallback,
  onPick,
  onClear,
}: {
  label: string;
  value: string | null;
  fallback: string;
  onPick: (color: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-2 py-1.5">
      <span className="text-sm">{label}</span>
      <span className="flex items-center gap-2">
        {value && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-muted hover:text-accent"
          >
            Auto
          </button>
        )}
        <label className="relative block h-6 w-6 cursor-pointer">
          <span
            className={`block h-6 w-6 rounded-full border ${
              value ? "border-hairline" : "border-dashed border-ink/30"
            }`}
            style={{ backgroundColor: value ?? fallback }}
          />
          <input
            type="color"
            value={value ?? fallback}
            onChange={(e) => onPick(e.target.value)}
            aria-label={label}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
      </span>
    </div>
  );
}

function Row({
  checked,
  onClick,
  label,
  sub,
  dot,
  icon,
}: {
  checked: boolean;
  onClick: () => void;
  label: string;
  sub?: string | null;
  dot?: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={checked}
      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-ink/5"
    >
      {dot ? (
        <span
          aria-hidden
          className="h-3.5 w-3.5 shrink-0 rounded-full"
          style={{ backgroundColor: dot }}
        />
      ) : (
        <span aria-hidden className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-muted">
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{label}</span>
        {sub && <span className="block truncate text-xs text-muted">{sub}</span>}
      </span>
      <span
        aria-hidden
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
          checked
            ? "border-accent bg-accent text-white"
            : "border-hairline text-transparent"
        }`}
      >
        <CheckIcon className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}
