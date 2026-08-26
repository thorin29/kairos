"use client";

import { useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import { TrophyIcon, CheckIcon, PlusIcon, TrashIcon } from "@/components/icons";
import {
  proposeCoopReward,
  toggleCoopVote,
  selectCoopReward,
  grantCoopReward,
  removeCoopProposal,
  setCoopFloor,
} from "@/lib/actions/coop";
import type { CoopData, CoopProposalView } from "@/lib/queries/coop";

export function CoopBoard({ data, isAdmin }: { data: CoopData; isAdmin: boolean }) {
  const meterPct = data.childrenTotal
    ? Math.round((data.childrenMeeting / data.childrenTotal) * 100)
    : 0;

  return (
    <div className="space-y-8">
      {/* Meter */}
      <section className="rounded-2xl border border-hairline bg-surface p-5">
        <div className="mb-1 flex items-center justify-between">
          <p className="font-display text-lg font-semibold">Family goal</p>
          <span className="tabular text-sm text-muted">
            {data.childrenMeeting} of {data.childrenTotal} kids at tier {data.floor}+
          </span>
        </div>

        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-hairline">
          <div
            className={`h-full rounded-full ${data.gateMet ? "bg-emerald-500" : "bg-accent"}`}
            style={{ width: `${meterPct}%` }}
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {data.children.map((c) => (
            <span
              key={c.id}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                c.meets
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-hairline text-muted"
              }`}
              title={`Season tier ${c.tier}`}
            >
              <Avatar name={c.name} color={c.color} avatarPath={c.avatarPath} avatarPosition={c.avatarPosition} size="xs" />
              {c.name}
              {c.meets ? <CheckIcon className="h-3.5 w-3.5" /> : <span className="tabular">t{c.tier}</span>}
            </span>
          ))}
          {data.childrenTotal === 0 && (
            <span className="text-sm text-muted">
              No child accounts yet — set someone to Child in Setup.
            </span>
          )}
        </div>

        <StatusLine data={data} isAdmin={isAdmin} />
      </section>

      {/* Proposals + voting */}
      <section>
        <h2 className="mb-3 text-[0.65rem] font-semibold uppercase tracking-widest text-muted">
          Reward ideas &mdash; propose one, everyone votes
        </h2>
        <div className="space-y-3">
          {data.proposals.length === 0 && (
            <p className="text-sm text-muted">
              No ideas yet. Add the first family reward below.
            </p>
          )}
          {[...data.proposals]
            .sort((a, b) => b.votes - a.votes)
            .map((p) => (
              <ProposalCard
                key={p.id}
                proposal={p}
                people={data.people}
                isAdmin={isAdmin}
                canGrant={data.gateMet}
              />
            ))}
        </div>

        <ProposeForm people={data.people} />
      </section>

      {isAdmin && <FloorControl floor={data.floor} />}
    </div>
  );
}

function StatusLine({ data, isAdmin }: { data: CoopData; isAdmin: boolean }) {
  const [pending, start] = useTransition();

  if (data.granted) {
    return (
      <p className="mt-4 flex items-center gap-2 text-sm font-medium text-emerald-700">
        <TrophyIcon className="h-4 w-4" />
        Earned: {data.granted.title} &mdash; enjoy!
      </p>
    );
  }
  if (!data.selected) {
    return (
      <p className="mt-4 text-sm text-muted">
        No reward chosen yet{isAdmin ? " — pick one from the ideas below." : "."}
      </p>
    );
  }
  return (
    <div className="mt-4">
      <p className="text-sm">
        Working toward: <span className="font-medium">{data.selected.title}</span>
      </p>
      {data.gateMet ? (
        isAdmin ? (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await grantCoopReward(data.selected!.id);
                if (r.error) alert(r.error);
              })
            }
            className="mt-2 inline-flex h-10 items-center gap-1.5 rounded-full bg-emerald-600 px-5 text-sm font-medium text-white shadow-sm hover:brightness-110 disabled:opacity-50"
          >
            <TrophyIcon className="h-4 w-4" />
            {pending ? "Granting\u2026" : "Grant the reward"}
          </button>
        ) : (
          <p className="mt-1 text-sm font-medium text-emerald-700">
            Everyone made it! Waiting for a parent to hand it out.
          </p>
        )
      ) : (
        <p className="mt-1 text-xs text-muted">
          Unlocks when every kid reaches tier {data.floor}.
        </p>
      )}
    </div>
  );
}

function ProposalCard({
  proposal,
  people,
  isAdmin,
  canGrant,
}: {
  proposal: CoopProposalView;
  people: CoopData["people"];
  isAdmin: boolean;
  canGrant: boolean;
}) {
  const [pending, start] = useTransition();
  const voters = new Set(proposal.voterIds);
  const selected = proposal.status === "SELECTED";
  const granted = proposal.status === "GRANTED";

  return (
    <div
      className={`rounded-2xl border p-4 ${
        selected || granted ? "border-accent bg-accent/5" : "border-hairline bg-surface"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {proposal.title}
            {selected && <span className="ml-2 text-xs font-semibold text-accent">CHOSEN</span>}
            {granted && <span className="ml-2 text-xs font-semibold text-emerald-700">GRANTED</span>}
          </p>
          {proposal.detail && <p className="mt-0.5 text-sm text-muted">{proposal.detail}</p>}
          <p className="mt-0.5 text-xs text-muted">
            by {proposal.proposedByName} &middot; {proposal.votes}{" "}
            {proposal.votes === 1 ? "vote" : "votes"}
          </p>
        </div>
        {isAdmin && !granted && (
          <div className="flex shrink-0 items-center gap-1.5">
            {!selected && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await selectCoopReward(proposal.id);
                    if (r.error) alert(r.error);
                  })
                }
                className="inline-flex h-8 items-center rounded-full border border-hairline px-3 text-xs font-medium hover:border-accent hover:text-accent disabled:opacity-50"
              >
                Make the goal
              </button>
            )}
            <button
              type="button"
              aria-label="Remove"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await removeCoopProposal(proposal.id);
                  if (r.error) alert(r.error);
                })
              }
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-ink/5 hover:text-ink disabled:opacity-50"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Vote row: tap your face */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {people.map((person) => {
          const voted = voters.has(person.id);
          return (
            <button
              key={person.id}
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await toggleCoopVote({ proposalId: proposal.id, userId: person.id });
                })
              }
              title={`${voted ? "Remove" : "Add"} ${person.name}'s vote`}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors disabled:opacity-50 ${
                voted
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-hairline text-muted hover:border-accent"
              }`}
            >
              <Avatar name={person.name} color={person.color} avatarPath={person.avatarPath} avatarPosition={person.avatarPosition} size="xs" />
              {person.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ProposeForm({ people }: { people: CoopData["people"] }) {
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [who, setWho] = useState(people[0]?.id ?? "");
  const [pending, start] = useTransition();

  return (
    <div className="mt-5 rounded-2xl border border-hairline bg-surface p-4">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
        <PlusIcon className="h-4 w-4" /> Propose a reward
      </p>
      <div className="space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Movie & pizza night"
          className="h-10 w-full rounded-lg border border-hairline bg-surface px-3 text-sm"
        />
        <input
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="Optional: what / when"
          className="h-10 w-full rounded-lg border border-hairline bg-surface px-3 text-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={who}
            onChange={(e) => setWho(e.target.value)}
            className="h-10 rounded-lg border border-hairline bg-surface px-3 text-sm"
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending || !title.trim()}
            onClick={() =>
              start(async () => {
                const r = await proposeCoopReward({ title, detail, proposedById: who });
                if (r.error) alert(r.error);
                else {
                  setTitle("");
                  setDetail("");
                }
              })
            }
            className="inline-flex h-10 items-center rounded-full bg-accent px-5 text-sm font-medium text-white shadow-sm hover:brightness-110 disabled:opacity-50"
          >
            {pending ? "Adding\u2026" : "Add idea"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FloorControl({ floor }: { floor: number }) {
  const [value, setValue] = useState(floor);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <section className="rounded-2xl border border-hairline bg-surface p-5">
      <p className="text-sm font-medium">Participation floor</p>
      <p className="mt-1 text-sm text-muted">
        Every child must reach this season tier for the reward to unlock. Doing
        all of your own work reaches tier 8, so 6 leaves headroom for the
        youngest. Check the Season planner to see what&rsquo;s reachable.
      </p>
      <div className="mt-3 flex items-center gap-4">
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={value}
          onChange={(e) => {
            setValue(Number(e.target.value));
            setSaved(false);
          }}
          className="flex-1 accent-[var(--color-accent)]"
        />
        <span className="tabular w-16 text-right text-sm font-semibold">Tier {value}</span>
        <button
          type="button"
          disabled={pending || value === floor}
          onClick={() =>
            start(async () => {
              const r = await setCoopFloor(value);
              if (r.error) alert(r.error);
              else setSaved(true);
            })
          }
          className="inline-flex h-10 items-center rounded-full bg-accent px-5 text-sm font-medium text-white shadow-sm hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Saving\u2026" : "Save"}
        </button>
        {saved && <span className="text-sm text-emerald-700">Saved</span>}
      </div>
    </section>
  );
}
