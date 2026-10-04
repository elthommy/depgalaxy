import type { GraphView, ViewEdge, ViewNode } from "../types";

/** Build a ViewNode with sensible defaults. */
export function node(id: string, overrides: Partial<ViewNode> = {}): ViewNode {
  return {
    id,
    label: id,
    kind: "library",
    attrs: {},
    is_pack: false,
    collapsed: false,
    member_count: 0,
    parent: null,
    ...overrides,
  };
}

/** Build a ViewEdge with an optional link_type attribute. */
export function edge(source: string, target: string, linkType?: string): ViewEdge {
  return {
    source,
    target,
    relation: "depends_on",
    attrs: linkType ? { link_type: linkType } : {},
    weight: 1,
  };
}

/** A small view: one pack holding two libraries, plus a standalone binary. */
export function sampleView(): GraphView {
  return {
    nodes: [
      node("pack:net", { label: "net", kind: "pack", is_pack: true, member_count: 2 }),
      node("libssl", { parent: "pack:net" }),
      node("libz", { parent: "pack:net" }),
      node("curl", { kind: "binary" }),
    ],
    edges: [edge("curl", "libssl", "dynamic"), edge("curl", "libz", "static")],
  };
}
