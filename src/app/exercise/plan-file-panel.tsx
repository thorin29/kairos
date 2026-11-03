"use client";

import { PRIMARY_BTN, SECONDARY_BTN, SECONDARY_LG } from "./buttons";
import { useRef, useState, useTransition } from "react";
import {
  exportMyWorkouts,
  importWorkouts,
  loadHouseholdPlans,
  previewHouseholdPlan,
  previewWorkoutsImport,
  shareMyPlan,
  useHouseholdPlan,
  withdrawSharedPlan,
} from "@/lib/actions/workouts";
import { fileNameFor } from "@/lib/workouts/plan-file";
import { PlanLibrary } from "./my-plans";
import { BookmarkIcon, DownloadIcon, ShareIcon, UploadIcon } from "@/components/icons";
import type { ImportPreview, SharedPlanRow } from "@/lib/workouts/plan-share-run";

const PRIMARY = PRIMARY_BTN;
const QUIET = SECONDARY_BTN;

export function Modal({ title, onClose, onBack, children }: { title: string; onClose: () => void; onBack?: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl bg-surface shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-hairline px-4 py-3">
          {onBack && (
            <button
              type="button"
              aria-label="Back"
              onClick={onBack}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-ground hover:text-ink"
            >
              ‹
            </button>
          )}
          <h3 className="min-w-0 flex-1 truncate text-base font-semibold">{title}</h3>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-ground hover:text-ink"
          >
            ✕
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </div>
  );
}

/** What bringing a plan in would do, and Replace / Add. */
export function ImportChoice({
  preview,
  busy,
  error,
  onPick,
}: {
  preview: ImportPreview;
  busy: boolean;
  error: string;
  onPick: (how: "replace" | "add") => void;
}) {
  const adds = [
    preview.newMovements.length ? `${preview.newMovements.length} new ${preview.newMovements.length === 1 ? "movement" : "movements"}` : null,
    preview.newWorkouts.length ? `${preview.newWorkouts.length} new ${preview.newWorkouts.length === 1 ? "workout" : "workouts"}` : null,
  ].filter(Boolean);
  return (
    <>
      <div className="space-y-1">
        {preview.summary ? <p className="text-sm">{preview.summary}</p> : <p className="text-sm text-muted">No plan, workouts only.</p>}
        {adds.length > 0 && <p className="text-xs text-muted">Adds {adds.join(" and ")} of your own.</p>}
        {preview.newWorkouts.length > 0 && <p className="text-xs text-muted">{preview.newWorkouts.join(", ")}</p>}
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {preview.entries > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (confirm("Replace your whole weekly plan with this one? A running program ends.")) onPick("replace");
            }}
            className={`${PRIMARY} flex-1`}
          >
            Replace my plan
          </button>
        )}
        <button type="button" disabled={busy} onClick={() => onPick("add")} className={QUIET}>
          {preview.entries > 0 ? "Add to my plan" : "Add the workouts"}
        </button>
      </div>
    </>
  );
}

type Open = "menu" | "export" | "import" | "share" | "plans" | "mine" | null;

/**
 * Export, Import, Share this plan and Household plans (v0.618), each in its
 * own window.
 */
