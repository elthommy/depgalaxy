import { describe, expect, it } from "vitest";
import { useGalaxyStore } from "./store";
import { node, pathResult, sampleView } from "./test/fixtures";

const store = () => useGalaxyStore.getState();

describe("galaxy store", () => {
  it("toggles a pack in and out of the collapsed set", () => {
    store().togglePack("pack:net");
    expect(store().collapsed).toEqual(["pack:net"]);
    store().togglePack("pack:net");
    expect(store().collapsed).toEqual([]);
  });

  it("collapseAll keeps packs already collapsed but absent from the view", () => {
    useGalaxyStore.setState({ collapsed: ["pack:hidden"] });
    store().setView(sampleView());
    store().collapseAll();
    expect(store().collapsed.sort()).toEqual(["pack:hidden", "pack:net"]);
    store().expandAll();
    expect(store().collapsed).toEqual([]);
  });

  it("focusNode selects and bumps the focus sequence", () => {
    store().focusNode("curl");
    store().focusNode("curl");
    expect(store().selectedId).toBe("curl");
    expect(store().focus).toEqual({ id: "curl", seq: 2 });
  });

  it("setView clears a previous error", () => {
    store().setViewError("boom");
    store().setView({ nodes: [node("a")], edges: [] });
    expect(store().viewError).toBeNull();
  });

  it("picks a path: start, then target", () => {
    store().startPathPick("curl");
    expect(store().pathFrom).toBe("curl");
    store().pickPathTarget("libz");
    expect(store().pathFrom).toBeNull();
    expect(store().pathEnds).toEqual({ source: "curl", target: "libz" });
  });

  it("ignores a target when no pick is in progress", () => {
    store().pickPathTarget("libz");
    expect(store().pathEnds).toBeNull();
  });

  it("a new pick drops the previous result", () => {
    store().startPathPick("a");
    store().pickPathTarget("b");
    store().setPath(pathResult("a", "b"));
    store().startPathPick("a");
    store().pickPathTarget("c");
    expect(store().path).toBeNull();
    expect(store().pathEnds).toEqual({ source: "a", target: "c" });
  });

  it("cancelPathPick and clearPath", () => {
    store().startPathPick("a");
    store().cancelPathPick();
    expect(store().pathFrom).toBeNull();
    useGalaxyStore.setState({ pathEnds: { source: "a", target: "b" }, path: pathResult("a", "b") });
    store().clearPath();
    expect([store().pathEnds, store().path, store().pathError]).toEqual([null, null, null]);
  });

  it("setPath clears a previous path error", () => {
    store().setPathError("boom");
    store().setPath(pathResult("a", "b"));
    expect(store().pathError).toBeNull();
  });

  it("hard deps only is off by default and survives a new pick", () => {
    expect(store().hardDepsOnly).toBe(false);
    store().setHardDepsOnly(true);
    store().startPathPick("a");
    store().pickPathTarget("b");
    store().clearPath();
    expect(store().hardDepsOnly).toBe(true);
  });

  it("toggling hard deps only drops the stale result", () => {
    useGalaxyStore.setState({ pathEnds: { source: "a", target: "b" }, path: pathResult("a", "b") });
    store().setHardDepsOnly(true);
    expect(store().path).toBeNull();
    expect(store().pathEnds).toEqual({ source: "a", target: "b" });
  });

  it("loadNewGraph resets view parameters and bumps the epoch", () => {
    useGalaxyStore.setState({ collapsed: ["p"], depth: 2, root: "r", selectedId: "s" });
    useGalaxyStore.setState({ pathFrom: "x", pathEnds: { source: "a", target: "b" } });
    store().loadNewGraph();
    const s = store();
    expect([s.pathFrom, s.pathEnds, s.path]).toEqual([null, null, null]);
    expect([s.collapsed, s.depth, s.root, s.selectedId, s.focus]).toEqual([[], null, null, null, null]);
    expect(s.graphEpoch).toBe(1);
  });
});
