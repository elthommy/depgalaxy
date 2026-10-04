"""Pure graph engine: hierarchy validation, collapse views, depth slicing.

Everything in this module is a pure function of its inputs and knows
nothing about FastAPI or HTTP.
"""

from collections.abc import Iterable
from dataclasses import dataclass
from typing import Literal

import networkx as nx
from pydantic import BaseModel, Field

from stellardeps.models import Edge, GraphPayload, Node


class GraphValidationError(ValueError):
    """Raised when a payload or view request violates a graph invariant."""


# the only relation traversed by depth slicing / hops computations;
# other relations (e.g. conflicts_with) are displayed but never followed
DEP_RELATION = "depends_on"

# at most this many shortest paths are listed in a PathResult
MAX_LISTED_PATHS = 10


@dataclass(frozen=True)
class DepGraph:
    """A validated, immutable in-memory dependency graph."""

    nodes: dict[str, Node]
    edges: tuple[Edge, ...]
    parent: dict[str, str]
    children: dict[str, tuple[str, ...]]


class ViewNode(BaseModel):
    """A node as it appears in a computed view."""

    id: str
    label: str
    kind: str
    attrs: dict = Field(default_factory=dict)
    is_pack: bool = False
    collapsed: bool = False
    member_count: int = 0
    parent: str | None = None


class ViewEdge(BaseModel):
    """An edge in a computed view; `weight` counts the aggregated underlying edges."""

    source: str
    target: str
    relation: str = "depends_on"
    attrs: dict = Field(default_factory=dict)
    weight: int = 1


class GraphView(BaseModel):
    """The computed view returned by GET /graph."""

    nodes: list[ViewNode]
    edges: list[ViewEdge]


class NodeRef(BaseModel):
    """A lightweight reference to a node."""

    id: str
    label: str
    kind: str


class DepRef(NodeRef):
    """A dependency reference including the connecting edge's link type."""

    link_type: str | None = None


class NodeDetails(BaseModel):
    """The detail payload returned by GET /node/{id}.

    For packs, deps/reverse_deps/edge counts aggregate the members'
    external edges (edges crossing the pack boundary).
    """

    id: str
    label: str
    kind: str
    attrs: dict = Field(default_factory=dict)
    is_pack: bool = False
    parent: NodeRef | None = None
    members: list[NodeRef] = Field(default_factory=list)
    deps: list[DepRef] = Field(default_factory=list)
    reverse_deps: list[DepRef] = Field(default_factory=list)
    edges_in: int = 0
    edges_out: int = 0
    edge_attrs: dict[str, dict[str, int]] = Field(default_factory=dict)
    hops_deep: int | None = None


class PathEdge(BaseModel):
    """A highlighted dependency edge between two visible view nodes."""

    source: str
    target: str


class PathResult(BaseModel):
    """The shortest dependency paths between two nodes, returned by GET /path.

    Paths always run in dependency order (each node depends on the next):
    from source to target when `direction` is "forward", from target to
    source when it is "reverse". `direction` is None when no path exists.
    `highlight_nodes` / `highlight_edges` cover every shortest path, mapped
    onto the visible representatives for the requested collapsed packs.
    """

    source: str
    target: str
    direction: Literal["forward", "reverse"] | None = None
    hops: int | None = None
    path_count: int = 0
    paths: list[list[NodeRef]] = Field(default_factory=list)
    truncated: bool = False
    highlight_nodes: list[str] = Field(default_factory=list)
    highlight_edges: list[PathEdge] = Field(default_factory=list)


def build_graph(payload: GraphPayload) -> DepGraph:
    """Validate a payload and return an immutable DepGraph."""
    nodes: dict[str, Node] = {}
    for node in payload.nodes:
        if node.id in nodes:
            raise GraphValidationError(f"duplicate node id: {node.id!r}")
        nodes[node.id] = node
    for edge in payload.edges:
        for endpoint in (edge.source, edge.target):
            if endpoint not in nodes:
                raise GraphValidationError(f"edge references unknown node: {endpoint!r}")
    parent = _build_hierarchy(payload, nodes)
    children: dict[str, list[str]] = {}
    for child, pack in parent.items():
        children.setdefault(pack, []).append(child)
    return DepGraph(
        nodes=nodes,
        edges=tuple(payload.edges),
        parent=parent,
        children={pack: tuple(members) for pack, members in children.items()},
    )


