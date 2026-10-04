"""FastAPI endpoints on top of the pure graph engine.

The only server-side state is the currently imported graph (single-graph
v1); every view is recomputed from it on each request.
"""

from fastapi import FastAPI, HTTPException, Query

from stellardeps import feeds, graph_engine
from stellardeps.feeds import FeedInfo, FeedUnavailableError
from stellardeps.graph_engine import (
    DepGraph,
    GraphValidationError,
    GraphView,
    NodeDetails,
    PathResult,
)
from stellardeps.models import GraphPayload

app = FastAPI(title="Stellardeps", version="0.1.0")

_current_graph: DepGraph | None = None


def _require_graph() -> DepGraph:
    """Return the imported graph or fail with 404 if none was imported yet."""
    if _current_graph is None:
        raise HTTPException(status_code=404, detail="no graph imported")
    return _current_graph


def _install_graph(payload: GraphPayload) -> dict[str, int]:
    """Build a graph from a payload, make it current, and return its counts."""
    global _current_graph
    graph = graph_engine.build_graph(payload)
    _current_graph = graph
    return {"nodes": len(graph.nodes), "edges": len(graph.edges), "packs": len(graph.children)}


@app.post("/import")
def import_graph(payload: GraphPayload) -> dict[str, int]:
    """Validate and load a graph, replacing any previously imported one."""
    try:
        return _install_graph(payload)
    except GraphValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/feeds")
def get_feeds() -> list[FeedInfo]:
    """List the predefined feeds that can be loaded via POST /feeds/{id}/run."""
    return feeds.list_feeds()


@app.post("/feeds/{feed_id}/run")
def run_feed(feed_id: str) -> dict[str, int]:
    """Build a predefined feed and load it, replacing the current graph."""
    try:
        payload = feeds.build_feed(feed_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"unknown feed: {feed_id!r}") from exc
    except FeedUnavailableError as exc:
        raise HTTPException(status_code=503, detail=f"feed unavailable: {exc}") from exc
    return _install_graph(payload)


@app.get("/graph")
def get_graph(collapsed: str = "", depth: int | None = None, root: str | None = None) -> GraphView:
    """Compute the current view — a pure function of (graph, params).

    `collapsed` is a comma-separated list of pack ids; `depth` limits the
    view to N levels of transitive deps from `root`, or from the view's
    top-level nodes when `root` is omitted.
    """
    graph = _require_graph()
    collapsed_ids = [pack_id for pack_id in collapsed.split(",") if pack_id]
    try:
        return graph_engine.compute_view(graph, collapsed_ids, depth=depth, root=root)
    except GraphValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/node/{node_id}")
def get_node(node_id: str) -> NodeDetails:
    """Return details for one node: kind, parent pack, deps, reverse deps, members."""
    graph = _require_graph()
    try:
        return graph_engine.node_details(graph, node_id)
    except GraphValidationError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/path")
def get_path(
    source: str = Query(alias="from"),
    target: str = Query(alias="to"),
    collapsed: str = "",
    exclude: str = "",
) -> PathResult:
    """Return all shortest dependency paths between two nodes or packs.

    `collapsed` (comma-separated pack ids) only affects the highlight
    mapping. `exclude` (comma-separated link types, e.g. "optional") lists
    edge link types not to follow. Unknown endpoints are 404; other
    invalid parameters are 400.
    """
    graph = _require_graph()
    for node_id in (source, target):
        if node_id not in graph.nodes:
            raise HTTPException(status_code=404, detail=f"unknown node: {node_id!r}")
    collapsed_ids = [pack_id for pack_id in collapsed.split(",") if pack_id]
    excluded = [link_type for link_type in exclude.split(",") if link_type]
    try:
        return graph_engine.shortest_paths(graph, source, target, collapsed_ids, excluded)
    except GraphValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
