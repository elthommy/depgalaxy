import type { GraphView, NodeDetails } from "./types";

export interface GraphParams {
  collapsed: string[];
  depth: number | null;
  root: string | null;
}

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const detail = await res.json().then((b) => b.detail).catch(() => res.statusText);
    throw new Error(`${res.status}: ${detail}`);
  }
  return res.json();
}

export function fetchGraph({ collapsed, depth, root }: GraphParams): Promise<GraphView> {
  const qs = new URLSearchParams();
  if (collapsed.length > 0) qs.set("collapsed", collapsed.join(","));
  if (root !== null) {
    qs.set("root", root);
    if (depth !== null) qs.set("depth", String(depth));
  }
  return get(`/api/graph?${qs}`);
}

export function fetchNode(id: string): Promise<NodeDetails> {
  return get(`/api/node/${encodeURIComponent(id)}`);
}
