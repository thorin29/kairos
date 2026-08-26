"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { ArrowLeftIcon, CheckIcon } from "@/components/icons";
import { completeTrip, setPurchased } from "@/lib/actions/groceries";
import type { ShoppingItemView, StoreView, TripView } from "@/lib/queries/groceries";

export function CartView({
  store,
  trip,
  interactive,
}: {
  store: StoreView;
  trip: TripView;
  interactive: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Optimistic purchased state, reset when the server sends fresh data.
  const [optimistic, setOptimistic] = useState<Map<string, boolean>>(new Map());
  useEffect(() => setOptimistic(new Map()), [trip]);

  const isPurchased = (item: ShoppingItemView) =>
    optimistic.has(item.id) ? !!optimistic.get(item.id) : item.purchased;

  const toggle = (item: ShoppingItemView) => {
    if (!interactive) return;
    const now = !isPurchased(item);
    setOptimistic((m) => new Map(m).set(item.id, now));
    startTransition(() => setPurchased(item.id, now));
  };

  const complete = () => {
    startTransition(async () => {
      await completeTrip(trip.id);
      router.push("/groceries");
    });
  };

  const got = trip.items.filter(isPurchased).length;
  const total = trip.items.length;
  const pct = total === 0 ? 0 : Math.round((got / total) * 100);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href="/groceries"
          className="inline-flex h-11 items-center gap-1.5 rounded-full border border-hairline bg-surface px-4 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          List
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="text-2xl" aria-hidden>
            {store.icon}
          </span>
          <div className="min-w-0">
            <h1 className="truncate font-display text-xl font-semibold leading-tight">
              {store.name}
            </h1>
            <p className="text-xs text-muted">
              {interactive ? "You’re shopping" : `${trip.shopper.name} is shopping`}
            </p>
          </div>
        </div>
        <span className="tabular shrink-0 text-sm font-medium text-muted">
          {got}/{total}
        </span>
      </div>

      {total > 0 && (
        <div className="h-2 overflow-hidden rounded-full bg-ground/60">
          <div
            className="h-full rounded-full bg-accent transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {total > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-hairline bg-surface divide-y divide-hairline">
          {trip.items.map((item) => {
            const done = isPurchased(item);
            const inner = (
              <>
                <span
                  className={[
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    done
                      ? "border-accent bg-accent text-white"
                      : "border-hairline text-transparent",
                  ].join(" ")}
                >
                  <CheckIcon className="h-5 w-5" />
                </span>
                <span className="text-2xl" aria-hidden>
                  {item.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={[
                      "block truncate text-base font-medium",
                      done ? "text-muted line-through" : "",
                    ].join(" ")}
                  >
                    {item.name}
                  </span>
                  {item.note && (
                    <span className="block truncate text-sm text-muted">
                      {item.note}
                    </span>
                  )}
                </span>
                {item.assignee && (
                  <Avatar
                    name={item.assignee.name}
                    color={item.assignee.color}
                    avatarPath={item.assignee.avatarPath}
                    avatarPosition={item.assignee.avatarPosition}
                    size="sm"
                  />
                )}
              </>
            );
            return interactive ? (
              <button
                key={item.id}
                type="button"
                onClick={() => toggle(item)}
                disabled={pending}
                className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-accent/5 active:bg-accent/10 disabled:opacity-60"
              >
                {inner}
              </button>
            ) : (
              <div key={item.id} className="flex items-center gap-4 px-4 py-4">
                {inner}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-hairline bg-surface p-8 text-center">
          <p className="text-sm text-muted">
            Nothing on this trip yet
            {interactive ? " — add items from the list and they’ll appear here." : "."}
          </p>
        </div>
      )}

      {interactive && (
        <button
          type="button"
          onClick={complete}
          disabled={pending}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md disabled:opacity-50"
        >
          <CheckIcon className="h-4 w-4" />
          Complete trip
        </button>
      )}
    </div>
  );
}
