import pytest

from stellardeps.graph_engine import (
    GraphValidationError,
    build_graph,
    compute_view,
    node_details,
)
from stellardeps.models import Containment, Edge, GraphPayload, Node


def make_payload(node_ids, edges=(), containment=()):
    """Build a GraphPayload from shorthand tuples."""
    return GraphPayload(
        nodes=[Node(id=n, label=n.upper(), kind="library") for n in node_ids],
        edges=[Edge(source=s, target=t, attrs=dict(attrs)) for s, t, attrs in edges],
        containment=[Containment(parent=p, child=c) for p, c in containment],
    )


@pytest.fixture
def galaxy():
    """A small fixture graph.

    Packs: app{a1, a2}, lib{l1, l2, libsub{l3}}. Standalone: s1.
    Deps: a1->l1(dyn), a2->l1(dyn), a1->l3(static), a1->a2,
          l1->l2, s1->a1, l2->s1.
    """
    payload = make_payload(
        ["app", "a1", "a2", "lib", "l1", "l2", "libsub", "l3", "s1"],
        edges=[
            ("a1", "l1", {"link_type": "dynamic"}),
            ("a2", "l1", {"link_type": "dynamic"}),
            ("a1", "l3", {"link_type": "static"}),
            ("a1", "a2", {}),
            ("l1", "l2", {}),
            ("s1", "a1", {}),
            ("l2", "s1", {}),
        ],
        containment=[
            ("app", "a1"),
            ("app", "a2"),
            ("lib", "l1"),
            ("lib", "l2"),
            ("lib", "libsub"),
            ("libsub", "l3"),
        ],
    )
    return build_graph(payload)


def view_ids(view):
    """Return the set of node ids in a view."""
    return {n.id for n in view.nodes}


def edge_map(view):
    """Index view edges by (source, target)."""
    return {(e.source, e.target): e for e in view.edges}


# --- build / hierarchy validation ---


def test_build_rejects_duplicate_node_ids():
    payload = make_payload(["a"])
    payload.nodes.append(Node(id="a", label="A"))
    with pytest.raises(GraphValidationError, match="duplicate node id"):
        build_graph(payload)


def test_build_rejects_unknown_edge_endpoint():
    payload = make_payload(["a"], edges=[("a", "ghost", {})])
    with pytest.raises(GraphValidationError, match="unknown node"):
        build_graph(payload)


def test_build_rejects_unknown_containment_node():
    payload = make_payload(["a"], containment=[("a", "ghost")])
    with pytest.raises(GraphValidationError, match="unknown node"):
        build_graph(payload)


def test_build_rejects_multiple_parents():
    payload = make_payload(["p1", "p2", "c"], containment=[("p1", "c"), ("p2", "c")])
    with pytest.raises(GraphValidationError, match="multiple parent"):
        build_graph(payload)


def test_build_rejects_containment_cycle():
    payload = make_payload(["a", "b", "c"], containment=[("a", "b"), ("b", "c"), ("c", "a")])
    with pytest.raises(GraphValidationError, match="cycle"):
        build_graph(payload)


def test_build_rejects_self_containment():
    payload = make_payload(["a"], containment=[("a", "a")])
    with pytest.raises(GraphValidationError, match="contain itself"):
        build_graph(payload)


# --- full view (no collapse) ---


def test_full_view_shows_every_node_and_edge(galaxy):
    view = compute_view(galaxy)
    assert view_ids(view) == {"app", "a1", "a2", "lib", "l1", "l2", "libsub", "l3", "s1"}
    assert len(view.edges) == 7
    assert all(e.weight == 1 for e in view.edges)


def test_full_view_marks_packs_and_parents(galaxy):
    view = compute_view(galaxy)
    nodes = {n.id: n for n in view.nodes}
    assert nodes["app"].is_pack and not nodes["app"].collapsed
    assert nodes["app"].member_count == 2
    assert nodes["l3"].parent == "libsub"
    assert nodes["libsub"].parent == "lib"
    assert nodes["s1"].parent is None and not nodes["s1"].is_pack


def test_duplicate_edges_aggregate_even_without_collapse():
    payload = make_payload(["a", "b"], edges=[("a", "b", {}), ("a", "b", {})])
    view = compute_view(build_graph(payload))
    assert len(view.edges) == 1
    assert view.edges[0].weight == 2


# --- collapse ---


def test_collapse_hides_members_and_aggregates_edges(galaxy):
    view = compute_view(galaxy, collapsed=["app"])
    assert "a1" not in view_ids(view) and "a2" not in view_ids(view)
    edges = edge_map(view)
    assert edges[("app", "l1")].weight == 2  # a1->l1 + a2->l1
    assert edges[("app", "l3")].weight == 1
    assert edges[("s1", "app")].weight == 1
    assert ("a1", "a2") not in edges  # internal edge dropped
    nodes = {n.id: n for n in view.nodes}
    assert nodes["app"].collapsed


