// Mirrors the backend pydantic view models (stellardeps/graph_engine.py).

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
}
