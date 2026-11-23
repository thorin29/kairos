import { describe, expect, it } from "vitest";
import { sameStreetAddress, streetKey } from "@/lib/places/address-match";

describe("address-match", () => {
  it("matches the same street address written differently", () => {
    expect(sameStreetAddress("100 Example Pkwy, Springfield, TX 75000", "100 Example Parkway, Springfield, TX 75000, USA")).toBe(true);
    expect(sameStreetAddress("200 Main St Ste 100, Springfield", "200 Main Street, Springfield, USA")).toBe(true);
    expect(sameStreetAddress("300 Oak Blvd #108, Springfield", "300 Oak Blvd, Springfield")).toBe(true);
  });

  it("doesn't match a neighbour or a nameless address", () => {
    expect(sameStreetAddress("100 Example Pkwy, Springfield", "102 Example Pkwy, Springfield")).toBe(false);
    expect(streetKey("Springfield, TX 75000, USA")).toBeNull();
  });
});
