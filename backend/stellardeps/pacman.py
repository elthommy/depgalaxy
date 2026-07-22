"""Parse pacman databases (sync .db tarballs and the local install DB) into payloads."""

import tarfile
from pathlib import Path

from stellardeps.models import Edge, GraphPayload, Node

SYNC_DB_DIR = Path("/var/lib/pacman/sync")
LOCAL_DB_DIR = Path("/var/lib/pacman/local")


def parse_desc(text: str) -> dict[str, list[str]]:
    """Parse a pacman `desc` file into a %SECTION% -> values mapping."""
    sections: dict[str, list[str]] = {}
    current: str | None = None
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            current = None
        elif line.startswith("%") and line.endswith("%"):
            current = line.strip("%")
            sections[current] = []
        elif current is not None:
            sections[current].append(line)
    return sections


def read_sync_db(path: Path) -> list[dict[str, list[str]]]:
    """Read every package desc from a sync database (a gzipped tar of <pkg>/desc files)."""
    entries = []
    with tarfile.open(path, "r:*") as tar:
        for member in tar:
            if member.isfile() and member.name.endswith("/desc"):
                data = tar.extractfile(member)
                if data is not None:
                    entries.append(parse_desc(data.read().decode()))
    return entries


def read_local_db(path: Path) -> list[dict[str, list[str]]]:
    """Read every installed package desc from the local pacman database directory."""
    return [parse_desc(p.read_text()) for p in sorted(path.glob("*/desc"))]


def strip_constraint(spec: str) -> str:
    """Drop the version constraint from a dependency spec, e.g. 'glibc>=2.38' -> 'glibc'."""
    for i, ch in enumerate(spec):
        if ch in "<>=":
            return spec[:i]
    return spec


# (desc section, link_type, edge relation): hard deps, optional deps, conflicts
_EDGE_SECTIONS = (
    ("DEPENDS", "hard", "depends_on"),
    ("OPTDEPENDS", "optional", "depends_on"),
    ("CONFLICTS", "conflicts", "conflicts_with"),
)


def build_payload(repos: list[tuple[str, list[dict[str, list[str]]]]]) -> GraphPayload:
    """Build a payload from (repo, desc entries) pairs; node kind is the repo name.

    %DEPENDS%, %OPTDEPENDS%, and %CONFLICTS% become typed edges. Specs are
    resolved through package names first, then %PROVIDES% entries (virtual
    packages, shared libraries); unresolvable specs are dropped. On
    duplicate package names the first repo wins.
    """
    nodes: dict[str, Node] = {}
    descs: dict[str, dict[str, list[str]]] = {}
    provides: dict[str, str] = {}
    for repo, entries in repos:
        for desc in entries:
            name = desc["NAME"][0]
            if name in nodes:
                continue
            version = desc.get("VERSION", [""])[0]
            nodes[name] = Node(id=name, label=name, kind=repo, attrs={"version": version})
            descs[name] = desc
            for spec in desc.get("PROVIDES", []):
                provides.setdefault(strip_constraint(spec), name)
    edges = _dep_edges(descs, provides)
    return GraphPayload(nodes=list(nodes.values()), edges=edges)


def _dep_edges(descs: dict[str, dict[str, list[str]]], provides: dict[str, str]) -> list[Edge]:
    """Resolve dependency and conflict specs into typed, deduplicated edges.

    Sections are processed in _EDGE_SECTIONS order, so a package that is
    both a hard and an optional dependency keeps the hard edge.
    """
    edges: list[Edge] = []
    seen: set[tuple[str, str, str]] = set()
    for name, desc in descs.items():
        for section, link_type, relation in _EDGE_SECTIONS:
            for spec in desc.get(section, []):
                # optdepends specs read "package: reason" — drop the reason
                dep = strip_constraint(spec.split(":")[0].strip())
                target = dep if dep in descs else provides.get(dep)
                if target is None or target == name or (name, target, relation) in seen:
                    continue
                seen.add((name, target, relation))
                edges.append(
                    Edge(
                        source=name,
                        target=target,
                        relation=relation,
                        attrs={"link_type": link_type},
                    )
                )
    return edges


def sync_payload(repos: list[str]) -> GraphPayload:
    """Build a payload from sync databases by repo name, e.g. ["core", "extra"]."""
    return build_payload([(repo, read_sync_db(SYNC_DB_DIR / f"{repo}.db")) for repo in repos])


def installed_payload() -> GraphPayload:
    """Build a payload from the local database of installed packages."""
    return build_payload([("installed", read_local_db(LOCAL_DB_DIR))])