def _build_hierarchy(payload: GraphPayload, nodes: dict[str, Node]) -> dict[str, str]:
    """Validate containment links (single parent, no cycles) into a child -> parent map."""
    parent: dict[str, str] = {}
    for link in payload.containment:
        if link.parent not in nodes or link.child not in nodes:
            raise GraphValidationError(
                f"containment references unknown node: {link.parent!r} -> {link.child!r}"
            )
        if link.parent == link.child:
            raise GraphValidationError(f"node cannot contain itself: {link.child!r}")
        if link.child in parent:
            raise GraphValidationError(f"node has multiple parent packs: {link.child!r}")
        parent[link.child] = link.parent
    if parent:
        forest = nx.DiGraph((pack, child) for child, pack in parent.items())
        if not nx.is_directed_acyclic_graph(forest):
            raise GraphValidationError("containment hierarchy contains a cycle")
    return parent


def is_pack(graph: DepGraph, node_id: str) -> bool:
    """Return True if the node directly contains at least one member."""
    return node_id in graph.children


def compute_view(
    graph: DepGraph,
    collapsed: Iterable[str] = (),
    depth: int | None = None,
    root: str | None = None,
) -> GraphView:
    """Compute a view: collapse packs, aggregate edges, optionally slice by depth.

    With a `root`, the slice keeps nodes within `depth` dependency hops of it.
    Without one, `depth` slices from the view's top-level nodes (no incoming
    edge); a view with no top level (pure cycle) is returned unsliced.
    """
    collapsed_set = frozenset(collapsed)
    _check_view_params(graph, collapsed_set, depth, root)
    rep = {nid: _representative(graph, nid, collapsed_set) for nid in graph.nodes}
    visible = set(rep.values())
    edges = _aggregate_edges(graph, rep)
    if root is not None:
        visible, edges = _slice_depth(edges, {rep[root]}, depth)
    elif depth is not None:
        top = _top_level(visible, edges)
        if top:
            visible, edges = _slice_depth(edges, top, depth)
    nodes = [_view_node(graph, nid, collapsed_set, visible) for nid in sorted(visible)]
    return GraphView(nodes=nodes, edges=edges)


def _check_view_params(
    graph: DepGraph, collapsed: frozenset[str], depth: int | None, root: str | None
) -> None:
    """Reject view parameters that reference unknown nodes or are inconsistent."""
    for pack_id in collapsed:
        if pack_id not in graph.nodes:
            raise GraphValidationError(f"unknown collapsed pack: {pack_id!r}")
        if not is_pack(graph, pack_id):
            raise GraphValidationError(f"collapsed node is not a pack: {pack_id!r}")
    if root is not None and root not in graph.nodes:
        raise GraphValidationError(f"unknown root node: {root!r}")
    if depth is not None and depth < 0:
        raise GraphValidationError("depth must be >= 0")


def _representative(graph: DepGraph, node_id: str, collapsed: frozenset[str]) -> str:
    """Return the node standing in for `node_id`: its outermost collapsed ancestor, or itself."""
    rep = node_id
    current: str | None = node_id
    while current is not None:
        if current in collapsed:
            rep = current
        current = graph.parent.get(current)
    return rep


def _aggregate_edges(graph: DepGraph, rep: dict[str, str]) -> list[ViewEdge]:
    """Re-point edges at their representatives and merge duplicates with a weight count."""
    buckets: dict[tuple[str, str, str], list[Edge]] = {}
    for edge in graph.edges:
        source, target = rep[edge.source], rep[edge.target]
        if source == target:
            continue
        buckets.setdefault((source, target, edge.relation), []).append(edge)
    return [
        ViewEdge(source=s, target=t, relation=r, attrs=_common_attrs(group), weight=len(group))
        for (s, t, r), group in buckets.items()
    ]