def test_collapse_keeps_shared_attrs_drops_mixed(galaxy):
    view = compute_view(galaxy, collapsed=["app"])
    edges = edge_map(view)
    # both underlying edges are dynamic -> attr kept
    assert edges[("app", "l1")].attrs == {"link_type": "dynamic"}


def test_collapse_drops_conflicting_attrs():
    payload = make_payload(
        ["p", "m1", "m2", "x"],
        edges=[("m1", "x", {"link_type": "dynamic"}), ("m2", "x", {"link_type": "static"})],
        containment=[("p", "m1"), ("p", "m2")],
    )
    view = compute_view(build_graph(payload), collapsed=["p"])
    assert edge_map(view)[("p", "x")].attrs == {}


def test_nested_collapse_outermost_wins(galaxy):
    view = compute_view(galaxy, collapsed=["lib", "libsub"])
    assert view_ids(view) == {"app", "a1", "a2", "lib", "s1"}
    edges = edge_map(view)
    assert edges[("a1", "lib")].weight == 2  # a1->l1 + a1->l3
    assert edges[("lib", "s1")].weight == 1  # l2->s1


def test_collapse_inner_pack_only(galaxy):
    view = compute_view(galaxy, collapsed=["libsub"])
    assert "l3" not in view_ids(view)
    assert "libsub" in view_ids(view)
    assert ("a1", "libsub") in edge_map(view)


def test_collapse_rejects_non_pack(galaxy):
    with pytest.raises(GraphValidationError, match="not a pack"):
        compute_view(galaxy, collapsed=["s1"])


def test_collapse_rejects_unknown_id(galaxy):
    with pytest.raises(GraphValidationError, match="unknown collapsed pack"):
        compute_view(galaxy, collapsed=["ghost"])


# --- depth slicing ---


def test_depth_zero_is_root_only(galaxy):
    view = compute_view(galaxy, root="a1", depth=0)
    assert view_ids(view) == {"a1"}
    assert view.edges == []


def test_depth_one_keeps_direct_deps_only(galaxy):
    view = compute_view(galaxy, root="a1", depth=1)
    assert view_ids(view) == {"a1", "a2", "l1", "l3"}
    edges = edge_map(view)
    assert set(edges) == {("a1", "l1"), ("a2", "l1"), ("a1", "l3"), ("a1", "a2")}


def test_depth_two_reaches_transitive_deps(galaxy):
    view = compute_view(galaxy, root="a1", depth=2)
    assert view_ids(view) == {"a1", "a2", "l1", "l2", "l3"}


def test_root_without_depth_keeps_all_reachable(galaxy):
    view = compute_view(galaxy, root="l1")
    # l1 -> l2 -> s1 -> a1 -> {a2, l3, l1(cycle)}
    assert view_ids(view) == {"l1", "l2", "s1", "a1", "a2", "l3"}


def test_root_inside_collapsed_pack_slices_from_pack(galaxy):
    view = compute_view(galaxy, collapsed=["app"], root="a1", depth=1)
    assert view_ids(view) == {"app", "l1", "l3"}


def test_depth_without_root_rejected(galaxy):
    with pytest.raises(GraphValidationError, match="depth requires a root"):
        compute_view(galaxy, depth=2)


def test_negative_depth_rejected(galaxy):
    with pytest.raises(GraphValidationError, match=">= 0"):
        compute_view(galaxy, root="a1", depth=-1)


def test_unknown_root_rejected(galaxy):
    with pytest.raises(GraphValidationError, match="unknown root"):
        compute_view(galaxy, root="ghost")


# --- node details ---


def test_node_details_leaf(galaxy):
    details = node_details(galaxy, "l1")
    assert details.parent.id == "lib"
    assert not details.is_pack
    assert [d.id for d in details.deps] == ["l2"]
    assert {d.id for d in details.reverse_deps} == {"a1", "a2"}
    assert details.edge_attrs == {"link_type": {"dynamic": 2}}


def test_node_details_pack(galaxy):
    details = node_details(galaxy, "app")
    assert details.is_pack
    assert {m.id for m in details.members} == {"a1", "a2"}
    assert details.parent is None


def test_node_details_dedupes_repeated_deps():
    payload = make_payload(["a", "b"], edges=[("a", "b", {}), ("a", "b", {})])
    details = node_details(build_graph(payload), "a")
    assert [d.id for d in details.deps] == ["b"]


def test_node_details_unknown_node(galaxy):
    with pytest.raises(GraphValidationError, match="unknown node"):
        node_details(galaxy, "ghost")
