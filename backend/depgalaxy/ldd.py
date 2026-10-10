"""Parse `ldd` output into a DepGalaxy GraphPayload."""

import re
import subprocess
from pathlib import Path

from depgalaxy.models import Edge, GraphPayload, Node


class LddError(RuntimeError):
    """Raised when ldd cannot be run on a binary."""


def run_ldd(binary: str) -> str:
    """Run ldd on `binary` and return its stdout; raise LddError on failure."""
    try:
        result = subprocess.run(["ldd", binary], capture_output=True, text=True, check=False)
    except FileNotFoundError as exc:
        raise LddError("ldd is not installed") from exc
    if result.returncode != 0:
        detail = result.stderr.strip() or f"ldd exited with {result.returncode}"
        raise LddError(f"ldd failed on {binary!r}: {detail}")
    return result.stdout


def ldd_payload(binary: str) -> GraphPayload:
    """Run ldd on `binary` and parse the output into a payload rooted at its basename."""
    return parse_ldd(run_ldd(binary), root=Path(binary).name)


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
