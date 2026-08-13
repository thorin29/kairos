"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  approveMoneyEntry,
  unapproveMoneyEntry,
  approveAllMoney,
  updateMoneyEntry,
  deleteMoneyEntry,
  type MoneyActionState,
} from "@/lib/actions/money";
import {
  DEPOSIT_CATEGORIES,
  categoryLabel,
  formatCents,
  rowLabel,
  signedCents,
} from "@/lib/money";
import { formatShort } from "@/lib/dates";
import { CheckIcon, PencilIcon, TrashIcon } from "@/components/icons";
import type { AdminMoneyRow } from "@/lib/queries/money";

const initial: MoneyActionState = { error: null };
const FIELD =
  "mt-1.5 w-full rounded-md border border-hairline bg-surface px-3 py-2 text-sm outline-none focus:border-accent";
const LABEL = "block text-sm font-medium";

function Amount({ row }: { row: AdminMoneyRow }) {
  const signed = signedCents(row);
  const out = signed < 0;
  return (
    <span
      className={`tabular font-medium ${out ? "text-red-600" : "text-green-700"}`}
    >
      {out ? "-" : ""}
      {formatCents(row.amountCents)}
    </span>
  );
}

export function AdminMoney({
  pending,
  all,
}: {
  pending: AdminMoneyRow[];
  all: AdminMoneyRow[];
  people: { id: string; name: string }[];
}) {
  const [busy, start] = useTransition();
  const [editing, setEditing] = useState<AdminMoneyRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  return (
    <div className="space-y-10">
      {/* Approval queue */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">
            Awaiting approval
            {pending.length > 0 && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                {pending.length}
              </span>
            )}
          </h2>
          {pending.length > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => start(() => void approveAllMoney())}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-50"
            >
              Approve all
            </button>
          )}
        </div>

        {pending.length === 0 ? (
          <p className="rounded-lg border border-hairline bg-surface px-4 py-6 text-center text-sm text-muted">
            Nothing waiting.
          </p>
        ) : (
          <ul className="space-y-2">
            {pending.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-lg border border-hairline bg-surface px-4 py-3"
              >
                <span className="w-20 shrink-0 text-sm font-medium">
                  {r.userName}
                </span>
                <span className="tabular w-14 shrink-0 text-sm text-muted">
                  {formatShort(r.date)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm" title={rowLabel(r)}>
                  {rowLabel(r)}
                </span>
                <span className="w-20 shrink-0 text-right">
                  <Amount row={r} />
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => start(() => void approveMoneyEntry(r.id))}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md bg-green-600 px-2.5 py-1.5 text-xs font-medium text-white transition-all hover:brightness-110 disabled:opacity-50"
                >
                  <CheckIcon className="h-3.5 w-3.5" />
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(r)}
                  className="shrink-0 rounded-md border border-hairline p-1.5 text-muted hover:text-accent"
                  aria-label="Edit"
                >
                  <PencilIcon className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Full ledger */}
      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">All transactions</h2>
        <div className="overflow-hidden rounded-xl border border-hairline">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline bg-ground/50 text-left text-xs font-medium uppercase tracking-wide text-muted">
                <th className="px-3 py-2.5 font-medium">Who</th>
                <th className="px-3 py-2.5 font-medium">Date</th>
                <th className="px-3 py-2.5 font-medium">Category / details</th>
                <th className="px-3 py-2.5 text-right font-medium">Amount</th>
                <th className="px-3 py-2.5 text-center font-medium">Status</th>
                <th className="px-3 py-2.5 text-right font-medium">Edit</th>
              </tr>
            </thead>
            <tbody>
              {all.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted">
                    No transactions yet.
                  </td>
                </tr>
              ) : (
                all.map((r) => (
                  <tr key={r.id} className="border-b border-hairline last:border-0">
                    <td className="px-3 py-2.5 font-medium">{r.userName}</td>
                    <td className="tabular whitespace-nowrap px-3 py-2.5 text-muted">
                      {formatShort(r.date)}
                    </td>
                    <td className="max-w-[16rem] truncate px-3 py-2.5" title={rowLabel(r)}>
                      {rowLabel(r)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      <Amount row={r} />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {r.status === "APPROVED" ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => start(() => void unapproveMoneyEntry(r.id))}
                          title="Approved — click to undo"
                          className="inline-flex items-center gap-1 text-xs font-medium text-green-700 disabled:opacity-50"
                        >
                          <CheckIcon className="h-3.5 w-3.5" />
                          Approved
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => start(() => void approveMoneyEntry(r.id))}
                          className="rounded-md border border-hairline px-2 py-1 text-xs font-medium text-amber-700 hover:border-accent disabled:opacity-50"
                        >
                          Pending
                        </button>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => setEditing(r)}
                        className="rounded-md border border-hairline p-1.5 text-muted hover:text-accent"
                        aria-label="Edit"
                      >
                        <PencilIcon className="h-3.5 w-3.5" />
                      </button>
                      {confirmDelete === r.id ? (
                        <span className="ml-1 inline-flex items-center gap-1">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              start(() => {
                                setConfirmDelete(null);
                                void deleteMoneyEntry(r.id);
                              })
                            }
                            className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(null)}
                            className="rounded-md border border-hairline px-2 py-1 text-xs text-muted"
                          >
                            No
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(r.id)}
                          className="ml-1 rounded-md border border-hairline p-1.5 text-muted hover:text-red-600"
                          aria-label="Delete"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editing && (
        <EditModal row={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function EditModal({
  row,
  onClose,
}: {
  row: AdminMoneyRow;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(updateMoneyEntry, initial);
  const [direction, setDirection] = useState<"DEPOSIT" | "PAYMENT">(
    row.direction,
  );
  const done = useRef(false);

  useEffect(() => {
    if (!pending && state.ok && !done.current) {
      done.current = true;
      onClose();
    }
  }, [pending, state, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-hairline bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold">
            Edit — {row.userName}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-muted hover:text-foreground"
          >
            Cancel
          </button>
        </div>

        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={row.id} />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="e-date" className={LABEL}>
                Date
              </label>
              <input
                id="e-date"
                type="date"
                name="date"
                defaultValue={row.date}
                className={FIELD}
              />
            </div>
            <div>
              <label htmlFor="e-dir" className={LABEL}>
                Type
              </label>
              <select
                id="e-dir"
                name="direction"
                value={direction}
                onChange={(e) =>
                  setDirection(e.target.value as "DEPOSIT" | "PAYMENT")
                }
                className={FIELD}
              >
                <option value="DEPOSIT">Deposit</option>
                <option value="PAYMENT">Payment</option>
              </select>
            </div>
          </div>

          {direction === "DEPOSIT" && (
            <div>
              <label htmlFor="e-cat" className={LABEL}>
                Category
              </label>
              <select
                id="e-cat"
                name="category"
                defaultValue={row.category ?? ""}
                className={FIELD}
              >
                <option value="" disabled>
                  Choose a category
                </option>
                {DEPOSIT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {categoryLabel(c)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="e-detail" className={LABEL}>
              Details
            </label>
            <input
              id="e-detail"
              name="detail"
              maxLength={200}
              defaultValue={row.detail ?? ""}
              className={FIELD}
            />
          </div>

          <div>
            <label htmlFor="e-amount" className={LABEL}>
              Amount (USD)
            </label>
            <input
              id="e-amount"
              name="amount"
              inputMode="decimal"
              defaultValue={(row.amountCents / 100).toFixed(2)}
              className={FIELD}
            />
          </div>

          {state.error && <p className="text-sm text-red-600">{state.error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-50"
          >
            {pending ? "Saving\u2026" : "Save changes"}
          </button>
        </form>
      </div>
    </div>
  );
}
