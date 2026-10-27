import { describe, expect, it } from "vitest";
import { scoringGuide } from "@/lib/scoring/guide";
import { CLEAN_DAY_STAGES, DEEPEN_GROWTH } from "@/lib/companions";

describe("How scoring works", () => {
  it("quotes the live numbers", () => {
    const text = scoringGuide({ monthTarget: 17 }).flatMap((s) => s.lines).join(" ");
    expect(text).toContain(`juvenile at ${CLEAN_DAY_STAGES[1]}`);
    expect(text).toContain(`adult at ${CLEAN_DAY_STAGES[2]}`);
    expect(text).toContain(`growing it ${DEEPEN_GROWTH} more`);
    expect(text).toContain("has 17 days this month");
  });
});
