"use client";

import { useMemo, useState, useTransition } from "react";
import {
  importMoneyEntries,
  type ImportRow,
} from "@/lib/actions/money-import";
import {
  DEPOSIT_CATEGORIES,
  categoryLabel,
  formatDollars,
  guessCategory,
  parseAmountToCents,
} from "@/lib/money";

type GridRow = {
  key: number;
  date: string; // YYYY-MM-DD, or "" if unparseable
  direction: "DEPOSIT" | "PAYMENT";
  category: string; // deposit only
  detail: string;
  amount: string; // magnitude, dollars string
};

const FIELD =
  "w-full rounded-md border border-hairline bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent";

function splitCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") field += ch;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** ISO (YYYY-MM-DD) or US M/D/YYYY to ISO; "" if it can't be read. */
function parseDate(raw: string): string {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (us) {
    let [, m, d, y] = us;
    if (y.length === 2) y = `20${y}`;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return "";
}

/** Signed cents from a money string; handles "$", commas, and (parentheses). */
function parseSigned(raw: string): number | null {
  let s = raw.trim();
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  const cents = parseAmountToCents(s.replace(/^-/, ""));
  if (cents === null) return null;
  return (neg || /^-/.test(raw.trim()) ? -1 : 1) * cents;
}

function idx(header: string[], ...names: string[]): number {
  const lower = header.map((h) => h.trim().toLowerCase());
  for (const n of names) {
    const i = lower.indexOf(n);
    if (i !== -1) return i;
  }
  return -1;
}

export function MoneyImport({
  roster,
  balances,
}: {
  roster: { id: string; name: string }[];
  balances: Record<string, number>;
  today: string;
}) {
  const [userId, setUserId] = useState(roster[0]?.id ?? "");
  const [raw, setRaw] = useState("");
  const [rows, setRows] = useState<GridRow[] | null>(null);
  const [parseNote, setParseNote] = useState<string | null>(null);
  const [expected, setExpected] = useState("");
  const [addAdjust, setAddAdjust] = useState(true);
  const [result, setResult] = useState<string | null>(null);
  const [busy, start] = useTransition();

  let keySeq = 0;

  function doParse() {
    setResult(null);
    const table = splitCSV(raw).filter((r) => r.some((c) => c.trim() !== ""));
    if (table.length < 2) {
      setParseNote("Couldn't find a header row and at least one transaction.");
      setRows(null);
      return;
    }
    const header = table[0];
    const di = idx(header, "date");
    const ai = idx(header, "amount");
    const oi = idx(header, "outflow");
    const ii = idx(header, "inflow");
    const pi = idx(header, "payee");
    const ni = idx(header, "notes", "note", "memo");

    if (di === -1 || (ai === -1 && oi === -1 && ii === -1)) {
      setParseNote(
        "Need at least a Date column and an Amount column (or Outflow/Inflow).",
      );
      setRows(null);
      return;
    }

    const out: GridRow[] = [];
    let skipped = 0;
    for (let r = 1; r < table.length; r++) {
      const cells = table[r];
      const date = parseDate(cells[di] ?? "");
      let signed: number | null = null;
      if (ai !== -1) signed = parseSigned(cells[ai] ?? "");
      else {
        const inC = ii !== -1 ? parseSigned(cells[ii] ?? "") ?? 0 : 0;
        const outC = oi !== -1 ? parseSigned(cells[oi] ?? "") ?? 0 : 0;
        signed = Math.abs(inC) - Math.abs(outC);
      }
      if (signed === null || signed === 0) {
        skipped++;
        continue;
      }
      const payee = pi !== -1 ? (cells[pi] ?? "").trim() : "";
      const notes = ni !== -1 ? (cells[ni] ?? "").trim() : "";
      const text = [payee, notes].filter(Boolean).join(" — ");
      const direction = signed < 0 ? "PAYMENT" : "DEPOSIT";
      out.push({
        key: keySeq++,
        date,
        direction,
        category: direction === "DEPOSIT" ? guessCategory(text) : "",
        detail: text,
        amount: (Math.abs(signed) / 100).toFixed(2),
      });
    }

    if (out.length === 0) {
      setParseNote("No transactions with a non-zero amount were found.");
      setRows(null);
      return;
    }
    setParseNote(
      skipped > 0
        ? `Loaded ${out.length} rows. Skipped ${skipped} with a blank or zero amount.`
        : `Loaded ${out.length} rows.`,
    );
    setRows(out);
  }

  function update(key: number, patch: Partial<GridRow>) {
    setRows((rs) =>
      rs ? rs.map((r) => (r.key === key ? { ...r, ...patch } : r)) : rs,
    );
  }
  function removeRow(key: number) {
    setRows((rs) => (rs ? rs.filter((r) => r.key !== key) : rs));
  }

  const rowError = (r: GridRow): string | null => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) return "date";
    if (parseAmountToCents(r.amount) === null || parseAmountToCents(r.amount)! <= 0)
      return "amount";
    if (r.direction === "DEPOSIT" && !r.category) return "category";
    return null;
  };

  const anyError = rows?.some((r) => rowError(r)) ?? false;

  const current = balances[userId] ?? 0;
  const importSum = useMemo(() => {
    if (!rows) return 0;
    return rows.reduce((sum, r) => {
      const cents = parseAmountToCents(r.amount);
      if (cents === null) return sum;
      return sum + (r.direction === "PAYMENT" ? -cents : cents);
    }, 0);
  }, [rows]);
  const projected = current + importSum;

  const expectedCents = expected.trim() ? parseAmountToCents(expected) : null;
  const diff =
    expectedCents !== null && expected.trim() ? expectedCents - projected : 0;

  function submit() {
    if (!rows || anyError) return;
    const payload: ImportRow[] = rows.map((r) => ({
      date: r.date,
      direction: r.direction,
      category: r.direction === "DEPOSIT" ? r.category : null,
      detail: r.detail || null,
      amountCents: parseAmountToCents(r.amount) ?? 0,
    }));
    const adjustment = addAdjust ? diff : 0;
    start(async () => {
      const res = await importMoneyEntries(userId, payload, adjustment);
      if (res.error) setResult(res.error);
      else {
        setResult(
          `Imported ${res.imported} transaction${res.imported === 1 ? "" : "s"}${
            adjustment !== 0 ? " plus a reconciliation adjustment" : ""
          }.`,
        );
        setRows(null);
        setRaw("");
        setExpected("");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="rounded-xl border border-hairline bg-surface p-5 text-sm">
        <p className="font-medium">Exporting from Actual</p>
        <p className="mt-1 text-muted">
          In Actual, open the person&rsquo;s account, then Export to CSV. The
          columns Kairos reads are <strong>Date</strong> and{" "}
          <strong>Amount</strong> (required), plus <strong>Payee</strong> and{" "}
          <strong>Notes</strong> (optional). A single signed Amount works
          (negative is a payment, positive a deposit), or separate
          Outflow/Inflow columns. The Account column and any blank columns are
          ignored. Payees don&rsquo;t need to match Kairos categories — anything
          that doesn&rsquo;t map lands in the details, and you set the category
          in the grid below.
        </p>
      </div>

      {/* Source */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-sm font-medium">Import for</label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="mt-1.5 rounded-md border border-hairline bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            >
              {roster.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <label className="text-sm text-muted">
            <span className="mr-2">or choose a file</span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                file.text().then((t) => setRaw(t));
              }}
              className="text-xs"
            />
          </label>
        </div>

        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={5}
          placeholder="Paste CSV here, or choose a file above."
          className="w-full rounded-md border border-hairline bg-surface px-3 py-2 font-mono text-xs outline-none focus:border-accent"
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={doParse}
            disabled={!raw.trim() || !userId}
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-50"
          >
            Parse
          </button>
          {parseNote && <span className="text-sm text-muted">{parseNote}</span>}
        </div>
      </div>

      {/* Review grid */}
      {rows && rows.length > 0 && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-hairline">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline bg-ground/50 text-left text-xs font-medium uppercase tracking-wide text-muted">
                  <th className="px-2 py-2.5 font-medium">Date</th>
                  <th className="px-2 py-2.5 font-medium">Type</th>
                  <th className="px-2 py-2.5 font-medium">Category</th>
                  <th className="px-2 py-2.5 font-medium">Details</th>
                  <th className="px-2 py-2.5 text-right font-medium">Amount</th>
                  <th className="px-2 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const err = rowError(r);
                  return (
                    <tr
                      key={r.key}
                      className={`border-b border-hairline last:border-0 ${
                        err ? "bg-red-50" : ""
                      }`}
                    >
                      <td className="px-2 py-1.5">
                        <input
                          type="date"
                          value={r.date}
                          onChange={(e) =>
                            update(r.key, { date: e.target.value })
                          }
                          className={FIELD}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <select
                          value={r.direction}
                          onChange={(e) =>
                            update(r.key, {
                              direction: e.target.value as
                                | "DEPOSIT"
                                | "PAYMENT",
                              category:
                                e.target.value === "DEPOSIT"
                                  ? r.category || guessCategory(r.detail)
                                  : "",
                            })
                          }
                          className={FIELD}
                        >
                          <option value="DEPOSIT">Deposit</option>
                          <option value="PAYMENT">Payment</option>
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        {r.direction === "DEPOSIT" ? (
                          <select
                            value={r.category}
                            onChange={(e) =>
                              update(r.key, { category: e.target.value })
                            }
                            className={FIELD}
                          >
                            {DEPOSIT_CATEGORIES.map((c) => (
                              <option key={c} value={c}>
                                {categoryLabel(c)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          value={r.detail}
                          maxLength={200}
                          onChange={(e) =>
                            update(r.key, { detail: e.target.value })
                          }
                          className={FIELD}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-1">
                          <span
                            className={
                              r.direction === "PAYMENT"
                                ? "text-red-600"
                                : "text-green-700"
                            }
                          >
                            {r.direction === "PAYMENT" ? "−" : "+"}
                          </span>
                          <input
                            value={r.amount}
                            inputMode="decimal"
                            onChange={(e) =>
                              update(r.key, { amount: e.target.value })
                            }
                            className={`${FIELD} text-right`}
                          />
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <button
                          type="button"
                          onClick={() => removeRow(r.key)}
                          className="rounded-md border border-hairline px-2 py-1 text-xs text-muted hover:text-red-600"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {anyError && (
            <p className="text-sm text-red-600">
              Some rows need a valid date, amount, or category before importing —
              they&rsquo;re highlighted above.
            </p>
          )}

          {/* Reconciliation */}
          <div className="rounded-xl border border-hairline bg-surface p-5">
            <p className="font-medium">Reconcile</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">Current balance</dt>
                  <dd className="tabular">{formatDollars(current)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">This import</dt>
                  <dd className="tabular">
                    {importSum < 0 ? "−" : "+"}
                    {formatDollars(Math.abs(importSum))}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-hairline pt-1 font-medium">
                  <dt>Projected balance</dt>
                  <dd className="tabular">{formatDollars(projected)}</dd>
                </div>
              </dl>
              <div>
                <label className="block text-sm font-medium">
                  Expected ending balance (optional)
                </label>
                <input
                  value={expected}
                  inputMode="decimal"
                  placeholder="e.g. 42.50"
                  onChange={(e) => setExpected(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-hairline bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
                />
                {expectedCents !== null && expected.trim() && diff !== 0 && (
                  <label className="mt-2 flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={addAdjust}
                      onChange={(e) => setAddAdjust(e.target.checked)}
                      className="mt-0.5 h-4 w-4"
                    />
                    <span>
                      Off by{" "}
                      <span className="font-medium">
                        {formatDollars(Math.abs(diff))}
                      </span>
                      . Add an adjustment line so the balance matches your
                      expected total.
                    </span>
                  </label>
                )}
                {expectedCents !== null && expected.trim() && diff === 0 && (
                  <p className="mt-2 text-sm text-green-700">
                    Matches your expected total.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={busy || anyError}
              className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-50"
            >
              {busy
                ? "Importing\u2026"
                : `Import ${rows.length} transaction${rows.length === 1 ? "" : "s"}${
                    addAdjust && diff !== 0 ? " + adjustment" : ""
                  }`}
            </button>
            {result && <span className="text-sm text-muted">{result}</span>}
          </div>
        </div>
      )}

      {!rows && result && (
        <p className="rounded-lg border border-hairline bg-surface px-4 py-3 text-sm text-green-700">
          {result}
        </p>
      )}
    </div>
  );
}
