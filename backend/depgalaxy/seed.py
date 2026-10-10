"""Deterministic demo-graph generator for DepGalaxy."""

import random

from depgalaxy.models import Containment, Edge, GraphPayload, Node

PACK_NAMES = (
    "nova",
    "orion",
    "vega",
    "lyra",
    "atlas",
    "cosmo",
    "astro",
    "pulsar",
    "quasar",
    "nebula",
    "zenith",
    "argo",
    "helio",
    "sirius",
    "draco",
)
MODULE_SUFFIXES = ("core", "utils", "io", "net", "math", "gfx", "db", "auth", "cli", "rt")
MEMBER_KINDS = ("library",) * 8 + ("service", "tool")
LINK_TYPES = ("dynamic",) * 7 + ("static",) * 3


def generate_demo_graph(
    node_count: int = 2000, pack_count: int = 15, seed: int = 42
) -> GraphPayload:
    """Generate a deterministic demo galaxy with packs and mixed link types."""
    rng = random.Random(seed)
    packs = [
        Node(id=f"pack-{i:02d}", label=PACK_NAMES[i % len(PACK_NAMES)], kind="package")
        for i in range(pack_count)
    ]
    loose_count = max(node_count // 13, 1)
    member_count = node_count - pack_count - loose_count
    members, containment = _make_members(rng, packs, member_count)
    loose = _make_loose_nodes(rng, loose_count)
    edges = _make_edges(rng, members, loose)
    return GraphPayload(nodes=packs + members + loose, edges=edges, containment=containment)


def _make_members(
    rng: random.Random, packs: list[Node], member_count: int
) -> tuple[list[Node], list[Containment]]:
    """Create member nodes distributed over the packs with uneven sizes."""
    weights = [rng.uniform(0.5, 3.0) for _ in packs]
    members: list[Node] = []
    containment: list[Containment] = []
    for i in range(member_count):
        # round-robin the first few so every pack has at least two members
        pack = packs[i % len(packs)] if i < 2 * len(packs) else rng.choices(packs, weights)[0]
        suffix = rng.choice(MODULE_SUFFIXES)
        node = Node(
            id=f"{pack.label}-{suffix}-{i:04d}",
            label=f"{pack.label}-{suffix}-{i:04d}",
            kind=rng.choice(MEMBER_KINDS),
        )
        members.append(node)
        containment.append(Containment(parent=pack.id, child=node.id))
    return members, containment


def _make_loose_nodes(rng: random.Random, loose_count: int) -> list[Node]:
    """Create standalone nodes that belong to no pack."""
    return [
        Node(
            id=f"star-{i:04d}",
            label=f"star-{i:04d}",
            kind=rng.choice(("binary",) + MEMBER_KINDS),
        )
        for i in range(loose_count)
    ]


def _make_edges(rng: random.Random, members: list[Node], loose: list[Node]) -> list[Edge]:
    """Wire intra-pack hubs, cross-pack links, and loose-node links."""
    by_pack: dict[str, list[Node]] = {}
    for member in members:
        by_pack.setdefault(member.id.split("-")[0], []).append(member)
    edges: list[Edge] = []
    for group in by_pack.values():
        hub = group[0]
        for member in group[1:]:
            target = hub if rng.random() < 0.6 else rng.choice(group)
            if target.id != member.id:
                edges.append(_edge(rng, member.id, target.id))
            if rng.random() < 0.2:
                edges.append(_edge(rng, member.id, rng.choice(members).id))
    for node in loose:
        for _ in range(rng.randint(1, 3)):
            edges.append(_edge(rng, node.id, rng.choice(members).id))
    return [e for e in edges if e.source != e.target]


def _edge(rng: random.Random, source: str, target: str) -> Edge:
    """Build a depends_on edge with a randomly chosen link_type."""
    return Edge(source=source, target=target, attrs={"link_type": rng.choice(LINK_TYPES)})
