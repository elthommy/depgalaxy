// Mirrors the backend pydantic view models (depgalaxy/graph_engine.py).

export interface ViewNode {
  id: string;
  label: string;
  kind: string;
  attrs: Record<string, unknown>;
  is_pack: boolean;
  collapsed: boolean;
  member_count: number;
  parent: string | null;
}

export interface ViewEdge {
  source: string;
  target: string;
  relation: string;
  attrs: Record<string, unknown>;
  weight: number;
}

export interface GraphView {
  nodes: ViewNode[];
  edges: ViewEdge[];
}

export interface NodeRef {
  id: string;
  label: string;
  kind: string;
}

export interface DepRef extends NodeRef {
  link_type: string | null;
}

export interface NodeDetails {
  id: string;
  label: string;
  kind: string;
  attrs: Record<string, unknown>;
  is_pack: boolean;
  parent: NodeRef | null;
  members: NodeRef[];
  deps: DepRef[];
  reverse_deps: DepRef[];
  edges_in: number;
  edges_out: number;
  edge_attrs: Record<string, Record<string, number>>;
  hops_deep: number | null;
}

export interface FeedInfo {
  id: string;
  label: string;
  description: string;
  kind: string;
  available: boolean;
}

export interface ImportCounts {
  nodes: number;
  edges: number;
  packs: number;
}

export interface PathEdge {
  source: string;
  target: string;
}

/** Mirrors PathResult: all shortest dependency paths between two nodes. */
export interface PathResult {
  source: string;
  target: string;
  // paths run in dependency order: source -> target when "forward",
  // target -> source when "reverse"; null when no path exists
  direction: "forward" | "reverse" | null;
  hops: number | null;
  path_count: number;
  paths: NodeRef[][];
  truncated: boolean;
  // mapped onto the visible view nodes for the requested collapsed packs
  highlight_nodes: string[];
  highlight_edges: PathEdge[];
}
