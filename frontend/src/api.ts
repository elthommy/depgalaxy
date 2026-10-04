import type { FeedInfo, GraphView, ImportCounts, NodeDetails, PathResult } from "./types";

export interface GraphParams {
  collapsed: string[];
  depth: number | null;
  root: string | null;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const detail = await res.json().then((b) => b.detail).catch(() => res.statusText);
    throw new Error(`${res.status}: ${detail}`);
  }
  return res.json();
}

export function fetchGraph({ collapsed, depth, root }: GraphParams): Promise<GraphView> {
  const qs = new URLSearchParams();
  if (collapsed.length > 0) qs.set("collapsed", collapsed.join(","));
  if (root !== null) qs.set("root", root);
  if (depth !== null) qs.set("depth", String(depth));
  return request(`/api/graph?${qs}`);
}

export function fetchNode(id: string): Promise<NodeDetails> {
  return request(`/api/node/${encodeURIComponent(id)}`);
}

export function fetchPath(
  source: string,
  target: string,
  collapsed: string[],
  exclude: string[] = [],
): Promise<PathResult> {
  const qs = new URLSearchParams({ from: source, to: target });
  if (collapsed.length > 0) qs.set("collapsed", collapsed.join(","));
  if (exclude.length > 0) qs.set("exclude", exclude.join(","));
  return request(`/api/path?${qs}`);
}

export function fetchFeeds(): Promise<FeedInfo[]> {
  return request("/api/feeds");
}

export function runFeed(id: string): Promise<ImportCounts> {
  return request(`/api/feeds/${encodeURIComponent(id)}/run`, { method: "POST" });
}
