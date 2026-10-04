import { describe, expect, it, vi } from "vitest";
import { fetchGraph, fetchNode, runFeed } from "./api";

function stubFetch(body: unknown, init: { status?: number } = {}) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status: init.status ?? 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("fetchGraph", () => {
  it("omits empty parameters", async () => {
    const fetchMock = stubFetch({ nodes: [], edges: [] });
    await fetchGraph({ collapsed: [], depth: null, root: null });
    expect(fetchMock).toHaveBeenCalledWith("/api/graph?", undefined);
  });

  it("encodes collapsed packs, root and depth", async () => {
    const fetchMock = stubFetch({ nodes: [], edges: [] });
    await fetchGraph({ collapsed: ["a", "b"], depth: 2, root: "curl" });
    const url = new URL(fetchMock.mock.calls[0][0], "http://x");
    expect(url.pathname).toBe("/api/graph");
    expect(url.searchParams.get("collapsed")).toBe("a,b");
    expect(url.searchParams.get("root")).toBe("curl");
    expect(url.searchParams.get("depth")).toBe("2");
  });
});

describe("request errors", () => {
  it("surfaces the backend detail message", async () => {
    stubFetch({ detail: "no graph imported" }, { status: 404 });
    await expect(fetchNode("x")).rejects.toThrow("404: no graph imported");
  });
});

describe("ids in paths", () => {
  it("are URL-encoded", async () => {
    const fetchMock = stubFetch({ nodes: 1, edges: 0, packs: 0 });
    await runFeed("pacman/core extra");
    expect(fetchMock).toHaveBeenCalledWith("/api/feeds/pacman%2Fcore%20extra/run", {
      method: "POST",
    });
  });
});
