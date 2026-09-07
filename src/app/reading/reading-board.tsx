"use client";

import { useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import {
  PlusIcon,
  TrashIcon,
  StarIcon,
  BookIcon,
  ChevronLeftIcon,
} from "@/components/icons";
import type { PersonBooks, BookProgress } from "@/lib/queries/reading";
import {
  addBook,
  logBookReading,
  editBook,
  finishBook,
  shelveBook,
  bookmarkBook,
  deleteBook,
} from "@/lib/actions/books";

const unitLabel = (unit: "PAGES" | "CHAPTERS", n: number) =>
  unit === "PAGES" ? (n === 1 ? "page" : "pages") : n === 1 ? "chapter" : "chapters";

function sizeLabel(b: BookProgress): string {
  const parts: string[] = [];
  if (b.pages) parts.push(`${b.pages} ${b.pages === 1 ? "page" : "pages"}`);
  if (b.chapters) parts.push(`${b.chapters} ${b.chapters === 1 ? "chapter" : "chapters"}`);
  return parts.join(" \u00b7 ");
}

const queueOf = (books: BookProgress[]) =>
  books.filter((b) => !b.shelved && !b.finished);

export function ReadingBoard({ people }: { people: PersonBooks[] }) {
  const [selected, setSelected] = useState<string | null>(
    people.length === 1 ? people[0].id : null,
  );

  const person = people.find((p) => p.id === selected) ?? null;
  if (person) {
    return (
      <PersonDetail
        person={person}
        showBack={people.length > 1}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {people.map((p) => {
        const reading = queueOf(p.books).length;
        const shelf = p.books.filter((b) => b.shelved && !b.finished).length;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => setSelected(p.id)}
            className="flex items-center gap-3 rounded-2xl border border-hairline bg-surface p-4 text-left transition-colors hover:border-accent"
          >
            <Avatar
              name={p.name}
              color={p.color}
              avatarPath={p.avatarPath}
              avatarPosition={p.avatarPosition}
              size="sm"
            />
            <div className="min-w-0">
              <p className="truncate font-display font-semibold">{p.name}</p>
              <p className="text-xs text-muted">
                {reading} reading{shelf > 0 ? ` \u00b7 ${shelf} on the shelf` : ""}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function PersonDetail({
  person,
  showBack,
  onBack,
}: {
  person: PersonBooks;
  showBack: boolean;
  onBack: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [showShelf, setShowShelf] = useState(false);

  const queue = queueOf(person.books);
  const toRead = person.books.filter((b) => b.shelved && !b.finished);
  const bookmarked = person.books.filter((b) => b.bookmarked);
  const read = person.books.filter((b) => b.finished);
  const shelfCount = toRead.length + bookmarked.length + read.length;

  return (
    <section className="rounded-2xl border border-hairline bg-surface p-5">
      <div className="mb-3 flex items-center gap-3">
        {showBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="rounded-lg p-1 text-muted hover:text-ink"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
        )}
        <Avatar
          name={person.name}
          color={person.color}
          avatarPath={person.avatarPath}
          avatarPosition={person.avatarPosition}
          size="sm"
        />
        <h2 className="font-display text-lg font-semibold">{person.name}</h2>
      </div>

      {queue.length === 0 && !adding && (
        <p className="mb-3 text-sm text-muted">Nothing on the go right now.</p>
      )}

      <div className="space-y-3">
        {queue.map((b) => (
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

      {shelfCount > 0 && (
        <div className="mt-4 border-t border-hairline pt-3">
          <button
            type="button"
            onClick={() => setShowShelf((s) => !s)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
          >
            <BookIcon className="h-4 w-4" />
            {showShelf ? "Hide" : "Bookshelf"} ({shelfCount})
          </button>
          {showShelf && (
            <div className="mt-3 space-y-4">
              <ShelfGroup title="To read" books={toRead} kind="toRead" />
              <ShelfGroup title="Bookmarked" books={bookmarked} kind="bookmarked" />
              <ShelfGroup title="Read" books={read} kind="read" />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function BookCard({ book }: { book: BookProgress }) {
  const [pending, start] = useTransition();
  const [amount, setAmount] = useState(String(book.todayAmount || ""));
  const [editing, setEditing] = useState(false);
  const pct = book.length > 0 ? Math.round((book.read / book.length) * 100) : 0;
  const done = book.read >= book.length;

  const save = () => {
    const n = Math.max(0, Math.round(Number(amount) || 0));
    start(() => logBookReading(book.id, n));
  };

  return (
    <div className="rounded-xl border border-hairline p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium leading-tight">{book.title}</p>
          {book.author && <p className="text-xs text-muted">{book.author}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            disabled={pending}
            onClick={() => start(() => bookmarkBook(book.id, !book.bookmarked))}
            aria-label={book.bookmarked ? "Remove bookmark" : "Bookmark"}
            className={book.bookmarked ? "text-amber-500" : "text-muted hover:text-amber-500"}
          >
            <StarIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm(`Remove "${book.title}"?`)) start(() => deleteBook(book.id));
            }}
            aria-label="Remove book"
            className="text-muted hover:text-red-600"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-2">
        <div className="h-2 w-full overflow-hidden rounded-full bg-ground">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-muted">
          {book.read} / {book.length} {unitLabel(book.unit, book.length)} ({pct}%)
          {book.pages && book.chapters ? ` \u00b7 ${sizeLabel(book)}` : ""}
        </p>
      </div>

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

      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="font-medium text-muted hover:text-ink"
        >
          Edit
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => shelveBook(book.id, true))}
          className="font-medium text-muted hover:text-ink"
        >
          Shelve
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

      {editing && <EditBook book={book} onDone={() => setEditing(false)} />}
    </div>
  );
}

function ShelfGroup({
  title,
  books,
  kind,
}: {
  title: string;
  books: BookProgress[];
  kind: "toRead" | "bookmarked" | "read";
}) {
  if (books.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
        {title} ({books.length})
      </p>
      <ul className="space-y-1.5">
        {books.map((b) => (
          <ShelfRow key={b.id} book={b} kind={kind} />
        ))}
      </ul>
    </div>
  );
}

function ShelfRow({
  book,
  kind,
}: {
  book: BookProgress;
  kind: "toRead" | "bookmarked" | "read";
}) {
  const [pending, start] = useTransition();
  const pct = book.length > 0 ? Math.round((book.read / book.length) * 100) : 0;
  const canReturn = book.shelved || book.finished;

  const returnToQueue = () =>
    start(async () => {
      if (book.finished) await finishBook(book.id, false);
      if (book.shelved) await shelveBook(book.id, false);
    });

  return (
    <li className="flex items-center justify-between gap-2 rounded-lg border border-hairline px-3 py-2 text-sm">
      <span className="min-w-0">
        <span className={`block truncate ${book.finished ? "text-muted line-through" : ""}`}>
          {book.title}
        </span>
        <span className="text-xs text-muted">
          {book.author ? `${book.author} \u00b7 ` : ""}
          {kind === "read" ? "Read" : `${pct}%`}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {(kind !== "bookmarked" || canReturn) && (
          <button
            type="button"
            disabled={pending}
            onClick={returnToQueue}
            className="text-xs font-medium text-accent hover:underline"
          >
            {kind === "read" ? "Reopen" : "Move to reading"}
          </button>
        )}
        {kind === "bookmarked" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => start(() => bookmarkBook(book.id, false))}
            aria-label="Remove bookmark"
            className="text-amber-500"
          >
            <StarIcon className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (confirm(`Remove "${book.title}"?`)) start(() => deleteBook(book.id));
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

function AddBook({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [pages, setPages] = useState("");
  const [chapters, setChapters] = useState("");
  const [error, setError] = useState<string | null>(null);

  const FIELD =
    "h-9 w-full rounded-lg border border-hairline bg-surface px-2 text-sm outline-none focus:border-accent";

  const submit = () => {
    const p = Math.round(Number(pages) || 0);
    const c = Math.round(Number(chapters) || 0);
    if (title.trim().length < 1) {
      setError("Give the book a title.");
      return;
    }
    if (p <= 0 && c <= 0) {
      setError("Enter a page or chapter count.");
      return;
    }
    setError(null);
    start(async () => {
      const res = await addBook({
        userId,
        title,
        author: author.trim() || null,
        pages: p > 0 ? p : null,
        chapters: c > 0 ? c : null,
      });
      if (res.error) setError(res.error);
      else onDone();
    });
  };

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-hairline bg-ground p-3">
      <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className={FIELD} />
      <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Author (optional)" className={FIELD} />
      <div className="grid grid-cols-2 gap-2">
        <input type="number" min={1} value={pages} onChange={(e) => setPages(e.target.value)} placeholder="Pages" className={`tabular ${FIELD}`} />
        <input type="number" min={1} value={chapters} onChange={(e) => setChapters(e.target.value)} placeholder="Chapters" className={`tabular ${FIELD}`} />
      </div>
      <p className="text-xs text-muted">Enter pages and/or chapters — at least one.</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center gap-2">
        <button type="button" disabled={pending} onClick={submit} className="inline-flex h-9 items-center rounded-full bg-accent px-3 text-sm font-medium text-white disabled:opacity-50">
          Add book
        </button>
        <button type="button" onClick={onDone} className="inline-flex h-9 items-center rounded-full border border-hairline px-3 text-sm font-medium text-muted">
          Cancel
        </button>
      </div>
    </div>
  );
}

function EditBook({ book, onDone }: { book: BookProgress; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author ?? "");
  const [pages, setPages] = useState(book.pages ? String(book.pages) : "");
  const [chapters, setChapters] = useState(book.chapters ? String(book.chapters) : "");

  const FIELD =
    "h-9 w-full rounded-lg border border-hairline bg-surface px-2 text-sm outline-none focus:border-accent";

  return (
    <div className="mt-2 space-y-2 rounded-lg bg-ground p-2">
      <input value={title} onChange={(e) => setTitle(e.target.value)} className={FIELD} placeholder="Title" />
      <input value={author} onChange={(e) => setAuthor(e.target.value)} className={FIELD} placeholder="Author (optional)" />
      <div className="grid grid-cols-2 gap-2">
        <input type="number" min={1} value={pages} onChange={(e) => setPages(e.target.value)} placeholder="Pages" className={`tabular ${FIELD}`} />
        <input type="number" min={1} value={chapters} onChange={(e) => setChapters(e.target.value)} placeholder="Chapters" className={`tabular ${FIELD}`} />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await editBook(book.id, {
                title,
                author: author.trim() || null,
                pages: Math.round(Number(pages) || 0) || null,
                chapters: Math.round(Number(chapters) || 0) || null,
              });
              onDone();
            })
          }
          className="inline-flex h-9 items-center rounded-full bg-accent px-3 text-sm font-medium text-white disabled:opacity-50"
        >
          Save
        </button>
        <button type="button" onClick={onDone} className="inline-flex h-9 items-center rounded-full border border-hairline px-3 text-sm font-medium text-muted">
          Cancel
        </button>
      </div>
    </div>
  );
}
