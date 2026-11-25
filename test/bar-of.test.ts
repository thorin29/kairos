import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import { barOf } from "@/lib/queries/workout-log";

describe("barOf", () => {
  it("reads the bar from equipment keys", () => {
    expect(barOf("barbell")).toBe("barbell");
    expect(barOf("barbell,boxes")).toBe("barbell");
    expect(barOf(" ez_bar ")).toBe("ez");
    expect(barOf("barbell,ez_bar")).toBe("ez");
  });
  it("is null off a bar", () => {
    expect(barOf("dumbbells")).toBeNull();
    expect(barOf("")).toBeNull();
    expect(barOf(null)).toBeNull();
    expect(barOf(undefined)).toBeNull();
  });
});
