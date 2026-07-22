"""Registry of predefined feeds the API can build and load on request."""

import shutil
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from pydantic import BaseModel

from stellardeps import pacman
from stellardeps.ldd import LddError, ldd_payload
from stellardeps.models import GraphPayload
from stellardeps.seed import generate_demo_graph


class FeedUnavailableError(RuntimeError):
    """Raised when a feed exists but cannot run in this environment."""


class FeedInfo(BaseModel):
    """A feed as listed by GET /feeds."""

    id: str
    label: str
    description: str
    kind: str
    available: bool = True


@dataclass(frozen=True)
class Feed:
    """A named graph source: build() returns a payload, check() an unavailability reason."""

    id: str
    label: str
    description: str
    kind: str  # "demo" | "ldd"
    build: Callable[[], GraphPayload]
    check: Callable[[], str | None]


def _always_available() -> str | None:
    """Availability check for feeds with no external requirements."""
    return None


def _demo_feed(feed_id: str, label: str, nodes: int, packs: int) -> Feed:
    """Build a demo-galaxy feed of the given size."""
    return Feed(
        id=feed_id,
        label=label,
        description=f"deterministic demo galaxy · {nodes} nodes / {packs} packs",
        kind="demo",
        build=lambda: generate_demo_graph(nodes, packs),
        check=_always_available,
    )


def _ldd_check(binary: str) -> str | None:
    """Return why an ldd feed cannot run (missing ldd or binary), or None."""
    if shutil.which("ldd") is None:
        return "ldd is not installed"
    if not Path(binary).exists():
        return f"binary not found: {binary}"
    return None


def _pacman_sync_check(repos: list[str]) -> str | None:
    """Return why the sync databases for `repos` cannot be read, or None."""
    for repo in repos:
        if not (pacman.SYNC_DB_DIR / f"{repo}.db").exists():
            return f"missing pacman sync db: {repo}.db"
    return None


def _pacman_sync_feed(feed_id: str, label: str, repos: list[str]) -> Feed:
    """Build a feed over one or more pacman sync repositories."""
    return Feed(
        id=feed_id,
        label=label,
        description=f"Arch Linux packages of {' + '.join(repos)} with their dependencies",
        kind="pacman",
        build=lambda: pacman.sync_payload(repos),
        check=lambda: _pacman_sync_check(repos),
    )


def _pacman_installed_check() -> str | None:
    """Return why the local pacman database cannot be read, or None."""
    if not pacman.LOCAL_DB_DIR.is_dir():
        return f"missing pacman local db: {pacman.LOCAL_DB_DIR}"
    return None


def _pacman_installed_feed() -> Feed:
    """Build the feed over the locally installed packages."""
    return Feed(
        id="arch-installed",
        label="Arch Linux · installed packages",
        description="packages installed on this machine with their dependencies",
        kind="pacman",
        build=pacman.installed_payload,
        check=_pacman_installed_check,
    )


def _ldd_feed(feed_id: str, binary: str) -> Feed:
    """Build a feed that imports one binary's dynamic libraries via ldd."""
    return Feed(
        id=feed_id,
        label=f"ldd · {binary}",
        description=f"dynamic libraries of {binary} (via ldd)",
        kind="ldd",
        build=lambda: ldd_payload(binary),
        check=lambda: _ldd_check(binary),
    )


FEEDS: dict[str, Feed] = {
    feed.id: feed
    for feed in (
        _demo_feed("demo-small", "Demo galaxy (small)", 500, 8),
        _demo_feed("demo-medium", "Demo galaxy (medium)", 2000, 15),
        _demo_feed("demo-large", "Demo galaxy (large)", 5000, 25),
        _pacman_sync_feed("arch-core", "Arch Linux · core", ["core"]),
        _pacman_sync_feed("arch-core-extra", "Arch Linux · core + extra", ["core", "extra"]),
        _pacman_installed_feed(),
        _ldd_feed("ldd-ls", "/bin/ls"),
        _ldd_feed("ldd-python3", "/usr/bin/python3"),
    )
}


def list_feeds() -> list[FeedInfo]:
    """List every registered feed with its current availability."""
    return [
        FeedInfo(
            id=feed.id,
            label=feed.label,
            description=feed.description,
            kind=feed.kind,
            available=feed.check() is None,
        )
        for feed in FEEDS.values()
    ]


def build_feed(feed_id: str) -> GraphPayload:
    """Build the payload for a feed; KeyError if unknown, FeedUnavailableError if it cannot run."""
    feed = FEEDS[feed_id]
    reason = feed.check()
    if reason is not None:
        raise FeedUnavailableError(reason)
    try:
        return feed.build()
    except LddError as exc:
        raise FeedUnavailableError(str(exc)) from exc
