import pytest

from stellardeps.graph_engine import (
    GraphValidationError,
    build_graph,
    compute_view,
    node_details,
    shortest_paths,
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


def test_depth_without_root_slices_from_top_level():
    # a -> b -> c plus isolated x; top level = {a, x}
    payload = make_payload(["a", "b", "c", "x"], edges=[("a", "b", {}), ("b", "c", {})])
    view = compute_view(build_graph(payload), depth=1)
    assert view_ids(view) == {"a", "b", "x"}


def test_depth_zero_without_root_keeps_only_top_level():
    payload = make_payload(["a", "b", "c", "x"], edges=[("a", "b", {}), ("b", "c", {})])
    view = compute_view(build_graph(payload), depth=0)
    assert view_ids(view) == {"a", "x"}
    assert view.edges == []


def test_depth_without_root_respects_collapse():
    payload = make_payload(["p", "m", "x"], edges=[("m", "x", {})], containment=[("p", "m")])
    graph = build_graph(payload)
    # uncollapsed: p (no edges) and m (no incoming) are both top level
    assert view_ids(compute_view(graph, depth=0)) == {"p", "m"}
    # collapsed: the aggregated edge p->x makes p the only top-level node
    assert view_ids(compute_view(graph, collapsed=["p"], depth=0)) == {"p"}


def test_depth_without_root_pure_cycle_falls_back_to_full_view():
    payload = make_payload(["a", "b", "c"], edges=[("a", "b", {}), ("b", "c", {}), ("c", "a", {})])
    view = compute_view(build_graph(payload), depth=1)
    assert view_ids(view) == {"a", "b", "c"}


def test_depth_without_root_on_galaxy_keeps_packs(galaxy):
    # every non-pack fixture node sits on a cycle, so only the edge-less
    # packs are top level
    view = compute_view(galaxy, depth=1)
    assert view_ids(view) == {"app", "lib", "libsub"}


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
    assert details.deps[0].link_type is None
    assert {d.id for d in details.reverse_deps} == {"a1", "a2"}
    assert details.reverse_deps[0].link_type == "dynamic"
    assert details.edges_in == 2 and details.edges_out == 1
    assert details.edge_attrs == {"link_type": {"dynamic": 2}}


def test_node_details_pack_aggregates_external_edges(galaxy):
    details = node_details(galaxy, "app")
    assert details.is_pack
    assert {m.id for m in details.members} == {"a1", "a2"}
    assert details.parent is None
    # crossing edges: a1->l1, a2->l1, a1->l3 out; s1->a1 in; a1->a2 internal excluded
    assert [d.id for d in details.deps] == ["l1", "l3"]
    assert [d.link_type for d in details.deps] == ["dynamic", "static"]
    assert [r.id for r in details.reverse_deps] == ["s1"]
    assert details.edges_out == 3 and details.edges_in == 1
    assert details.edge_attrs == {"link_type": {"dynamic": 2, "static": 1}}


def test_node_details_nested_pack_includes_subpack_members(galaxy):
    details = node_details(galaxy, "lib")
    assert {d.id for d in details.deps} == {"s1"}  # l2->s1
    assert {r.id for r in details.reverse_deps} == {"a1", "a2"}
    assert details.edges_in == 3 and details.edges_out == 1


def test_node_details_dedupes_repeated_deps():
    payload = make_payload(["a", "b"], edges=[("a", "b", {}), ("a", "b", {})])
    details = node_details(build_graph(payload), "a")
    assert [d.id for d in details.deps] == ["b"]


def test_node_details_unknown_node(galaxy):
    with pytest.raises(GraphValidationError, match="unknown node"):
        node_details(galaxy, "ghost")


def test_hops_deep_top_level_and_chain():
    payload = make_payload(["a", "b", "c"], edges=[("a", "b", {}), ("b", "c", {})])
    graph = build_graph(payload)
    assert node_details(graph, "a").hops_deep == 0
    assert node_details(graph, "b").hops_deep == 1
    assert node_details(graph, "c").hops_deep == 2


def test_hops_deep_is_shortest_distance():
    payload = make_payload(["a", "b", "c"], edges=[("a", "b", {}), ("b", "c", {}), ("a", "c", {})])
    assert node_details(build_graph(payload), "c").hops_deep == 1


def test_hops_deep_none_inside_pure_cycle():
    payload = make_payload(["a", "b"], edges=[("a", "b", {}), ("b", "a", {})])
    assert node_details(build_graph(payload), "a").hops_deep is None


# --- non-dependency relations (e.g. conflicts_with) ---


def conflict_graph():
    """a depends on b; a conflicts with c; c depends on d."""
    payload = make_payload(["a", "b", "c", "d"], edges=[("a", "b", {}), ("c", "d", {})])
    payload.edges.append(Edge(source="a", target="c", relation="conflicts_with"))
    return build_graph(payload)


def test_slice_does_not_traverse_conflict_edges():
    view = compute_view(conflict_graph(), root="a")
    # c is only reachable through the conflict edge -> excluded from the subtree
    assert view_ids(view) == {"a", "b"}


def test_conflict_edges_kept_when_both_endpoints_visible():
    view = compute_view(conflict_graph(), depth=1)
    # a and c are both top level (conflicts_with does not count as incoming)
    assert view_ids(view) == {"a", "b", "c", "d"}
    relations = {(e.source, e.target): e.relation for e in view.edges}
    assert relations[("a", "c")] == "conflicts_with"


def test_hops_deep_ignores_conflict_edges():
    graph = conflict_graph()
    assert node_details(graph, "c").hops_deep == 0
    assert node_details(graph, "d").hops_deep == 1


# --- shortest dependency paths ---


def chain_graph(*edges):
    """Build a graph of plain nodes from (source, target) dependency pairs."""
    node_ids = sorted({n for edge in edges for n in edge})
    return build_graph(make_payload(node_ids, edges=[(s, t, {}) for s, t in edges]))


def path_ids(result):
    """Return the listed paths as lists of node ids."""
    return [[ref.id for ref in path] for path in result.paths]


def highlighted_edges(result):
    """Return the highlighted edges as (source, target) tuples."""
    return [(e.source, e.target) for e in result.highlight_edges]


def test_path_forward():
    result = shortest_paths(chain_graph(("a", "b"), ("b", "c")), "a", "c")
    assert result.direction == "forward"
    assert (result.hops, result.path_count, result.truncated) == (2, 1, False)
    assert path_ids(result) == [["a", "b", "c"]]
    assert result.paths[0][0].label == "A"
    assert result.highlight_nodes == ["a", "b", "c"]
    assert highlighted_edges(result) == [("a", "b"), ("b", "c")]


def test_path_reverse_runs_in_dependency_order():
    result = shortest_paths(chain_graph(("a", "b"), ("b", "c")), "c", "a")
    assert result.direction == "reverse"
    assert path_ids(result) == [["a", "b", "c"]]


def test_no_path():
    graph = build_graph(make_payload(["a", "b", "c"], edges=[("a", "b", {})]))
    result = shortest_paths(graph, "a", "c")
    assert (result.direction, result.hops, result.path_count) == (None, None, 0)
    assert result.paths == [] and result.highlight_nodes == [] and result.highlight_edges == []


def test_all_shortest_paths_exclude_longer_routes():
    graph = chain_graph(
        ("a", "b1"), ("a", "b2"), ("b1", "d"), ("b2", "d"), ("a", "x"), ("x", "y"), ("y", "d")
    )
    result = shortest_paths(graph, "a", "d")
    assert (result.hops, result.path_count) == (2, 2)
    assert path_ids(result) == [["a", "b1", "d"], ["a", "b2", "d"]]
    assert result.highlight_nodes == ["a", "b1", "b2", "d"]


def test_listed_paths_are_capped():
    # a -> m0..m3 -> n0..n3 -> z: 4 * 4 = 16 shortest paths
    mids, ends = [f"m{i}" for i in range(4)], [f"n{i}" for i in range(4)]
    edges = [("a", m) for m in mids] + [(m, n) for m in mids for n in ends]
    graph = chain_graph(*edges, *[(n, "z") for n in ends])
    result = shortest_paths(graph, "a", "z")
    assert (result.hops, result.path_count, result.truncated) == (3, 16, True)
    assert len(result.paths) == 10
    assert path_ids(result)[0] == ["a", "m0", "n0", "z"]
    assert len(result.highlight_edges) == 4 + 16 + 4


def test_path_does_not_follow_conflict_edges():
    result = shortest_paths(conflict_graph(), "a", "c")
    assert result.direction is None


def test_path_through_cycle():
    graph = chain_graph(("a", "b"), ("b", "c"), ("c", "a"))
    assert shortest_paths(graph, "a", "c").hops == 2
    assert shortest_paths(graph, "c", "a").hops == 1


def test_pack_endpoint_stands_for_its_members(galaxy):
    result = shortest_paths(galaxy, "app", "l2")
    assert (result.direction, result.hops, result.path_count) == ("forward", 2, 2)
    assert path_ids(result) == [["a1", "l1", "l2"], ["a2", "l1", "l2"]]


def test_path_highlights_map_onto_collapsed_packs(galaxy):
    result = shortest_paths(galaxy, "s1", "l3", collapsed=["lib"])
    # listed paths keep the real nodes; highlights use the visible orb
    assert path_ids(result) == [["s1", "a1", "l3"]]
    assert result.highlight_nodes == ["a1", "lib", "s1"]
    assert highlighted_edges(result) == [("a1", "lib"), ("s1", "a1")]


def test_path_highlights_drop_edges_inside_one_orb(galaxy):
    result = shortest_paths(galaxy, "s1", "a2", collapsed=["app"])
    assert path_ids(result) == [["s1", "a1", "a2"]]
    assert result.highlight_nodes == ["app", "s1"]
    assert highlighted_edges(result) == [("s1", "app")]


@pytest.mark.parametrize(
    ("source", "target", "collapsed", "message"),
    [
        ("a1", "nope", [], "unknown node"),
        ("a1", "a1", [], "overlap"),
        ("lib", "l3", [], "overlap"),
        ("a1", "l1", ["a2"], "not a pack"),
    ],
)
def test_path_rejects_invalid_requests(galaxy, source, target, collapsed, message):
    with pytest.raises(GraphValidationError, match=message):
        shortest_paths(galaxy, source, target, collapsed=collapsed)


def typed_graph():
    """a -optional-> c (short cut); a -hard-> b -hard-> c; c -optional-> d."""
    return build_graph(
        make_payload(
            ["a", "b", "c", "d"],
            edges=[
                ("a", "c", {"link_type": "optional"}),
                ("a", "b", {"link_type": "hard"}),
                ("b", "c", {"link_type": "hard"}),
                ("c", "d", {"link_type": "optional"}),
            ],
        )
    )


def test_path_follows_optional_links_by_default():
    assert path_ids(shortest_paths(typed_graph(), "a", "c")) == [["a", "c"]]


def test_excluded_link_types_lengthen_the_path():
    result = shortest_paths(typed_graph(), "a", "c", exclude_link_types=["optional"])
    assert path_ids(result) == [["a", "b", "c"]]
    assert highlighted_edges(result) == [("a", "b"), ("b", "c")]


def test_excluded_link_types_can_remove_the_path():
    result = shortest_paths(typed_graph(), "a", "d", exclude_link_types=["optional"])
    assert result.direction is None


def test_excluded_link_types_apply_to_the_reverse_search():
    assert shortest_paths(typed_graph(), "d", "a").direction == "reverse"
    result = shortest_paths(typed_graph(), "d", "a", exclude_link_types=["optional"])
    assert result.direction is None


def test_excluding_an_absent_link_type_changes_nothing():
    result = shortest_paths(typed_graph(), "a", "c", exclude_link_types=["dynamic"])
    assert path_ids(result) == [["a", "c"]]
