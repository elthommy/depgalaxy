import { describe, expect, it } from "vitest";
import { edgeKey, pathHighlight } from "./pathHighlight";
import { pathResult } from "./test/fixtures";

describe("pathHighlight", () => {
  it("is null without a result or without a path", () => {
    expect(pathHighlight(null)).toBeNull();
    expect(pathHighlight({ ...pathResult("a", "b"), direction: null })).toBeNull();
  });

  it("indexes the highlighted nodes and directed edges", () => {
    const highlight = pathHighlight(pathResult("a", "b"))!;
    expect([...highlight.nodes]).toEqual(["a", "b"]);
    expect(highlight.edges.has(edgeKey("a", "b"))).toBe(true);
    expect(highlight.edges.has(edgeKey("b", "a"))).toBe(false);
  });
});

describe("edgeKey", () => {
  it("accepts ids and resolved node objects alike", () => {
    expect(edgeKey({ id: "a" }, { id: "b" })).toBe(edgeKey("a", "b"));
  });
});