def _common_attrs(edges: list[Edge]) -> dict:
    """Return the attribute entries shared (same key and value) by every edge in the group."""
    common = dict(edges[0].attrs)
    for edge in edges[1:]:
        common = {key: value for key, value in common.items() if edge.attrs.get(key) == value}
    return common


def _top_level(visible: set[str], edges: list[ViewEdge]) -> set[str]:
    """Return the visible nodes with no incoming dependency edge (the view's top level)."""
    targets = {edge.target for edge in edges if edge.relation == DEP_RELATION}
    return {nid for nid in visible if nid not in targets}


def _slice_depth(
    edges: list[ViewEdge], roots: set[str], depth: int | None
) -> tuple[set[str], list[ViewEdge]]:
    """Keep only nodes within `depth` dependency hops of `roots` (all hops if depth is None).

    Only dependency edges are traversed; edges of other relations are kept
    when both endpoints survive the slice.
    """
    adjacency: dict[str, list[str]] = {}
    for edge in edges:
        if edge.relation == DEP_RELATION:
            adjacency.setdefault(edge.source, []).append(edge.target)
    kept = set(roots)
    frontier = list(roots)
    level = 0
    while frontier and (depth is None or level < depth):
        next_frontier = []
        for source in frontier:
            for target in adjacency.get(source, ()):
                if target not in kept:
                    kept.add(target)
                    next_frontier.append(target)
        frontier = next_frontier
        level += 1
    kept_edges = [e for e in edges if e.source in kept and e.target in kept]
    return kept, kept_edges


def _view_node(
    graph: DepGraph, node_id: str, collapsed: frozenset[str], visible: set[str]
) -> ViewNode:
    """Build the ViewNode for a visible node id."""
    node = graph.nodes[node_id]
    parent = graph.parent.get(node_id)
    return ViewNode(
        id=node.id,
        label=node.label,
        kind=node.kind,
        attrs=node.attrs,
        is_pack=is_pack(graph, node_id),
        collapsed=node_id in collapsed,
        member_count=len(graph.children.get(node_id, ())),
        parent=parent if parent in visible else None,
    )


def node_details(graph: DepGraph, node_id: str) -> NodeDetails:
    """Return details for one node; packs aggregate their members' external edges."""
    if node_id not in graph.nodes:
        raise GraphValidationError(f"unknown node: {node_id!r}")
    node = graph.nodes[node_id]
    scope = {node_id} | (_descendants(graph, node_id) if is_pack(graph, node_id) else set())
    out_edges = [e for e in graph.edges if e.source in scope and e.target not in scope]
    in_edges = [e for e in graph.edges if e.target in scope and e.source not in scope]
    parent_id = graph.parent.get(node_id)
    return NodeDetails(
        id=node.id,
        label=node.label,
        kind=node.kind,
        attrs=node.attrs,
        is_pack=is_pack(graph, node_id),
        parent=_ref(graph, parent_id) if parent_id else None,
        members=[_ref(graph, member) for member in graph.children.get(node_id, ())],
        deps=_dep_refs(graph, out_edges, "target"),
        reverse_deps=_dep_refs(graph, in_edges, "source"),
        edges_in=len(in_edges),
        edges_out=len(out_edges),
        edge_attrs=_attr_breakdown(out_edges + in_edges),
        hops_deep=_hops_deep(graph, node_id),
    )


def _hops_deep(graph: DepGraph, node_id: str) -> int | None:
    """BFS distance of a node from the in-degree-0 top level; None if unreachable (cycles).

    Only dependency edges count for both the in-degree and the traversal.
    """
    dep_edges = [edge for edge in graph.edges if edge.relation == DEP_RELATION]
    targets = {edge.target for edge in dep_edges}
    dist = {nid: 0 for nid in graph.nodes if nid not in targets}
    adjacency: dict[str, list[str]] = {}
    for edge in dep_edges:
        adjacency.setdefault(edge.source, []).append(edge.target)
    frontier = list(dist)
    while frontier:
        next_frontier = []
        for source in frontier:
            for target in adjacency.get(source, ()):
                if target not in dist:
                    dist[target] = dist[source] + 1
                    next_frontier.append(target)
        frontier = next_frontier
    return dist.get(node_id)


