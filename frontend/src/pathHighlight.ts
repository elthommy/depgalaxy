import type { PathResult } from "./types";

/** The view nodes and edges to highlight for a path result. */
export interface PathHighlight {
  nodes: Set<string>;
  edges: Set<string>;
}

/** A link endpoint before (id) or after (node object) react-force-graph resolves it. */
type Endpoint = string | number | { id?: string | number } | undefined;

function endpointId(end: Endpoint): string {
  return String(typeof end === "object" ? end.id : end);
}

/** Key identifying a directed edge between two view nodes. */
export function edgeKey(source: Endpoint, target: Endpoint): string {
  return `${endpointId(source)}→${endpointId(target)}`;
}

/** Sets to highlight, or null when there is nothing to highlight (no result, or no path). */
export function pathHighlight(path: PathResult | null): PathHighlight | null {
  if (path === null || path.direction === null) return null;
  return {
    nodes: new Set(path.highlight_nodes),
    edges: new Set(path.highlight_edges.map((e) => edgeKey(e.source, e.target))),
  };
}
