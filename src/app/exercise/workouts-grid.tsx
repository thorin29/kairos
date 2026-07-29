"use client";

import { useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import { PersonAvatar } from "@/components/person-filter";
import {
  CheckIcon,
  CalendarPlusIcon,
  DumbbellIcon,
  MoonIcon,
} from "@/components/icons";
import { restDay } from "@/lib/actions/workouts";
import { PlanBuilder } from "./plan-builder";
import { WorkoutCard } from "./workout-card";
import type { PersonWorkout } from "@/lib/queries/workouts";
import type { UnitSystem } from "@/lib/workouts/catalog";

type Step = "menu" | "plan" | "log";

export function WorkoutsGrid({
  people,
  unitSystem,
  todayISO,
  todayDow,
}: {
  people: PersonWorkout[];
  unitSystem: UnitSystem;
  todayISO: string;
  todayDow: number;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("menu");
  // Which side of the screen the opened card was tapped on, so the pop-out
  // grows outward from roughly where it sat rather than always from centre.
  const [origin, setOrigin] = useState("center top");
  const [, startTransition] = useTransition();

  const openFrom = (id: string, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const mid = r.left + r.width / 2;
    const third = window.innerWidth / 3;
    const x = mid < third ? "left" : mid > third * 2 ? "right" : "center";
    setOrigin(`${x} top`);
    setOpenId(id);
    setStep("menu");
  };

  const open = people.find((p) => p.user.id === openId) ?? null;
  const hasPlan = open ? open.plan.some((d) => d.workouts.length > 0) : false;

  const close = () => setOpenId(null);
  const rest = () => {
    if (open) startTransition(() => restDay(open.user.id, todayISO));
    close();
  };

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {people.map((p) => {
          return (
            <button
              key={p.user.id}
              type="button"
              onClick={(e) => openFrom(p.user.id, e.currentTarget)}
              className="hover-bounce group flex flex-col rounded-xl border border-hairline bg-surface p-5 text-left outline-none transition-colors hover:border-accent"
            >
              <div className="flex items-start justify-between gap-3">
                <PersonAvatar
                  name={p.user.name}
                  color={p.user.color}
                  avatarPath={p.user.avatarPath}
                />
              </div>
              <div className="mt-2">
                <TileStatus person={p} />
              </div>
              {/* Preview of the actions — icons only and softly out of focus at
                  rest; they come sharp (and gain their labels) once the card is
                  tapped open. */}
              <div className="mt-4 flex gap-2" aria-hidden>
                <ActionChip icon={CalendarPlusIcon} />
                <ActionChip icon={DumbbellIcon} />
                <ActionChip icon={MoonIcon} />
              </div>
            </button>
          );
        })}
      </div>

      {open && (
        <div
          className="animate-backdrop-fade fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`${open.user.name}'s workouts`}
          onClick={close}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ transformOrigin: origin }}
            className="animate-card-zoom my-4 w-full max-w-xl"
          >
            <div className="rounded-2xl border border-hairline bg-surface p-6 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar
                    name={open.user.name}
                    color={open.user.color}
                    avatarPath={open.user.avatarPath}
                    size="md"
                  />
                  <p className="font-display text-xl font-semibold">
                    {open.user.name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-black/5 hover:text-ink"
                >
                  ✕
                </button>
              </div>

              {step === "menu" && (
                <div className="mt-5 space-y-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted">
                      Today
                    </p>
                    {open.today.rested ? (
                      <p className="mt-1 text-lg font-semibold">Rest day taken</p>
                    ) : open.today.workedOut ? (
                      <p className="mt-1 text-lg font-semibold text-accent">
                        Worked out
                      </p>
                    ) : open.todayPlanned.length > 0 ? (
                      <p className="mt-1 flex flex-wrap gap-1.5">
                        {open.todayPlanned.map((w) => (
                          <span
                            key={w.id}
                            className="rounded-full bg-ground px-3 py-1 text-sm font-medium"
                          >
                            {w.name}
                          </span>
                        ))}
                      </p>
                    ) : hasPlan ? (
                      <p className="mt-1 text-lg font-semibold">Rest day</p>
                    ) : (
                      <p className="mt-1 text-sm text-muted">No plan yet.</p>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <ActionButton
                      icon={CalendarPlusIcon}
                      label={hasPlan ? "Edit plan" : "Create plan"}
                      onClick={() => setStep("plan")}
                      primary={!hasPlan}
                    />
                    <ActionButton
                      icon={DumbbellIcon}
                      label="Log workout"
                      onClick={() => setStep("log")}
                      primary={hasPlan}
                    />
                    <ActionButton
                      icon={MoonIcon}
                      label="Rest / skip"
                      onClick={rest}
                    />
                  </div>
                </div>
              )}

              {step === "plan" && (
                <div className="mt-4">
                  <BackLink onClick={() => setStep("menu")} />
                  <h3 className="mb-3 font-display text-lg font-semibold">
                    Workout plan
                  </h3>
                  <PlanBuilder
                    userId={open.user.id}
                    plan={open.plan}
                    todayDow={todayDow}
                  />
                </div>
              )}

              {step === "log" && (
                <div className="mt-4">
                  <BackLink onClick={() => setStep("menu")} />
                  <WorkoutCard
                    person={open}
                    unitSystem={unitSystem}
                    todayISO={todayISO}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function TileStatus({ person }: { person: PersonWorkout }) {
  if (person.today.rested) {
    return <span className="text-xs text-muted">Rest day taken</span>;
  }
  if (person.today.workedOut) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
        <CheckIcon className="h-3.5 w-3.5" />
        Worked out today
      </span>
    );
  }
  if (person.todayPlanned.length > 0) {
    return (
      <span className="flex flex-wrap gap-1">
        {person.todayPlanned.map((w) => (
          <span
            key={w.id}
            className="rounded-full bg-ground px-2.5 py-0.5 text-xs font-medium"
          >
            {w.name}
          </span>
        ))}
      </span>
    );
  }
  const hasPlan = person.plan.some((d) => d.workouts.length > 0);
  return (
    <span className="text-xs text-muted">
      {hasPlan ? "Rest day" : "No plan yet"}
    </span>
  );
}

type IconType = ({ className }: { className?: string }) => React.ReactElement;

// Decorative on the card (not clickable until the card is opened). Icons only,
// held a touch out of focus at rest so the tap-to-open zoom reads as pulling
// them sharp; they crisp up on hover as a "you can open this" cue.
function ActionChip({ icon: Icon }: { icon: IconType }) {
  return (
    <span className="flex flex-1 items-center justify-center rounded-xl border border-hairline/70 py-2.5 text-muted opacity-60 blur-[1px] transition duration-200 group-hover:opacity-100 group-hover:blur-0">
      <Icon className="h-5 w-5" />
    </span>
  );
}

// Clickable in the opened (larger) card.
function ActionButton({
  icon: Icon,
  label,
  onClick,
  primary,
}: {
  icon: IconType;
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center text-xs font-semibold transition-colors ${
        primary
          ? "border-accent bg-accent/10 text-accent"
          : "border-hairline text-ink hover:border-accent hover:text-accent"
      }`}
    >
      <Icon className="h-6 w-6" />
      {label}
    </button>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-3 text-sm font-medium text-accent hover:underline"
    >
      &lsaquo; Back
    </button>
  );
}
