// Dependency-free so it can be tested on its own and shared by the web
// banner (family-goal-banner.tsx) and the device payload (/api/v1/coop).
/**
 * What the home page should say while no goal is chosen yet, for whoever is
 * looking — the one rule for the web banner and the app's home card.
 *
 *   "vote" — a child who hasn't voted this month; on the shared screen, until
 *            every child has voted.
 *   "pick" — a parent or admin: they may vote but don't need to, and choosing
 *            the goal is their job, so their prompt is to pick one.
 *   null   — nothing to say: no ideas, a goal already chosen or carried, or
 *            this viewer (or, on the shared screen, every child) has voted.
 *
 * `viewer` is null on the shared screen. `viewerIsParent` covers both a parent
 * account and an admin.
 */
export type CoopHomeNudge = "vote" | "pick" | null;

export function coopHomeNudge(
  data: {
    carried: unknown;
    selected: unknown;
    granted: unknown;
    proposals: { voterIds: string[] }[];
    children: { id: string }[];
  },
  viewer: { id: string; isParent: boolean } | null,
): CoopHomeNudge {
  if (data.carried || data.selected || data.granted) return null;
  if (data.proposals.length === 0) return null;
  const votedThisMonth = (id: string) => data.proposals.some((p) => p.voterIds.includes(id));
  if (viewer) {
    if (viewer.isParent) return "pick";
    return votedThisMonth(viewer.id) ? null : "vote";
  }
  const allChildrenVoted =
    data.children.length > 0 && data.children.every((c) => votedThisMonth(c.id));
  return allChildrenVoted ? null : "vote";
}
