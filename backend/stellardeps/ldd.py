"""Parse `ldd` output into a Stellardeps GraphPayload."""

import re

from stellardeps.models import Edge, GraphPayload, Node

_LDD_DEP = re.compile(r"^(?P<name>\S+)(?:\s*=>\s*(?P<path>\S+))?\s*(?:\(0x[0-9a-fA-F]+\))?$")
_SKIP_MARKERS = ("statically linked", "not a dynamic executable")


def parse_ldd(output: str, root: str) -> GraphPayload:
    """Convert one binary's `ldd` output into a payload: the binary plus its dynamic libs."""
    nodes = {root: Node(id=root, label=root, kind="binary")}
    edges: list[Edge] = []
    for line in output.splitlines():
        entry = _parse_line(line)
        if entry is None:
            continue
        name, path = entry
        if name == root:
            continue
        if name not in nodes:
            nodes[name] = Node(
                id=name, label=name, kind="library", attrs={"path": path} if path else {}
            )
            edges.append(Edge(source=root, target=name, attrs={"link_type": "dynamic"}))
    return GraphPayload(nodes=list(nodes.values()), edges=edges)


def _parse_line(line: str) -> tuple[str, str | None] | None:
    """Parse one ldd line into (soname, path); None for non-dependency lines."""
    stripped = line.strip()
    if not stripped or any(marker in stripped for marker in _SKIP_MARKERS):
        return None
    if stripped.endswith("=> not found"):
        return stripped.split("=>")[0].strip(), None
    match = _LDD_DEP.match(stripped)
    if match is None:
        return None
    name = match.group("name")
    if name.startswith("/"):
        # the dynamic loader is listed by absolute path
        return name.rsplit("/", 1)[-1], match.group("path") or name
    return name, match.group("path")
