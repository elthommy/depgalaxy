import subprocess

import pytest
from fastapi.testclient import TestClient

from stellardeps import api, feeds, ldd

client = TestClient(api.app)

LDD_OUTPUT = """\
\tlinux-vdso.so.1 (0x00007fff0000)
\tlibc.so.6 => /usr/lib/libc.so.6 (0x00007f000000)
"""


@pytest.fixture(autouse=True)
def clean_state():
    """Start every test with no graph imported."""
    api._current_graph = None
    yield
    api._current_graph = None


def test_list_feeds_returns_registry():
    response = client.get("/feeds")
    assert response.status_code == 200
    listed = {f["id"]: f for f in response.json()}
    assert set(listed) == {
        "demo-small",
        "demo-medium",
        "demo-large",
        "arch-core",
        "arch-core-extra",
        "arch-installed",
        "ldd-ls",
        "ldd-python3",
    }
    assert listed["demo-small"]["kind"] == "demo"
    assert listed["arch-core"]["kind"] == "pacman"
    assert listed["ldd-ls"]["kind"] == "ldd"
    assert all(f["available"] for f in listed.values() if f["kind"] == "demo")


def test_run_demo_feed_replaces_graph():
    response = client.post("/feeds/demo-small/run")
    assert response.status_code == 200
    counts = response.json()
    assert counts["nodes"] == 500
    assert counts["packs"] == 8
    assert client.get("/graph").status_code == 200


def test_run_unknown_feed_is_404():
    response = client.post("/feeds/ghost/run")
    assert response.status_code == 404
    assert "unknown feed" in response.json()["detail"]


def test_run_unavailable_feed_is_503(monkeypatch):
    monkeypatch.setattr(feeds.shutil, "which", lambda _: None)
    response = client.post("/feeds/ldd-ls/run")
    assert response.status_code == 503
    assert "ldd is not installed" in response.json()["detail"]


def test_pacman_feed_unavailable_without_sync_db(tmp_path, monkeypatch):
    monkeypatch.setattr(feeds.pacman, "SYNC_DB_DIR", tmp_path)
    response = client.post("/feeds/arch-core/run")
    assert response.status_code == 503
    assert "missing pacman sync db: core.db" in response.json()["detail"]


def test_run_ldd_success(monkeypatch):
    def fake_run(cmd, capture_output, text):
        """Pretend ldd succeeded."""
        return subprocess.CompletedProcess(cmd, 0, stdout=LDD_OUTPUT, stderr="")

    monkeypatch.setattr(ldd.subprocess, "run", fake_run)
    assert ldd.run_ldd("/bin/ls") == LDD_OUTPUT


def test_run_ldd_failure_raises(monkeypatch):
    def fake_run(cmd, capture_output, text):
        """Pretend ldd failed."""
        return subprocess.CompletedProcess(cmd, 1, stdout="", stderr="no such file")

    monkeypatch.setattr(ldd.subprocess, "run", fake_run)
    with pytest.raises(ldd.LddError, match="no such file"):
        ldd.run_ldd("/bin/ghost")


def test_ldd_payload_parses_output(monkeypatch):
    monkeypatch.setattr(ldd, "run_ldd", lambda binary: LDD_OUTPUT)
    payload = ldd.ldd_payload("/bin/ls")
    ids = {n.id for n in payload.nodes}
    assert ids == {"ls", "linux-vdso.so.1", "libc.so.6"}
    assert all(e.source == "ls" for e in payload.edges)
