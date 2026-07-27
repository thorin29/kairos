"use client";

import { useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import { PersonAvatar } from "@/components/person-filter";
import { CheckIcon } from "@/components/icons";
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
  const [, startTransition] = useTransition();

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
        {people.map((p) => (
          <button
            key={p.user.id}
            type="button"
            onClick={() => {
              setOpenId(p.user.id);
              setStep("menu");
            }}
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
          </button>
        ))}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`${open.user.name}'s workouts`}
          onClick={close}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="my-4 w-full max-w-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar
                  name={open.user.name}
                  color={open.user.color}
                  avatarPath={open.user.avatarPath}
                  size="md"
                />
                <p className="font-display text-xl font-semibold text-white drop-shadow">
                  {open.user.name}
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-muted shadow hover:text-accent"
              >
                ✕
              </button>
            </div>

            {step === "menu" && (
              <div className="space-y-4 rounded-2xl border border-hairline bg-surface p-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted">
                    Today
                  </p>
                  {open.today.rested ? (
                    <p className="mt-1 text-lg font-semibold">Rest day taken</p>
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

                <div className="grid gap-2">
                  {hasPlan ? (
                    <>
                      <MenuButton primary onClick={() => setStep("log")}>
                        Log today&rsquo;s plan
                      </MenuButton>
                      <MenuButton onClick={() => setStep("log")}>
                        Log a different workout
                      </MenuButton>
                      <MenuButton onClick={rest}>Rest / skip today</MenuButton>
                      <button
                        type="button"
                        onClick={() => setStep("plan")}
                        className="mt-1 text-sm font-medium text-accent hover:underline"
                      >
                        Edit weekly plan
                      </button>
                    </>
                  ) : (
                    <>
                      <MenuButton primary onClick={() => setStep("plan")}>
                        Create workout plan
                      </MenuButton>
                      <MenuButton onClick={() => setStep("log")}>
                        Log a workout now
                      </MenuButton>
                      <MenuButton onClick={rest}>Rest / skip today</MenuButton>
                    </>
                  )}
                </div>
              </div>
            )}

            {step === "plan" && (
              <div className="rounded-2xl border border-hairline bg-surface p-6">
                <button
                  type="button"
                  onClick={() => setStep("menu")}
                  className="mb-3 text-sm font-medium text-accent hover:underline"
                >
                  ‹ Back
                </button>
                <h3 className="mb-3 font-display text-lg font-semibold">Workout plan</h3>
                <PlanBuilder userId={open.user.id} plan={open.plan} todayDow={todayDow} />
              </div>
            )}

            {step === "log" && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setStep("menu")}
                  className="text-sm font-medium text-white drop-shadow hover:underline"
                >
                  ‹ Back
                </button>
                <WorkoutCard person={open} unitSystem={unitSystem} todayISO={todayISO} />
              </div>
            )}
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
          <span key={w.id} className="rounded-full bg-ground px-2.5 py-0.5 text-xs font-medium">
            {w.name}
          </span>
        ))}
      </span>
    );
  }
  const hasPlan = person.plan.some((d) => d.workouts.length > 0);
  return (
    <span className="text-xs text-muted">{hasPlan ? "Rest day" : "No plan yet"}</span>
  );
}

function MenuButton({
  children,
  onClick,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-12 items-center justify-center rounded-full px-5 text-sm font-semibold transition-all ${
        primary
          ? "bg-accent text-white shadow-sm hover:shadow-md"
          : "border border-hairline text-ink hover:border-accent hover:text-accent"
      }`}
    >
      {children}
    </button>
  );
}
