/**
 * The muscle groups the progress view opens on (v0.638): today's, else the
 * next planned day's — what you're about to train, not what you did
 * yesterday. Empty when nothing ahead in the week names a group.
 */
export function focusGroups(planDays: readonly { day: number; groups: readonly string[] }[], todayDow: number): string[] {
  for (let ahead = 0; ahead < 7; ahead++) {
    const d = (todayDow + ahead) % 7;
    const groups = planDays.find((p) => p.day === d)?.groups ?? [];
    if (groups.length > 0) return [...groups];
  }
  return [];
}