def _descendants(graph: DepGraph, pack_id: str) -> set[str]:
    """Return all transitive members of a pack."""
    found: set[str] = set()
    stack = [pack_id]
    while stack:
        for child in graph.children.get(stack.pop(), ()):
            if child not in found:
                found.add(child)
                stack.append(child)
    return found


def _ref(graph: DepGraph, node_id: str) -> NodeRef:
    """Build a NodeRef for a node id."""
    node = graph.nodes[node_id]
    return NodeRef(id=node.id, label=node.label, kind=node.kind)


def _dep_refs(graph: DepGraph, edges: list[Edge], endpoint: str) -> list[DepRef]:
    """Build deduplicated DepRefs for one edge endpoint, keeping the first link_type seen."""
    refs: dict[str, DepRef] = {}
    for edge in edges:
        node_id = edge.target if endpoint == "target" else edge.source
        if node_id not in refs:
            node = graph.nodes[node_id]
            refs[node_id] = DepRef(
                id=node.id,
                label=node.label,
                kind=node.kind,
                link_type=edge.attrs.get("link_type"),
            )
    return list(refs.values())


def _attr_breakdown(edges: list[Edge]) -> dict[str, dict[str, int]]:
    """Count edge-attribute values, e.g. {"link_type": {"dynamic": 3, "static": 1}}."""
    breakdown: dict[str, dict[str, int]] = {}
    for edge in edges:
        for key, value in edge.attrs.items():
            bucket = breakdown.setdefault(key, {})
            bucket[str(value)] = bucket.get(str(value), 0) + 1
    return breakdown


# --- shortest dependency paths ---


@dataclass(frozen=True)
class _PathDag:
    """Every node and edge lying on at least one shortest path.

    `layer` maps each such node to its distance from the start set; layer 0
    holds the path starts and layer `hops` the path ends.
    """

    hops: int
    layer: dict[str, int]
    edges: frozenset[tuple[str, str]]


def shortest_paths(
    graph: DepGraph, source: str, target: str, collapsed: Iterable[str] = ()
) -> PathResult:
    """Find all shortest dependency paths between two nodes (or packs).

    Dependency edges are followed from source to target first; if none
    exists, from target to source ("reverse"). A pack endpoint stands for
    itself and all of its transitive members. Highlights are mapped onto
    the visible representatives for `collapsed`.
    """
    collapsed_set = frozenset(collapsed)
    _check_path_params(graph, source, target, collapsed_set)
    sources, targets = _scope(graph, source), _scope(graph, target)
    succ = _dep_successors(graph)
    direction: Literal["forward", "reverse"] = "forward"
    dag = _path_dag(succ, sources, targets)
    if dag is None:
        direction = "reverse"
        dag = _path_dag(succ, targets, sources)
    if dag is None:
        return PathResult(source=source, target=target)
    return _path_result(graph, source, target, direction, dag, collapsed_set)


def _check_path_params(
    graph: DepGraph, source: str, target: str, collapsed: frozenset[str]
) -> None:
    """Reject unknown endpoints, invalid collapsed packs, and overlapping endpoints."""
    for endpoint in (source, target):
        if endpoint not in graph.nodes:
            raise GraphValidationError(f"unknown node: {endpoint!r}")
    _check_view_params(graph, collapsed, depth=None, root=None)
    if _scope(graph, source) & _scope(graph, target):
        raise GraphValidationError(
            f"source and target overlap (same node or one contains the other): "
            f"{source!r}, {target!r}"
        )


def _scope(graph: DepGraph, node_id: str) -> set[str]:
    """Return the node itself plus, for a pack, all of its transitive members."""
    return {node_id} | _descendants(graph, node_id)


