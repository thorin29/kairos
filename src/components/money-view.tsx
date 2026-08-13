"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import {
  addMoneyEntry,
  setStartingFunds,
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
import { PlusIcon, CheckIcon, DollarIcon } from "@/components/icons";
import type { MoneyRow } from "@/lib/queries/money";

const initial: MoneyActionState = { error: null };

const FIELD =
  "mt-1.5 w-full rounded-md border border-hairline bg-surface px-3 py-2 text-sm outline-none focus:border-accent";
const LABEL = "block text-sm font-medium";

export function MoneyView({
  roster,
  selectedId,
  selectedName,
  today,
  rows,
  hasStarting,
  emptyMode = false,
}: {
  roster: { id: string; name: string }[];
  selectedId: string | null;
  selectedName: string | null;
  balanceCents?: number;
  today: string;
  rows: MoneyRow[];
  hasStarting: boolean;
  emptyMode?: boolean;
}) {
  const [overlay, setOverlay] = useState<null | "add" | "start">(null);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = [
        formatShort(r.date),
        rowLabel(r),
        categoryLabel(r.category),
        r.detail ?? "",
        formatCents(r.amountCents),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query]);

  return (
    <div>
      {/* Action bar */}
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOverlay("add")}
          disabled={roster.length === 0}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-50"
        >
          <PlusIcon className="h-4 w-4" />
          Add transaction
        </button>

        {(emptyMode || (selectedId && !hasStarting)) && (
          <button
            type="button"
            onClick={() => setOverlay("start")}
            className="inline-flex items-center gap-1.5 rounded-md border border-hairline px-3 py-2 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent"
          >
            <DollarIcon className="h-4 w-4" />
            Set starting funds
          </button>
        )}

        {!emptyMode && (
          <div className="ml-auto flex items-center gap-2">
            {searching && (
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search categories, notes, amounts"
                className="w-56 rounded-md border border-hairline bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent"
              />
            )}
            <button
              type="button"
              aria-label="Search transactions"
              onClick={() => {
                if (searching) setQuery("");
                setSearching((s) => !s);
              }}
              className={`rounded-md border p-2 transition-colors ${
                searching
                  ? "border-accent text-accent"
                  : "border-hairline text-muted hover:text-foreground"
              }`}
            >
              <SearchIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      {!emptyMode && (
        <div className="overflow-hidden rounded-xl border border-hairline">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline bg-ground/50 text-left text-xs font-medium uppercase tracking-wide text-muted">
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">Category / details</th>
                <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                <th className="px-4 py-2.5 text-center font-medium">Approved</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-sm text-muted"
                  >
                    {rows.length === 0
                      ? "No transactions yet."
                      : "Nothing matches that search."}
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const signed = signedCents(r);
                  const isOut = signed < 0;
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-hairline last:border-0"
                    >
                      <td className="tabular whitespace-nowrap px-4 py-2.5 text-muted">
                        {formatShort(r.date)}
                      </td>
                      <td className="max-w-[22rem] truncate px-4 py-2.5">
                        <span title={rowLabel(r)}>{rowLabel(r)}</span>
                      </td>
                      <td
                        className={`tabular whitespace-nowrap px-4 py-2.5 text-right font-medium ${
                          isOut ? "text-red-600" : "text-green-700"
                        }`}
                      >
                        {isOut ? "-" : ""}
                        {formatCents(r.amountCents)}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {r.status === "APPROVED" ? (
                          <CheckIcon className="mx-auto h-4 w-4 text-green-700" />
                        ) : (
                          <span
                            className="mx-auto block h-2 w-2 rounded-full bg-amber-400"
                            title="Awaiting approval"
                          />
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {overlay === "add" && (
        <AddOverlay
          roster={roster}
          defaultUser={selectedId ?? roster[0]?.id ?? ""}
          today={today}
          onClose={() => setOverlay(null)}
        />
      )}
      {overlay === "start" && (
        <StartingOverlay
          roster={roster}
          defaultUser={selectedId ?? roster[0]?.id ?? ""}
          fixedName={emptyMode ? null : selectedName}
          today={today}
          onClose={() => setOverlay(null)}
        />
      )}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
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
          <h3 className="font-display text-lg font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-muted hover:text-foreground"
          >
            Cancel
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AddOverlay({
  roster,
  defaultUser,
  today,
  onClose,
}: {
  roster: { id: string; name: string }[];
  defaultUser: string;
  today: string;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(addMoneyEntry, initial);
  const [direction, setDirection] = useState<"DEPOSIT" | "PAYMENT">("DEPOSIT");
  const done = useRef(false);

  useEffect(() => {
    if (!pending && state.ok && !done.current) {
      done.current = true;
      onClose();
    }
  }, [pending, state, onClose]);

  return (
    <Modal title="Add transaction" onClose={onClose}>
      <form action={action} className="space-y-4">
        <div>
          <label htmlFor="m-user" className={LABEL}>
            For
          </label>
          <select
            id="m-user"
            name="userId"
            defaultValue={defaultUser}
            className={FIELD}
          >
            {roster.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="m-date" className={LABEL}>
              Date
            </label>
            <input
              id="m-date"
              type="date"
              name="date"
              defaultValue={today}
              className={FIELD}
            />
          </div>
          <div>
            <label htmlFor="m-dir" className={LABEL}>
              Type
            </label>
            <select
              id="m-dir"
              name="direction"
              value={direction}
              onChange={(e) =>
                setDirection(e.target.value as "DEPOSIT" | "PAYMENT")
              }
              className={FIELD}
            >
              <option value="DEPOSIT">Deposit (money in)</option>
              <option value="PAYMENT">Payment (money out)</option>
            </select>
          </div>
        </div>

        {direction === "DEPOSIT" && (
          <div>
            <label htmlFor="m-cat" className={LABEL}>
              Category
            </label>
            <select id="m-cat" name="category" defaultValue="" className={FIELD}>
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
          <label htmlFor="m-detail" className={LABEL}>
            {direction === "DEPOSIT" ? "Details (optional)" : "Details"}
          </label>
          <input
            id="m-detail"
            name="detail"
            maxLength={200}
            placeholder={
              direction === "DEPOSIT"
                ? "e.g. from Grandma"
                : "e.g. bought a game"
            }
            className={FIELD}
          />
        </div>

        <div>
          <label htmlFor="m-amount" className={LABEL}>
            Amount (USD)
          </label>
          <input
            id="m-amount"
            name="amount"
            inputMode="decimal"
            placeholder="0.00"
            className={FIELD}
          />
        </div>

        {state.error && (
          <p className="text-sm text-red-600">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Saving\u2026" : "Submit"}
        </button>
      </form>
    </Modal>
  );
}

function StartingOverlay({
  roster,
  defaultUser,
  fixedName,
  today,
  onClose,
}: {
  roster: { id: string; name: string }[];
  defaultUser: string;
  fixedName: string | null;
  today: string;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(setStartingFunds, initial);
  const done = useRef(false);

  useEffect(() => {
    if (!pending && state.ok && !done.current) {
      done.current = true;
      onClose();
    }
  }, [pending, state, onClose]);

  return (
    <Modal title="Set starting funds" onClose={onClose}>
      <form action={action} className="space-y-4">
        <p className="text-sm text-muted">
          The balance already in hand before this ledger begins. Shown as a
          &ldquo;Starting funds&rdquo; line.
        </p>

        {fixedName ? (
          <>
            <input type="hidden" name="userId" value={defaultUser} />
            <p className="text-sm">
              For <span className="font-medium">{fixedName}</span>
            </p>
          </>
        ) : (
          <div>
            <label htmlFor="s-user" className={LABEL}>
              For
            </label>
            <select
              id="s-user"
              name="userId"
              defaultValue={defaultUser}
              className={FIELD}
            >
              {roster.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="s-date" className={LABEL}>
              As of
            </label>
            <input
              id="s-date"
              type="date"
              name="date"
              defaultValue={today}
              className={FIELD}
            />
          </div>
          <div>
            <label htmlFor="s-amount" className={LABEL}>
              Amount (USD)
            </label>
            <input
              id="s-amount"
              name="amount"
              inputMode="decimal"
              placeholder="0.00"
              className={FIELD}
            />
          </div>
        </div>

        {state.error && <p className="text-sm text-red-600">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Saving\u2026" : "Submit"}
        </button>
      </form>
    </Modal>
  );
}

function SearchIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
