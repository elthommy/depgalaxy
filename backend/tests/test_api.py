import pytest
from fastapi.testclient import TestClient

from depgalaxy import api

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


def test_path_found():
    import_payload()
    response = client.get("/path", params={"from": "a1", "to": "x"})
    assert response.status_code == 200
    body = response.json()
    assert (body["direction"], body["hops"], body["path_count"]) == ("forward", 1, 1)
    assert [ref["id"] for ref in body["paths"][0]] == ["a1", "x"]
    assert body["highlight_edges"] == [{"source": "a1", "target": "x"}]


def test_path_reverse_and_collapsed_mapping():
    import_payload()
    response = client.get("/path", params={"from": "x", "to": "a2", "collapsed": "app"})
    body = response.json()
    assert (body["direction"], body["hops"]) == ("reverse", 1)
    assert body["highlight_nodes"] == ["app", "x"]
    assert body["highlight_edges"] == [{"source": "app", "target": "x"}]


def test_path_none_found():
    client.post("/import", json={"nodes": [{"id": "a", "label": "A"}, {"id": "b", "label": "B"}]})
    body = client.get("/path", params={"from": "a", "to": "b"}).json()
    assert (body["direction"], body["path_count"], body["paths"]) == (None, 0, [])


def test_path_before_import_is_404():
    assert client.get("/path", params={"from": "a", "to": "b"}).status_code == 404


def test_path_unknown_node_is_404():
    import_payload()
    response = client.get("/path", params={"from": "a1", "to": "nope"})
    assert response.status_code == 404
    assert "nope" in response.json()["detail"]


@pytest.mark.parametrize(
    "params",
    [
        {"from": "app", "to": "a1"},
        {"from": "a1", "to": "x", "collapsed": "x"},
    ],
)
def test_path_bad_params_are_400(params):
    import_payload()
    assert client.get("/path", params=params).status_code == 400


def test_path_requires_both_endpoints():
    import_payload()
    assert client.get("/path", params={"from": "a1"}).status_code == 422


def test_path_exclude_link_types():
    client.post(
        "/import",
        json={
            "nodes": [{"id": n, "label": n} for n in ("a", "b", "c")],
            "edges": [
                {"source": "a", "target": "c", "attrs": {"link_type": "optional"}},
                {"source": "a", "target": "b", "attrs": {"link_type": "hard"}},
                {"source": "b", "target": "c", "attrs": {"link_type": "hard"}},
            ],
        },
    )
    params = {"from": "a", "to": "c"}
    assert client.get("/path", params=params).json()["hops"] == 1
    assert client.get("/path", params={**params, "exclude": "optional"}).json()["hops"] == 2
