import io
import tarfile

import pytest

from stellardeps import pacman

BASH_DESC = """\
%NAME%
bash

%VERSION%
5.3.15-1

%DEPENDS%
readline
libreadline.so=8-64
glibc>=2.38
ghost-pkg

%PROVIDES%
sh
"""

READLINE_DESC = """\
%NAME%
readline

%VERSION%
8.3-1

%PROVIDES%
libreadline.so=8-64
"""

GLIBC_DESC = """\
%NAME%
glibc

%VERSION%
2.42-1

%DEPENDS%
sh
"""


def make_sync_db(path, descs):
    """Write a pacman-style sync db tarball from {pkgdir: desc_text}."""
    with tarfile.open(path, "w:gz") as tar:
        for pkgdir, text in descs.items():
            data = text.encode()
            info = tarfile.TarInfo(f"{pkgdir}/desc")
            info.size = len(data)
            tar.addfile(info, io.BytesIO(data))


@pytest.fixture
def core_db(tmp_path):
    """A small fake core.db with bash, readline, and glibc."""
    db = tmp_path / "core.db"
    make_sync_db(
        db,
        {"bash-5.3.15-1": BASH_DESC, "readline-8.3-1": READLINE_DESC, "glibc-2.42-1": GLIBC_DESC},
    )
    return db


def test_parse_desc_sections():
    desc = pacman.parse_desc(BASH_DESC)
    assert desc["NAME"] == ["bash"]
    assert desc["VERSION"] == ["5.3.15-1"]
    assert desc["DEPENDS"] == ["readline", "libreadline.so=8-64", "glibc>=2.38", "ghost-pkg"]
    assert desc["PROVIDES"] == ["sh"]


def test_strip_constraint():
    assert pacman.strip_constraint("glibc>=2.38") == "glibc"
    assert pacman.strip_constraint("libreadline.so=8-64") == "libreadline.so"
    assert pacman.strip_constraint("attr<2.0") == "attr"
    assert pacman.strip_constraint("readline") == "readline"


def test_read_sync_db(core_db):
    entries = pacman.read_sync_db(core_db)
    assert {e["NAME"][0] for e in entries} == {"bash", "readline", "glibc"}


def test_build_payload_resolves_names_provides_and_drops_dangling(core_db):
    payload = pacman.build_payload([("core", pacman.read_sync_db(core_db))])
    assert {n.id for n in payload.nodes} == {"bash", "readline", "glibc"}
    assert all(n.kind == "core" for n in payload.nodes)
    versions = {n.id: n.attrs["version"] for n in payload.nodes}
    assert versions["bash"] == "5.3.15-1"
    edges = {(e.source, e.target) for e in payload.edges}
    # readline named + libreadline.so provide deduped to one edge; ghost-pkg dropped;
    # glibc's `sh` dep resolves to bash via its provide
    assert edges == {("bash", "readline"), ("bash", "glibc"), ("glibc", "bash")}


def test_build_payload_first_repo_wins_on_duplicates(core_db):
    dup = [{"NAME": ["bash"], "VERSION": ["9.9-9"]}]
    payload = pacman.build_payload([("core", pacman.read_sync_db(core_db)), ("extra", dup)])
    (bash,) = [n for n in payload.nodes if n.id == "bash"]
    assert bash.kind == "core"
    assert bash.attrs["version"] == "5.3.15-1"


def test_read_local_db(tmp_path):
    (tmp_path / "bash-5.3.15-1").mkdir()
    (tmp_path / "bash-5.3.15-1" / "desc").write_text(BASH_DESC)
    (tmp_path / "readline-8.3-1").mkdir()
    (tmp_path / "readline-8.3-1" / "desc").write_text(READLINE_DESC)
    entries = pacman.read_local_db(tmp_path)
    assert {e["NAME"][0] for e in entries} == {"bash", "readline"}


def test_installed_payload_uses_local_db(tmp_path, monkeypatch):
    (tmp_path / "glibc-2.42-1").mkdir()
    (tmp_path / "glibc-2.42-1" / "desc").write_text(GLIBC_DESC)
    monkeypatch.setattr(pacman, "LOCAL_DB_DIR", tmp_path)
    payload = pacman.installed_payload()
    assert [n.kind for n in payload.nodes] == ["installed"]