def _dep_successors(graph: DepGraph) -> dict[str, set[str]]:
    """Index dependency edges as node -> set of direct dependencies."""
    succ: dict[str, set[str]] = {}
    for edge in graph.edges:
        if edge.relation == DEP_RELATION:
            succ.setdefault(edge.source, set()).add(edge.target)
    return succ


def _bfs(adjacency: dict[str, set[str]], starts: set[str]) -> dict[str, int]:
    """Multi-source BFS: hop distance from the nearest start for every reachable node."""
    dist = dict.fromkeys(starts, 0)
    frontier = list(starts)
    while frontier:
        next_frontier = []
        for node in frontier:
            for nxt in adjacency.get(node, ()):
                if nxt not in dist:
                    dist[nxt] = dist[node] + 1
                    next_frontier.append(nxt)
        frontier = next_frontier
    return dist


def _path_dag(succ: dict[str, set[str]], starts: set[str], ends: set[str]) -> _PathDag | None:
    """Return the union of all shortest start -> end paths, or None if no end is reachable.

    A node lies on a shortest path iff its distance from the starts plus its
    distance to the ends equals the shortest length.
    """
    from_starts = _bfs(succ, starts)
    reached = [from_starts[n] for n in ends if n in from_starts]
    if not reached:
        return None
    hops = min(reached)
    pred: dict[str, set[str]] = {}
    for node, targets in succ.items():
        for nxt in targets:
            pred.setdefault(nxt, set()).add(node)
    to_ends = _bfs(pred, ends)
    layer = {n: d for n, d in from_starts.items() if n in to_ends and d + to_ends[n] == hops}
    edges = frozenset(
        (u, v) for u in layer for v in succ.get(u, ()) if layer.get(v) == layer[u] + 1
    )
    return _PathDag(hops=hops, layer=layer, edges=edges)


def _count_paths(dag: _PathDag) -> int:
    """Count the distinct shortest paths in the DAG, layer by layer."""
    preds: dict[str, list[str]] = {}
    for u, v in dag.edges:
        preds.setdefault(v, []).append(u)
    counts: dict[str, int] = {}
    for node in sorted(dag.layer, key=dag.layer.__getitem__):
        counts[node] = 1 if dag.layer[node] == 0 else sum(counts[p] for p in preds[node])
    return sum(counts[n] for n, d in dag.layer.items() if d == dag.hops)


def _list_paths(dag: _PathDag, limit: int) -> list[list[str]]:
    """List up to `limit` shortest paths, in sorted (deterministic) order."""
    succ: dict[str, list[str]] = {}
    for u, v in sorted(dag.edges):
        succ.setdefault(u, []).append(v)
    paths: list[list[str]] = []

    def walk(path: list[str]) -> None:
        """Extend `path` depth-first until it reaches an end or the limit is hit."""
        if len(paths) >= limit:
            return
        if dag.layer[path[-1]] == dag.hops:
            paths.append(path)
            return
        for nxt in succ.get(path[-1], ()):
            walk([*path, nxt])

    for start in sorted(n for n, d in dag.layer.items() if d == 0):
        walk([start])
    return paths


def _path_result(
    graph: DepGraph,
    source: str,
    target: str,
    direction: Literal["forward", "reverse"],
    dag: _PathDag,
    collapsed: frozenset[str],
) -> PathResult:
    """Assemble a PathResult, mapping highlights onto visible representatives."""
    path_count = _count_paths(dag)
    listed = _list_paths(dag, MAX_LISTED_PATHS)
    rep = {n: _representative(graph, n, collapsed) for n in dag.layer}
    highlight_edges = sorted({(rep[u], rep[v]) for u, v in dag.edges if rep[u] != rep[v]})
    return PathResult(
        source=source,
        target=target,
        direction=direction,
        hops=dag.hops,
        path_count=path_count,
        paths=[[_ref(graph, n) for n in path] for path in listed],
        truncated=path_count > len(listed),
        highlight_nodes=sorted(set(rep.values())),
        highlight_edges=[PathEdge(source=s, target=t) for s, t in highlight_edges],
    )
