import { describe, expect, it } from "vitest";
import { KIND_COLORS, kindColor, withAlpha } from "./palette";

describe("kindColor", () => {
  it("returns the design color for known kinds", () => {
    expect(kindColor("library")).toBe(KIND_COLORS.library);
    expect(kindColor("binary")).toBe(KIND_COLORS.binary);
  });

  it("is deterministic for unknown kinds", () => {
    expect(kindColor("widget")).toBe(kindColor("widget"));
    expect(kindColor("widget")).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("withAlpha", () => {
  it("converts hex to rgba", () => {
    expect(withAlpha("#22d3ee", 0.4)).toBe("rgba(34,211,238,0.4)");
  });
});
