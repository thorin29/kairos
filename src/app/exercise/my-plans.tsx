"use client";

import { useEffect, useState, useTransition } from "react";
import {
  deleteMyPlan,
  loadHouseholdPlans,
  loadMyPlans,
  previewHouseholdPlan,
  renameMyPlan,
  saveMyPlan,
  useHouseholdPlan,
} from "@/lib/actions/workouts";
import { PencilIcon, TrashIcon } from "@/components/icons";
import type { ImportPreview, SavedPlanRow } from "@/lib/workouts/plan-share-run";
import { ImportChoice } from "./plan-file-panel";

const FIELD =
  "h-10 min-w-0 flex-1 rounded-lg border border-hairline bg-surface px-3 text-sm outline-none focus:border-accent";
const PRIMARY =
  "inline-flex h-10 items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-on-accent disabled:opacity-40";

type Row = { id: string; name: string; sub: string };

/**
 * My plans (saved for later, only yours) or the household's approved plans
 * (v0.620): a list, and picking one shows what it holds with Replace / Add.
 * My plans also saves the current plan, and renames or deletes a saved one.
 */
export function PlanLibrary({
  userId,
  kind,
  onUsed,
}: {
  userId: string;
  kind: "mine" | "household";
  onUsed: () => void;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [picked, setPicked] = useState<Row | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [rename, setRename] = useState("");
  const [busy, start] = useTransition();

  const load = () => {
    setError("");
    if (kind === "mine") {
      loadMyPlans(userId)
        .then((p: SavedPlanRow[]) => setRows(p.map((x) => ({ id: x.id, name: x.name, sub: x.summary }))))
        .catch(() => setError("Couldn't load your plans. Try again."));
    } else {
      loadHouseholdPlans(userId)
        .then((p) =>
          setRows(
            p
              .filter((x) => x.status === "APPROVED")
              .map((x) => ({ id: x.id, name: x.name, sub: [x.by, x.summary].filter(Boolean).join(" · ") })),
          ),
        )
        .catch(() => setError("Couldn't load the plans. Try again."));
    }
  };
  useEffect(load, [userId, kind]); // eslint-disable-line react-hooks/exhaustive-deps

  if (picked) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Back"
            onClick={() => {
              setPicked(null);
              setPreview(null);
              setError("");
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-ground hover:text-ink"
          >
            ‹
          </button>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold">{picked.name}</p>
        </div>
        {preview ? (
          <ImportChoice
            preview={preview}
            busy={busy}
            error={error}
            onPick={(how) =>
              start(async () => {
                const r = await useHouseholdPlan(userId, picked.id, how);
                if (!r.ok) setError(r.error);
                else onUsed();
              })
            }
          />
        ) : (
          <p className="text-sm text-muted">{error || "Loading…"}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {kind === "mine" && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await saveMyPlan(userId, name);
              if (!r.ok) setError(r.error);
              else {
                setName("");
                load();
              }
            });
          }}
        >
          <input
            aria-label="Name for this plan"
            placeholder="Name this plan"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            className={FIELD}
          />
          <button type="submit" disabled={busy || name.trim().length < 2} className={PRIMARY}>
            Save
          </button>
        </form>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
      {!rows ? (
        !error && <p className="text-sm text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl bg-ground/50 p-3 text-sm text-muted">
          {kind === "mine" ? "No saved plans yet." : "No household plans yet."}
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((p) =>
            renaming === p.id ? (
              <form
                key={p.id}
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  start(async () => {
                    const r = await renameMyPlan(userId, p.id, rename);
                    if (!r.ok) setError(r.error);
                    else {
                      setRenaming(null);
                      load();
                    }
                  });
                }}
              >
                <input
                  aria-label="Plan name"
                  value={rename}
                  maxLength={60}
                  autoFocus
                  onChange={(e) => setRename(e.target.value)}
                  className={FIELD}
                />
                <button type="submit" disabled={busy || rename.trim().length < 2} className={PRIMARY}>
                  Save
                </button>
              </form>
            ) : (
              <div key={p.id} className="flex items-center gap-1 rounded-xl border border-hairline py-1 pl-4 pr-1">
                <button
                  type="button"
                  onClick={() => {
                    setPicked(p);
                    setPreview(null);
                    start(async () => {
                      const r = await previewHouseholdPlan(userId, p.id);
                      if (!r.ok) setError(r.error);
                      else setPreview(r.preview);
                    });
                  }}
                  className="min-w-0 flex-1 py-2 text-left"
                >
                  <span className="block truncate text-sm font-semibold">{p.name}</span>
                  {p.sub && <span className="block truncate text-xs text-muted">{p.sub}</span>}
                </button>
                {kind === "mine" && (
                  <>
                    <button
                      type="button"
                      aria-label={`Rename ${p.name}`}
                      onClick={() => {
                        setRenaming(p.id);
                        setRename(p.name);
                      }}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-ground hover:text-ink"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${p.name}`}
                      onClick={() => {
                        if (!confirm(`Delete ${p.name}?`)) return;
                        start(async () => {
                          await deleteMyPlan(userId, p.id);
                          load();
                        });
                      }}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-ground hover:text-red-700"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
