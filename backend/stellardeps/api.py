"""FastAPI endpoints on top of the pure graph engine.

The only server-side state is the currently imported graph (single-graph
v1); every view is recomputed from it on each request.
"""

from fastapi import FastAPI, HTTPException

from stellardeps import graph_engine
from stellardeps.graph_engine import DepGraph, GraphValidationError, GraphView, NodeDetails
from stellardeps.models import GraphPayload

app = FastAPI(title="Stellardeps", version="0.1.0")

_current_graph: DepGraph | None = None


def _require_graph() -> DepGraph:
    """Return the imported graph or fail with 404 if none was imported yet."""
    if _current_graph is None:
        raise HTTPException(status_code=404, detail="no graph imported")
    return _current_graph


@app.post("/import")
def import_graph(payload: GraphPayload) -> dict[str, int]:
    """Validate and load a graph, replacing any previously imported one."""
    global _current_graph
    try:
        graph = graph_engine.build_graph(payload)
    except GraphValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    _current_graph = graph
    return {"nodes": len(graph.nodes), "edges": len(graph.edges), "packs": len(graph.children)}


@app.get("/graph")
def get_graph(collapsed: str = "", depth: int | None = None, root: str | None = None) -> GraphView:
    """Compute the current view — a pure function of (graph, params).

    `collapsed` is a comma-separated list of pack ids; `depth` and `root`
    optionally limit the view to N levels of transitive deps from root.
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
