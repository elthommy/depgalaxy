import { describe, expect, it } from "vitest";
import { useGalaxyStore } from "./store";
import { node, sampleView } from "./test/fixtures";

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

  it("loadNewGraph resets view parameters and bumps the epoch", () => {
    useGalaxyStore.setState({ collapsed: ["p"], depth: 2, root: "r", selectedId: "s" });
    store().loadNewGraph();
    const s = store();
    expect([s.collapsed, s.depth, s.root, s.selectedId, s.focus]).toEqual([[], null, null, null, null]);
    expect(s.graphEpoch).toBe(1);
  });
});
