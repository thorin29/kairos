import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
import { tallyByDay, type TaskRow } from "@/lib/queries/completion";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const task = (due: string, doneAt: string | null, lateAfter: string | null = null): TaskRow => ({
  id: due + (doneAt ?? ""), userId: "u", title: "t", category: "CHORE",
  status: doneAt ? "COMPLETE" : "PENDING", dueDate: d(due), lateAfter: lateAfter ? d(lateAfter) : null,
  completedAt: doneAt ? new Date(`${doneAt}T18:00:00.000Z`) : null,
});

describe("tallyByDay", () => {
  it("counts on-time work on its due day", () => {
    const t = tallyByDay([task("2026-11-02", "2026-11-02"), task("2026-11-02", null)]);
    expect(t.get("2026-11-02")).toEqual({ due: 2, done: 1, late: false });
  });
  it("counts late work as missed on the due day and done on the day finished", () => {
    const t = tallyByDay([task("2026-11-02", "2026-11-04")]);
    expect(t.get("2026-11-02")).toEqual({ due: 1, done: 0, late: false });
    expect(t.get("2026-11-04")).toEqual({ due: 1, done: 1, late: true });
  });
  it("keeps an anytime chore on time through its last day", () => {
    const t = tallyByDay([task("2026-11-02", "2026-11-05", "2026-11-07")]);
    expect(t.get("2026-11-02")).toEqual({ due: 1, done: 1, late: false });
    expect(t.has("2026-11-05")).toBe(false);
  });
});
