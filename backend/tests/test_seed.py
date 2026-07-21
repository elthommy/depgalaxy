from stellardeps.graph_engine import build_graph
from stellardeps.ldd import parse_ldd
from stellardeps.seed import generate_demo_graph

LDD_OUTPUT = """\
\tlinux-vdso.so.1 (0x00007ffcd1d92000)
\tlibcurl.so.4 => /usr/lib/libcurl.so.4 (0x00007f2c8a400000)
\tlibc.so.6 => /usr/lib/libc.so.6 (0x00007f2c8a1f3000)
\tlibmagic.so.1 => not found
\t/lib64/ld-linux-x86-64.so.2 => /usr/lib64/ld-linux-x86-64.so.2 (0x00007f2c8a71f000)
"""


def test_demo_graph_is_valid_and_sized():
    payload = generate_demo_graph()
    graph = build_graph(payload)
    assert len(graph.nodes) == 2000
    assert len(graph.children) == 15
    assert len(graph.edges) > 1500


def test_demo_graph_mixes_link_types():
    payload = generate_demo_graph()
    link_types = {e.attrs["link_type"] for e in payload.edges}
    assert link_types == {"dynamic", "static"}


def test_demo_graph_is_deterministic():
    assert generate_demo_graph(node_count=200) == generate_demo_graph(node_count=200)


def test_demo_graph_respects_node_count():
    payload = generate_demo_graph(node_count=300, pack_count=5)
    graph = build_graph(payload)
    assert len(graph.nodes) == 300
    assert len(graph.children) == 5


def test_parse_ldd_builds_star_graph():
    payload = parse_ldd(LDD_OUTPUT, root="curl")
    graph = build_graph(payload)
    assert graph.nodes["curl"].kind == "binary"
    assert set(graph.nodes) == {
        "curl",
        "linux-vdso.so.1",
        "libcurl.so.4",
        "libc.so.6",
        "libmagic.so.1",
        "ld-linux-x86-64.so.2",
    }
    assert all(e.source == "curl" and e.attrs == {"link_type": "dynamic"} for e in graph.edges)
    assert graph.nodes["libc.so.6"].attrs == {"path": "/usr/lib/libc.so.6"}
    assert graph.nodes["libmagic.so.1"].attrs == {}


def test_parse_ldd_statically_linked():
    payload = parse_ldd("\tstatically linked\n", root="busybox")
    assert [n.id for n in payload.nodes] == ["busybox"]
    assert payload.edges == []
