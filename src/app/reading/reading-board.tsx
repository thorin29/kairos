"use client";

import { useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import { PlusIcon, TrashIcon } from "@/components/icons";
import type { PersonBooks, BookProgress } from "@/lib/queries/reading";
import {
  addBook,
  logBookReading,
  editBook,
  finishBook,
  deleteBook,
} from "@/lib/actions/books";

const unitLabel = (unit: "PAGES" | "CHAPTERS", n: number) =>
  unit === "PAGES" ? (n === 1 ? "page" : "pages") : n === 1 ? "chapter" : "chapters";

export function ReadingBoard({ people }: { people: PersonBooks[] }) {
  return (
    <div className="space-y-4">
      {people.map((p) => (
        <PersonReading key={p.id} person={p} />
      ))}
    </div>
  );
}

function PersonReading({ person }: { person: PersonBooks }) {
  const [adding, setAdding] = useState(false);
  const [showFinished, setShowFinished] = useState(false);

  return (
    <section className="rounded-2xl border border-hairline bg-surface p-5">
      <div className="mb-3 flex items-center gap-3">
        <Avatar
          name={person.name}
          color={person.color}
          avatarPath={person.avatarPath} avatarPosition={person.avatarPosition}
          size="sm"
        />
        <h2 className="font-display text-lg font-semibold">{person.name}</h2>
      </div>

      {person.current.length === 0 && !adding && (
        <p className="mb-3 text-sm text-muted">Nothing on the go right now.</p>
      )}

      <div className="space-y-3">
        {person.current.map((b) => (
          <BookCard key={b.id} book={b} />
        ))}
      </div>

      {adding ? (
        <AddBook userId={person.id} onDone={() => setAdding(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
        >
          <PlusIcon className="h-4 w-4" /> Add a book
        </button>
      )}

      {person.finished.length > 0 && (
        <div className="mt-4 border-t border-hairline pt-3">
          <button
            type="button"
            onClick={() => setShowFinished((s) => !s)}
            className="text-sm font-medium text-muted hover:text-ink"
          >
            {showFinished ? "Hide" : "Show"} finished ({person.finished.length})
          </button>
          {showFinished && (
            <ul className="mt-2 space-y-1.5">
              {person.finished.map((b) => (
                <FinishedRow key={b.id} book={b} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function BookCard({ book }: { book: BookProgress }) {
  const [pending, start] = useTransition();
  const [amount, setAmount] = useState(String(book.todayAmount || ""));
  const [editingLen, setEditingLen] = useState(false);
  const pct = book.length > 0 ? Math.round((book.read / book.length) * 100) : 0;
  const done = book.read >= book.length;

  const save = () => {
    const n = Math.max(0, Math.round(Number(amount) || 0));
    start(() => logBookReading(book.id, n));
  };

  return (
    <div className="rounded-xl border border-hairline p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium leading-tight">{book.title}</p>
        <button
          type="button"
          onClick={() => {
            if (confirm(`Remove "${book.title}"?`))
              start(() => deleteBook(book.id));
          }}
          aria-label="Remove book"
          className="shrink-0 text-muted hover:text-red-600"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Progress */}
      <div className="mt-2">
        <div className="h-2 w-full overflow-hidden rounded-full bg-ground">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-muted">
          {book.read} / {book.length} {unitLabel(book.unit, book.length)} ({pct}%)
        </p>
      </div>

      {/* Log today */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="text-sm text-muted">Read today:</label>
        <input
          type="number"
          min={0}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onBlur={save}
          className="tabular h-9 w-20 rounded-lg border border-hairline bg-surface px-2 text-sm outline-none focus:border-accent"
        />
        <span className="text-sm text-muted">
          {unitLabel(book.unit, Number(amount) || 0)}
        </span>
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="inline-flex h-9 items-center rounded-full bg-accent px-3 text-sm font-medium text-white disabled:opacity-50"
        >
          Save
        </button>
      </div>

      <div className="mt-2 flex items-center gap-3 text-xs">
        <button
          type="button"
          onClick={() => setEditingLen((v) => !v)}
          className="font-medium text-muted hover:text-ink"
        >
          Edit length
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => finishBook(book.id, true))}
          className="font-medium text-accent hover:underline"
        >
          {done ? "Mark finished \u2713" : "Mark finished"}
        </button>
      </div>

      {editingLen && (
        <EditLength book={book} onDone={() => setEditingLen(false)} />
      )}
    </div>
  );
}

function EditLength({
  book,
  onDone,
}: {
  book: BookProgress;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [title, setTitle] = useState(book.title);
  const [len, setLen] = useState(String(book.length));

  return (
    <div className="mt-2 flex flex-wrap items-end gap-2 rounded-lg bg-ground p-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="h-9 min-w-0 flex-1 rounded-lg border border-hairline bg-surface px-2 text-sm outline-none focus:border-accent"
      />
      <input
        type="number"
        min={1}
        value={len}
        onChange={(e) => setLen(e.target.value)}
        aria-label="Length"
        className="tabular h-9 w-24 rounded-lg border border-hairline bg-surface px-2 text-sm outline-none focus:border-accent"
      />
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await editBook(book.id, {
              title,
              length: Math.max(1, Math.round(Number(len) || 1)),
            });
            onDone();
          })
        }
        className="inline-flex h-9 items-center rounded-full bg-accent px-3 text-sm font-medium text-white disabled:opacity-50"
      >
        Save
      </button>
      <button
        type="button"
        onClick={onDone}
        className="inline-flex h-9 items-center rounded-full border border-hairline px-3 text-sm font-medium text-muted"
      >
        Cancel
      </button>
    </div>
  );
}

function FinishedRow({ book }: { book: BookProgress }) {
  const [pending, start] = useTransition();
  return (
    <li className="flex items-center justify-between gap-2 text-sm">
      <span className="truncate text-muted line-through">{book.title}</span>
      <span className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => finishBook(book.id, false))}
          className="text-xs font-medium text-accent hover:underline"
        >
          Reopen
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm(`Remove "${book.title}"?`))
              start(() => deleteBook(book.id));
          }}
          aria-label="Remove book"
          className="text-muted hover:text-red-600"
        >
          <TrashIcon className="h-3.5 w-3.5" />
        </button>
      </span>
    </li>
  );
}

function AddBook({
  userId,
  onDone,
}: {
  userId: string;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [title, setTitle] = useState("");
  const [unit, setUnit] = useState<"PAGES" | "CHAPTERS">("PAGES");
  const [length, setLength] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const submit = () => {
    setErr(null);
    start(async () => {
      const res = await addBook({
        userId,
        title,
        unit,
        length: Math.round(Number(length) || 0),
      });
      if (res.error) setErr(res.error);
      else onDone();
    });
  };

  return (
    <div className="mt-3 rounded-xl border border-hairline bg-ground p-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Book title"
        autoFocus
        className="h-10 w-full rounded-lg border border-hairline bg-surface px-3 text-sm outline-none focus:border-accent"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-full border border-hairline">
          {(["PAGES", "CHAPTERS"] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUnit(u)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                unit === u ? "bg-accent text-white" : "text-muted hover:text-ink"
              }`}
            >
              {u === "PAGES" ? "Pages" : "Chapters"}
            </button>
          ))}
        </div>
        <input
          type="number"
          min={1}
          value={length}
          onChange={(e) => setLength(e.target.value)}
          placeholder={unit === "PAGES" ? "Total pages" : "Total chapters"}
          className="tabular h-9 w-32 rounded-lg border border-hairline bg-surface px-2 text-sm outline-none focus:border-accent"
        />
      </div>
      {err && <p className="mt-1.5 text-xs text-red-600">{err}</p>}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className="inline-flex h-9 items-center rounded-full bg-accent px-4 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Adding\u2026" : "Add book"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="inline-flex h-9 items-center rounded-full border border-hairline px-4 text-sm font-medium text-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
