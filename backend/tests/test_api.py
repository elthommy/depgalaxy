import pytest
from fastapi.testclient import TestClient

from stellardeps import api

client = TestClient(api.app)

PAYLOAD = {
    "nodes": [
        {"id": "app", "label": "App", "kind": "package"},
        {"id": "a1", "label": "A1", "kind": "library"},
        {"id": "a2", "label": "A2", "kind": "library"},
        {"id": "x", "label": "X", "kind": "service"},
    ],
    "edges": [
        {"source": "a1", "target": "x", "attrs": {"link_type": "dynamic"}},
        {"source": "a2", "target": "x", "attrs": {"link_type": "dynamic"}},
        {"source": "a1", "target": "a2"},
    ],
    "containment": [{"parent": "app", "child": "a1"}, {"parent": "app", "child": "a2"}],
}


@pytest.fixture(autouse=True)
def clean_state():
    """Start every test with no graph imported."""
    api._current_graph = None
    yield
    api._current_graph = None


def import_payload():
    """Import the standard test payload and return the response."""
    return client.post("/import", json=PAYLOAD)


def test_import_returns_counts():
    response = import_payload()
    assert response.status_code == 200
    assert response.json() == {"nodes": 4, "edges": 3, "packs": 1}


def test_import_replaces_previous_graph():
    import_payload()
    response = client.post(
        "/import", json={"nodes": [{"id": "solo", "label": "Solo"}], "edges": []}
    )
    assert response.json()["nodes"] == 1
    assert client.get("/node/app").status_code == 404


def test_import_rejects_invalid_hierarchy():
    bad = dict(PAYLOAD, containment=[{"parent": "app", "child": "app"}])
    response = client.post("/import", json=bad)
    assert response.status_code == 400
    assert "contain itself" in response.json()["detail"]


def test_graph_before_import_is_404():
    assert client.get("/graph").status_code == 404


def test_graph_full_view():
    import_payload()
    view = client.get("/graph").json()
    assert {n["id"] for n in view["nodes"]} == {"app", "a1", "a2", "x"}
    assert len(view["edges"]) == 3


def test_graph_collapsed_param_aggregates():
    import_payload()
    view = client.get("/graph", params={"collapsed": "app"}).json()
    assert {n["id"] for n in view["nodes"]} == {"app", "x"}
    (edge,) = view["edges"]
    assert edge["source"] == "app" and edge["target"] == "x"
    assert edge["weight"] == 2
    assert edge["attrs"] == {"link_type": "dynamic"}


def test_graph_depth_and_root():
    import_payload()
    view = client.get("/graph", params={"root": "a1", "depth": 1}).json()
    assert {n["id"] for n in view["nodes"]} == {"a1", "a2", "x"}


def test_graph_depth_without_root_slices_from_top_level():
    import_payload()
    view = client.get("/graph", params={"depth": 0}).json()
    # app (no edges) and a1 (no incoming edge) are the top level
    assert {n["id"] for n in view["nodes"]} == {"app", "a1"}


def test_graph_bad_params_are_400():
    import_payload()
    assert client.get("/graph", params={"collapsed": "ghost"}).status_code == 400
    assert client.get("/graph", params={"depth": -1}).status_code == 400
    assert client.get("/graph", params={"root": "ghost"}).status_code == 400


def test_node_details():
    import_payload()
    details = client.get("/node/a1").json()
    assert details["parent"]["id"] == "app"
    assert [d["id"] for d in details["deps"]] == ["x", "a2"]
    assert details["edge_attrs"] == {"link_type": {"dynamic": 1}}
    assert details["hops_deep"] == 0


def test_node_pack_details():
    import_payload()
    details = client.get("/node/app").json()
    assert details["is_pack"]
    assert {m["id"] for m in details["members"]} == {"a1", "a2"}


def test_node_unknown_is_404():
    import_payload()
    assert client.get("/node/ghost").status_code == 404