export function PlanFilePanel({ userId }: { userId: string }) {
  const [open, setOpen] = useState<Open>(null);
  const [history, setHistory] = useState(false);
  const [busy, start] = useTransition();
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [text, setText] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [name, setName] = useState("");
  const [plans, setPlans] = useState<SharedPlanRow[] | null>(null);
  const [picked, setPicked] = useState<SharedPlanRow | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const close = () => {
    setOpen(null);
    setError("");
    setDone("");
    setText(null);
    setPreview(null);
    setPicked(null);
  };
  const show = (o: Open) => {
    close();
    setOpen(o);
    if (o === "plans") {
      setPlans(null);
      loadHouseholdPlans(userId)
        .then(setPlans)
        .catch(() => setError("Couldn't load the plans. Try again."));
    }
  };
  const added = (a: { plans: number; movements: number; workouts: number }) =>
    [
      `Done. ${a.plans} added to your plan`,
      a.workouts ? `${a.workouts} new ${a.workouts === 1 ? "workout" : "workouts"}` : null,
      a.movements ? `${a.movements} new ${a.movements === 1 ? "movement" : "movements"}` : null,
    ]
      .filter(Boolean)
      .join(" · ") + ".";

  const download = () =>
    start(async () => {
      try {
        const file = await exportMyWorkouts(userId, history);
        const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileNameFor(new Date().toLocaleDateString("en-CA"));
        a.click();
        URL.revokeObjectURL(url);
        close();
      } catch {
        setError("Couldn't make the file. Try again.");
      }
    });

  const readFile = (f: File | undefined) => {
    if (!f) return;
    setError("");
    f.text()
      .then((t) =>
        start(async () => {
          const r = await previewWorkoutsImport(userId, t);
          if (!r.ok) {
            setError(r.error);
            return;
          }
          setText(t);
          setPreview(r.preview);
        }),
      )
      .catch(() => setError("Couldn't read that file."));
  };

  return (
    <div>
      {/* One button at the foot of the plan (v0.624): save, share, export and
          import in a window. Opening a saved or household plan is with the
          programs (Start / Change program). */}
      <button
        type="button"
        onClick={() => show("menu")}
        className={`${SECONDARY_LG} w-full`}
      >
        <ShareIcon className="h-4 w-4" />
        Save, share or export
      </button>

      {open === "menu" && (
        <Modal title="This plan" onClose={close}>
          <div className="space-y-2">
            {(
              [
                ["mine", BookmarkIcon, "Save to My plans"],
                ["share", ShareIcon, "Share with the household"],
                ["export", DownloadIcon, "Export a file"],
                ["import", UploadIcon, "Import a file"],
              ] as const
            ).map(([k, Icon, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => show(k)}
                className="flex w-full items-center gap-3 rounded-xl border border-hairline px-4 py-3 text-left text-sm font-semibold hover:border-accent"
              >
                <Icon className="h-5 w-5 text-accent" />
                {label}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {open === "export" && (
        <Modal title="Export" onClose={close}>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={history} onChange={(e) => setHistory(e.target.checked)} />
            Include everything I&rsquo;ve logged
          </label>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button type="button" disabled={busy} onClick={download} className={PRIMARY}>
            {busy ? "Making the file…" : "Download"}
          </button>
        </Modal>
      )}

      {open === "import" && (
        <Modal title="Import" onClose={close}>
          {done ? (
            <p className="text-sm" aria-live="polite">
              {done}
            </p>
          ) : preview && text ? (
            <ImportChoice
              preview={preview}
              busy={busy}
              error={error}
              onPick={(how) =>
                start(async () => {
                  const r = await importWorkouts(userId, text, how);
                  if (!r.ok) setError(r.error);
                  else setDone(added(r.added));
                })
              }
            />
          ) : (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => readFile(e.target.files?.[0])}
              />
              {error && <p className="text-sm text-red-700">{error}</p>}
              <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className={PRIMARY}>
                {busy ? "Reading…" : "Choose a file"}
              </button>
            </>
          )}
        </Modal>
      )}

      {open === "share" && (
        <Modal title="Share this plan" onClose={close}>
          {done ? (
            <p className="text-sm" aria-live="polite">
              {done}
            </p>
          ) : (
            <>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted">Name</span>
                <input
                  autoFocus
                  value={name}
                  maxLength={60}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Three-day strength"
                  className="h-11 w-full rounded-xl border border-hairline bg-surface px-3 text-sm outline-none focus:border-accent"
                />
              </label>
              {error && <p className="text-sm text-red-700">{error}</p>}
              <button
                type="button"
                disabled={busy || name.trim().length < 2}
                onClick={() =>
                  start(async () => {
                    const r = await shareMyPlan(userId, name);
                    if (!r.ok) setError(r.error);
                    else {
                      setDone(r.status === "APPROVED" ? "Shared with the household." : "Sent to a parent to approve.");
                      setName("");
                    }
                  })
                }
                className={PRIMARY}
              >
                Share
              </button>
            </>
          )}
        </Modal>
      )}

      {open === "mine" && (
        <Modal title="My plans" onClose={close}>
          <PlanLibrary userId={userId} kind="mine" onUsed={close} />
        </Modal>
      )}

      {open === "plans" && (
        <Modal
          title={picked ? picked.name : "Household plans"}
          onClose={close}
          onBack={
            picked
              ? () => {
                  setPicked(null);
                  setPreview(null);
                  setDone("");
                  setError("");
                }
              : undefined
          }
        >
          {picked ? (
            done ? (
              <p className="text-sm" aria-live="polite">
                {done}
              </p>
            ) : preview ? (
              <ImportChoice
                preview={preview}
                busy={busy}
                error={error}
                onPick={(how) =>
                  start(async () => {
                    const r = await useHouseholdPlan(userId, picked.id, how);
                    if (!r.ok) setError(r.error);
                    else setDone(added(r.added));
                  })
                }
              />
            ) : (
              <p className="text-sm text-muted">{error || "Loading…"}</p>
            )
          ) : !plans ? (
            <p className="text-sm text-muted">{error || "Loading…"}</p>
          ) : plans.length === 0 ? (
            <p className="rounded-xl bg-ground/50 p-3 text-sm text-muted">No household plans yet.</p>
          ) : (
            <div className="space-y-2">
              {plans.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-xl border border-hairline px-4 py-3">
                  <button
                    type="button"
                    disabled={p.status !== "APPROVED"}
                    onClick={() => {
                      setPicked(p);
                      setPreview(null);
                      start(async () => {
                        const r = await previewHouseholdPlan(userId, p.id);
                        if (!r.ok) setError(r.error);
                        else setPreview(r.preview);
                      });
                    }}
                    className="min-w-0 flex-1 text-left disabled:cursor-default"
                  >
                    <span className="block truncate text-sm font-semibold">{p.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {[p.by, p.summary].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                  {p.status === "PENDING" && (
                    <>
                      <span className="text-xs text-muted">Waiting</span>
                      <button
                        type="button"
                        onClick={() =>
                          start(async () => {
                            await withdrawSharedPlan(userId, p.id);
                            setPlans((cur) => (cur ?? []).filter((x) => x.id !== p.id));
                          })
                        }
                        className="text-xs font-semibold text-accent hover:underline"
                      >
                        Withdraw
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
