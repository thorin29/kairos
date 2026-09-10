"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  listSavedAddresses,
  saveAddressFromCalendar,
  type CreateAddressResult,
} from "@/lib/actions/addresses";
import type { PickerAddress } from "@/lib/queries/addresses";

/**
 * The event "Where" field as a combobox over the saved-address book. Tap to
 * browse everything (grouped by category); type to filter live on name and
 * address (prefix matches first). Selecting one fills the full address — the
 * event still submits a plain `location` string via the hidden-named input, so
 * nothing about the form action changes. A brand-new address offers "save for
 * next time", which checks for a near-duplicate first.
 */
export function LocationCombobox({
  defaultValue,
  fieldClassName,
  defaultCategory,
}: {
  defaultValue?: string;
  fieldClassName: string;
  defaultCategory?: string;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const [addresses, setAddresses] = useState<PickerAddress[]>([]);
  const [categories, setCategories] = useState<string[]>(["General"]);
  const [loaded, setLoaded] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Save-for-next-time sub-form
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveCategory, setSaveCategory] = useState(defaultCategory ?? "General");
  const [dup, setDup] = useState<{ id: string; name: string; address: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    listSavedAddresses()
      .then((res) => {
        if (!alive) return;
        setAddresses(res.addresses);
        setCategories(res.categories);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSaving(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const q = value.trim().toLowerCase();
  const matches = q
    ? rank(addresses, q)
    : [...addresses].sort(
        (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
      );

  const exact = addresses.some((a) => a.address.trim().toLowerCase() === q && q.length > 0);
  const canSave = value.trim().length > 0 && !exact;

  function pick(a: PickerAddress) {
    setValue(a.address);
    setOpen(false);
    setSaving(false);
  }

  function doSave(force = false) {
    const name = saveName.trim();
    if (!name) return;
    startTransition(async () => {
      const res: CreateAddressResult = await saveAddressFromCalendar(
        { name, address: value.trim(), category: saveCategory },
        force,
      );
      if (!res.ok) {
        setDup(res.duplicate);
        return;
      }
      // reflect it locally so it shows next time the list opens this session
      setAddresses((prev) => [
        ...prev,
        { id: res.id, name, address: value.trim(), category: saveCategory },
      ]);
      setDup(null);
      setSaving(false);
      setSaved(true);
      setOpen(false);
    });
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        type="text"
        name="location"
        autoComplete="off"
        maxLength={200}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
          setSaved(false);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Optional — pick a saved place or type a new address"
        className={fieldClassName}
      />

      {saved && (
        <p className="mt-1 text-xs text-emerald-600">Saved to your address book.</p>
      )}

      {open && loaded && (matches.length > 0 || canSave) && (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-2xl border border-hairline bg-surface py-1 shadow-xl">
          {q ? (
            matches.map((a) => <Row key={a.id} a={a} onPick={pick} />)
          ) : (
            <Grouped list={matches} onPick={pick} />
          )}

          {canSave && !saving && (
            <button
              type="button"
              onClick={() => {
                setSaving(true);
                setDup(null);
                setSaveName("");
                setSaveCategory(defaultCategory ?? "General");
              }}
              className="mt-1 flex w-full items-center gap-2 border-t border-hairline px-4 py-2.5 text-left text-sm text-accent hover:bg-ink/5"
            >
              <span className="text-base leading-none">＋</span>
              Save “{value.trim()}” for next time
            </button>
          )}

          {saving && (
            <div className="border-t border-hairline p-3">
              {dup ? (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900">
                  <p>
                    Already saved as <strong>{dup.name}</strong> — {dup.address}.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setValue(dup.address);
                        setDup(null);
                        setSaving(false);
                        setOpen(false);
                      }}
                      className="rounded-lg bg-accent px-2.5 py-1.5 font-medium text-white"
                    >
                      Use that one
                    </button>
                    <button
                      type="button"
                      onClick={() => doSave(true)}
                      disabled={pending}
                      className="rounded-lg px-2.5 py-1.5 text-muted hover:bg-ink/5"
                    >
                      Save anyway
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    placeholder="Short name (e.g. Grocery store)"
                    className="w-full rounded-lg border border-hairline bg-ground/40 px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                  <div className="flex items-center gap-2">
                    <select
                      value={saveCategory}
                      onChange={(e) => setSaveCategory(e.target.value)}
                      className="min-w-0 flex-1 rounded-lg border border-hairline bg-ground/40 px-2 py-2 text-sm outline-none focus:border-accent"
                    >
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => doSave(false)}
                      disabled={pending || !saveName.trim()}
                      className="shrink-0 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ a, onPick }: { a: PickerAddress; onPick: (a: PickerAddress) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPick(a)}
      className="block w-full px-4 py-2 text-left hover:bg-ink/5"
    >
      <span className="block truncate text-sm font-medium">{a.name}</span>
      <span className="block truncate text-xs text-muted">{a.address}</span>
    </button>
  );
}

function Grouped({
  list,
  onPick,
}: {
  list: PickerAddress[];
  onPick: (a: PickerAddress) => void;
}) {
  const groups: [string, PickerAddress[]][] = [];
  for (const a of list) {
    const last = groups[groups.length - 1];
    if (last && last[0] === a.category) last[1].push(a);
    else groups.push([a.category, [a]]);
  }
  return (
    <>
      {groups.map(([cat, items]) => (
        <div key={cat}>
          <p className="px-4 pb-0.5 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
            {cat}
          </p>
          {items.map((a) => (
            <Row key={a.id} a={a} onPick={onPick} />
          ))}
        </div>
      ))}
    </>
  );
}

/** Prefix matches (on name or address) first, then substring, then by name. */
function rank(list: PickerAddress[], q: string): PickerAddress[] {
  const scored: { a: PickerAddress; s: number }[] = [];
  for (const a of list) {
    const name = a.name.toLowerCase();
    const addr = a.address.toLowerCase();
    let s: number | null = null;
    if (name.startsWith(q) || addr.startsWith(q)) s = 0;
    else if (name.includes(q) || addr.includes(q)) s = 1;
    if (s !== null) scored.push({ a, s });
  }
  scored.sort((x, y) => x.s - y.s || x.a.name.localeCompare(y.a.name));
  return scored.map((x) => x.a);
}
