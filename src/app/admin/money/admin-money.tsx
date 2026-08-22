"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  approveMoneyEntry,
  unapproveMoneyEntry,
  approveAllMoney,
  updateMoneyEntry,
  deleteMoneyEntry,
  setStartingFunds,
  type MoneyActionState,
} from "@/lib/actions/money";
import {
  approveBibleBase,
  approveBibleMonthAll,
  saveBibleRewardConfig,
  type RewardActionState,
} from "@/lib/actions/bible-rewards";
import {
  DEPOSIT_CATEGORIES,
  categoryLabel,
  formatCents,
  formatDollars,
  rowLabel,
  signedCents,
} from "@/lib/money";
import { formatShortYear } from "@/lib/dates";
import { CheckIcon, PencilIcon, TrashIcon, DollarIcon, BibleIcon } from "@/components/icons";
import type { AdminMoneyRow } from "@/lib/queries/money";
import type { RewardConfig, RewardMonth } from "@/lib/bible-rewards";

const initial: MoneyActionState = { error: null };
const rewardInitial: RewardActionState = { error: null };
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
  people,
  today,
  rewardConfig,
  rewardMonths,
}: {
  pending: AdminMoneyRow[];
  all: AdminMoneyRow[];
  people: { id: string; name: string }[];
  today: string;
  rewardConfig: RewardConfig;
  rewardMonths: RewardMonth[];
}) {
  const [busy, start] = useTransition();
  const [editing, setEditing] = useState<AdminMoneyRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [startFunds, setStartFunds] = useState(false);

  return (
    <div className="space-y-10">
      {/* Bible reward approvals */}
      {rewardMonths.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
            <BibleIcon className="h-5 w-5 text-accent" />
            Bible reading rewards
          </h2>
          <ul className="space-y-3">
            {rewardMonths.map((m) => (
              <li
                key={m.periodKey}
                className="rounded-lg border border-hairline bg-surface p-4"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{m.label}</p>
                    <p className="text-xs text-muted">
                      {m.completers.length}{" "}
                      {m.completers.length === 1 ? "person" : "people"} finished
                      {m.bonusAvailable && (
                        <span className="ml-1 text-green-700">
                          — everyone finished, bonus available
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      start(() => void approveBibleMonthAll(m.periodKey))
                    }
                    className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-50"
                  >
                    {m.bonusAvailable
                      ? `Approve all + bonus (+${formatDollars(m.bonusCents)} each)`
                      : "Approve all"}
                  </button>
                </div>

                {!m.bonusAvailable && (
                  <ul className="divide-y divide-hairline border-t border-hairline">
                    {m.completers.map((c) => (
                      <li
                        key={c.userId}
                        className="flex items-center gap-3 py-2"
                      >
                        <span className="flex-1 text-sm">{c.name}</span>
                        <span className="tabular text-sm text-green-700">
                          {formatDollars(c.baseCents)}
                        </span>
                        {c.needsBase ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              start(() =>
                                void approveBibleBase(c.userId, m.periodKey),
                              )
                            }
                            className="rounded-md bg-green-600 px-2.5 py-1 text-xs font-medium text-white transition-all hover:brightness-110 disabled:opacity-50"
                          >
                            Approve
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-green-700">
                            <CheckIcon className="h-3.5 w-3.5" />
                            Paid
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

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
          <div className="flex items-center gap-2">
            <a
              href="/admin/money/import"
              className="inline-flex items-center gap-1.5 rounded-md border border-hairline px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent"
            >
              Import CSV
            </a>
            <button
              type="button"
              onClick={() => setStartFunds(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-hairline px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent"
            >
              <DollarIcon className="h-4 w-4" />
              Set starting funds
            </button>
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
                  {formatShortYear(r.date)}
                </span>
                <span
                  className="min-w-0 flex-1 truncate text-sm"
                  title={rowLabel(r)}
                >
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

      {/* Reward settings */}
      <RewardSettings config={rewardConfig} />

      {/* Full ledger */}
      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">
          All transactions
        </h2>
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
                  <tr
                    key={r.id}
                    className="border-b border-hairline last:border-0"
                  >
                    <td className="px-3 py-2.5 font-medium">{r.userName}</td>
                    <td className="tabular whitespace-nowrap px-3 py-2.5 text-muted">
                      {formatShortYear(r.date)}
                    </td>
                    <td
                      className="max-w-[16rem] truncate px-3 py-2.5"
                      title={rowLabel(r)}
                    >
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
                          onClick={() =>
                            start(() => void unapproveMoneyEntry(r.id))
                          }
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
                          onClick={() =>
                            start(() => void approveMoneyEntry(r.id))
                          }
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

      {editing && <EditModal row={editing} onClose={() => setEditing(null)} />}
      {startFunds && (
        <StartingModal
          people={people}
          today={today}
          onClose={() => setStartFunds(false)}
        />
      )}
    </div>
  );
}

function RewardSettings({ config }: { config: RewardConfig }) {
  const [state, action, pending] = useActionState(
    saveBibleRewardConfig,
    rewardInitial,
  );

  return (
    <section>
      <h2 className="mb-1 font-display text-lg font-semibold">
        Bible reading reward settings
      </h2>
      <p className="mb-3 max-w-xl text-sm text-muted">
        Tick who earns money for finishing a month&rsquo;s reading and set each
        amount. If everyone ticked finishes within the grace period after the
        month ends, they each also earn the group bonus.
      </p>

      <form
        action={action}
        className="space-y-4 rounded-xl border border-hairline bg-surface p-5"
      >
        <div className="space-y-2">
          {config.users.map((u) => (
            <div key={u.id} className="flex items-center gap-3">
              <input type="hidden" name="userId" value={u.id} />
              <label className="flex flex-1 items-center gap-2">
                <input
                  type="checkbox"
                  name={`enabled:${u.id}`}
                  defaultChecked={u.enabled}
                  className="h-4 w-4 rounded border-hairline"
                />
                <span className="text-sm font-medium">{u.name}</span>
              </label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted">$</span>
                <input
                  name={`amount:${u.id}`}
                  inputMode="decimal"
                  defaultValue={(u.baseCents / 100).toFixed(2)}
                  className="w-24 rounded-md border border-hairline bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-hairline pt-4">
          <div>
            <label htmlFor="bonusAmount" className={LABEL}>
              Group bonus (each)
            </label>
            <div className="mt-1.5 flex items-center gap-1">
              <span className="text-sm text-muted">$</span>
              <input
                id="bonusAmount"
                name="bonusAmount"
                inputMode="decimal"
                defaultValue={(config.bonusCents / 100).toFixed(2)}
                className="w-full rounded-md border border-hairline bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent"
              />
            </div>
          </div>
          <div>
            <label htmlFor="graceDays" className={LABEL}>
              Grace period (days)
            </label>
            <input
              id="graceDays"
              name="graceDays"
              inputMode="numeric"
              defaultValue={config.graceDays}
              className={FIELD}
            />
          </div>
        </div>

        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state.ok && !state.error && (
          <p className="text-sm text-green-700">Saved.</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Saving\u2026" : "Save settings"}
        </button>
      </form>
    </section>
  );
}

function StartingModal({
  people,
  today,
  onClose,
}: {
  people: { id: string; name: string }[];
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
    <ModalShell title="Set starting funds" onClose={onClose}>
      <form action={action} className="space-y-4">
        <p className="text-sm text-muted">
          The balance already in hand before this ledger begins. Shown as a
          &ldquo;Starting funds&rdquo; line and approved automatically.
        </p>
        <div>
          <label htmlFor="sf-user" className={LABEL}>
            For
          </label>
          <select
            id="sf-user"
            name="userId"
            defaultValue={people[0]?.id ?? ""}
            className={FIELD}
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="sf-date" className={LABEL}>
              As of
            </label>
            <input
              id="sf-date"
              type="date"
              name="date"
              defaultValue={today}
              className={FIELD}
            />
          </div>
          <div>
            <label htmlFor="sf-amount" className={LABEL}>
              Amount (USD)
            </label>
            <input
              id="sf-amount"
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
    </ModalShell>
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
    <ModalShell title={`Edit — ${row.userName}`} onClose={onClose}>
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
    </ModalShell>
  );
}

function ModalShell({
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
