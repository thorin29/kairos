"use client";

import { useState, useTransition } from "react";
import { CheckIcon } from "@/components/icons";
import { answerClassPrompt } from "@/lib/actions/school";
import { SCHOOL_TYPES, SCHOOL_TYPE_LABEL } from "@/lib/school";

export type ClassPromptItem = {
  classId: string;
  userId: string;
  className: string;
  dateISO: string;
};

/**
 * "After class" prompts on a student's card: for each class meeting that's
 * ended, ask whether they attended and whether work was assigned. Attendance
 * and work are asked independently. Answering records it and clears the prompt;
 * any work becomes a school item linked to the class.
 */
export function ClassPrompts({
  prompts,
  today,
}: {
  prompts: ClassPromptItem[];
  today: string;
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const visible = prompts.filter(
    (p) => !hidden.has(`${p.classId}|${p.userId}|${p.dateISO}`),
  );
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      {visible.map((p) => (
        <PromptCard
          key={`${p.classId}|${p.userId}|${p.dateISO}`}
          prompt={p}
          today={today}
          onDone={() =>
            setHidden((s) =>
              new Set(s).add(`${p.classId}|${p.userId}|${p.dateISO}`),
            )
          }
        />
      ))}
    </div>
  );
}

const INPUT =
  "w-full rounded-md border border-hairline bg-surface px-2 py-1 text-xs outline-none focus:border-accent";

function PromptCard({
  prompt,
  today,
  onDone,
}: {
  prompt: ClassPromptItem;
  today: string;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [attended, setAttended] = useState<boolean | null>(null);
  const [hasWork, setHasWork] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("HOMEWORK");
  const [due, setDue] = useState(today);

  const workReady = !hasWork || (title.trim().length >= 2 && !!due);
  const canSubmit = attended !== null && workReady && !pending;

  const submit = () => {
    if (attended === null) return;
    start(async () => {
      onDone();
      await answerClassPrompt({
        classId: prompt.classId,
        userId: prompt.userId,
        dateISO: prompt.dateISO,
        attended,
        work: hasWork
          ? { title: title.trim(), type, dueDate: due }
          : null,
      });
    });
  };

  const pill = (on: boolean) =>
    `inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-full text-xs font-medium transition-all ${
      on
        ? "bg-accent text-white"
        : "bg-ink/5 text-muted hover:bg-ink/10 hover:text-ink"
    }`;

  return (
    <div className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-2">
      <p className="mb-2 text-xs font-medium">After {prompt.className}</p>

      <p className="mb-1 text-[0.7rem] text-muted">Did you attend?</p>
      <div className="mb-2 flex gap-2">
        <button
          type="button"
          onClick={() => setAttended(true)}
          className={pill(attended === true)}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => setAttended(false)}
          className={pill(attended === false)}
        >
          No
        </button>
      </div>

      <label className="mb-2 flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={hasWork}
          onChange={(e) => setHasWork(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-hairline accent-accent"
        />
        Work was assigned
      </label>

      {hasWork && (
        <div className="mb-2 space-y-1.5">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 120))}
            placeholder="What's the assignment?"
            className={INPUT}
          />
          <div className="flex gap-1.5">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className={INPUT}
            >
              {SCHOOL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {SCHOOL_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className={`tabular ${INPUT}`}
              aria-label="Due date"
            />
          </div>
        </div>
      )}

      <button
        type="button"
        disabled={!canSubmit}
        onClick={submit}
        className="inline-flex h-8 w-full items-center justify-center gap-1 rounded-full bg-accent text-xs font-medium text-white transition-all hover:brightness-110 disabled:opacity-40"
      >
        <CheckIcon className="h-3.5 w-3.5" />
        Done
      </button>
    </div>
  );
}
