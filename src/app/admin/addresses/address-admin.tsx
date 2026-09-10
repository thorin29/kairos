"use client";

import { useState, useTransition } from "react";
import { Card, SectionHeading } from "@/components/ui";
import { PlusIcon, TrashIcon, XIcon } from "@/components/icons";
import {
  createSavedAddress,
  updateSavedAddress,
  deleteSavedAddress,
  approveSavedAddress,
  type CreateAddressResult,
} from "@/lib/actions/addresses";
import type { AdminAddress } from "@/lib/queries/addresses";

const field =
  "w-full rounded-xl border border-hairline bg-ground/40 px-4 py-2.5 text-sm outline-none focus:border-accent";
const primaryBtn =
  "inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-accent px-4 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50";
const ghostBtn =
  "inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium text-muted transition-colors hover:bg-ink/5";

type FormState = { name: string; address: string };

export function AddressAdmin({ addresses }: { addresses: AdminAddress[] }) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ name: "", address: "" });
  const [dup, setDup] = useState<{ id: string; name: string; address: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const approved = addresses
    .filter((a) => a.status === "APPROVED")
    .sort((a, b) => a.name.localeCompare(b.name));
  const awaiting = addresses.filter((a) => a.status === "PENDING");

  function openAdd() {
    setEditingId(null);
    setForm({ name: "", address: "" });
    setDup(null);
    setError(null);
    setOpen(true);
  }

  function openEdit(a: AdminAddress) {
    setEditingId(a.id);
    setForm({ name: a.name, address: a.address });
    setDup(null);
    setError(null);
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setDup(null);
    setError(null);
  }

  function save(addAnother: boolean, force = false) {
    if (!form.name.trim() || !form.address.trim()) {
      setError("A name and an address are both required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        if (editingId) {
          await updateSavedAddress(editingId, form);
          close();
        } else {
          const res: CreateAddressResult = await createSavedAddress(form, force);
          if (!res.ok) {
            setDup(res.duplicate);
            return;
          }
          setDup(null);
          if (addAnother) {
            setForm({ name: "", address: "" });
          } else {
            close();
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteSavedAddress(id);
      setConfirmDelete(null);
    });
  }

  function approve(id: string) {
    startTransition(async () => {
      await approveSavedAddress(id);
    });
  }

  return (
    <div className="space-y-8">
      <button type="button" onClick={openAdd} className={primaryBtn}>
        <PlusIcon className="h-4 w-4" /> Add address
      </button>

      {awaiting.length > 0 && (
        <section>
          <SectionHeading>Pending approval</SectionHeading>
          <Card className="mt-2 divide-y divide-hairline p-0">
            {awaiting.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.name}</p>
                  <p className="truncate text-xs text-muted">{a.address}</p>
                  {a.submittedBy && (
                    <p className="mt-0.5 truncate text-xs text-muted">from {a.submittedBy}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => remove(a.id)}
                    disabled={pending}
                    className="rounded-lg px-2.5 py-1.5 text-sm text-muted hover:bg-ink/5"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => approve(a.id)}
                    disabled={pending}
                    className="rounded-lg bg-accent px-2.5 py-1.5 text-sm font-semibold text-white hover:bg-accent/90"
                  >
                    Approve
                  </button>
                </div>
              </div>
            ))}
          </Card>
        </section>
      )}

      {approved.length === 0 ? (
        <Card className="p-6">
          <p className="text-sm text-muted">
            No addresses yet. Add your first with the button above.
          </p>
        </Card>
      ) : (
        <Card className="divide-y divide-hairline p-0">
          {approved.map((a) => (
            <div key={a.id} className="flex items-center gap-3 px-4 py-3">
              <button
                type="button"
                onClick={() => openEdit(a)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate text-sm font-medium">{a.name}</p>
                <p className="truncate text-xs text-muted">{a.address}</p>
              </button>
              {confirmDelete === a.id ? (
                <span className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(null)}
                    disabled={pending}
                    className="rounded-lg px-2.5 py-1.5 text-sm text-muted hover:bg-ink/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(a.id)}
                    disabled={pending}
                    className="rounded-lg bg-red-600 px-2.5 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
                  >
                    Delete
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(a.id)}
                  aria-label={`Delete ${a.name}`}
                  className="shrink-0 rounded-lg p-2 text-muted transition-colors hover:bg-red-500/10 hover:text-red-700"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </Card>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          onClick={close}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">
                {editingId ? "Edit address" : "Add address"}
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="rounded-lg p-1.5 text-muted hover:bg-ink/5"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Friendly name</label>
                <input
                  className={field}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Iceplex"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Full address</label>
                <textarea
                  className={`${field} min-h-[4.5rem] resize-none`}
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="1234 Main Rd, Lewisville, TX 75067"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              {dup && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  <p>
                    This looks like one you already have:{" "}
                    <strong>{dup.name}</strong> — {dup.address}. Save anyway?
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDup(null)}
                      className="rounded-lg px-3 py-1.5 text-sm text-muted hover:bg-ink/5"
                    >
                      Keep editing
                    </button>
                    <button
                      type="button"
                      onClick={() => save(false, true)}
                      disabled={pending}
                      className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700"
                    >
                      Save anyway
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button type="button" onClick={close} className={ghostBtn}>
                Cancel
              </button>
              {!editingId && (
                <button
                  type="button"
                  onClick={() => save(true)}
                  disabled={pending}
                  className={ghostBtn}
                >
                  Save &amp; add another
                </button>
              )}
              <button
                type="button"
                onClick={() => save(false)}
                disabled={pending}
                className={primaryBtn}
              >
                {editingId ? "Save changes" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
