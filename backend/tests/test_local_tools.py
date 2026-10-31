from types import SimpleNamespace

import pytest
from dotenv import dotenv_values
from pydantic import SecretStr

from scripts import configure_local_jwt, local_database


def test_local_key_generation_preserves_existing_file(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(configure_local_jwt, "BACKEND_DIR", tmp_path)
    monkeypatch.delenv("JWT_SECRET_KEY", raising=False)
    target = tmp_path / ".env"
    target.write_text("LOG_LEVEL=WARNING\n", encoding="utf-8")
    assert configure_local_jwt.main() == 0
    generated = dotenv_values(target)["JWT_SECRET_KEY"]
    assert len(generated) >= 32
    assert target.read_text(encoding="utf-8").startswith("LOG_LEVEL=WARNING\n")
    assert generated not in capsys.readouterr().out
    before = target.read_bytes()
    assert configure_local_jwt.main() == 1
    assert target.read_bytes() == before


def test_local_key_generation_refuses_process_override(tmp_path, monkeypatch):
    monkeypatch.setattr(configure_local_jwt, "BACKEND_DIR", tmp_path)
    monkeypatch.setenv("JWT_SECRET_KEY", "test-placeholder")
    assert configure_local_jwt.main() == 1
    assert not (tmp_path / ".env").exists()


@pytest.mark.parametrize("url", [
    "postgresql+psycopg://dev@remote.example:5433/dev",
    "postgresql+psycopg://dev@127.0.0.1:5433/other",
    "postgresql+psycopg://dev@127.0.0.1:5433/dev?host=remote.example",
    "postgresql+psycopg://dev@127.0.0.1:5432/dev",
])
def test_local_target_guard_refuses_unknown_targets(monkeypatch, url):
    monkeypatch.setattr(local_database, "get_database_settings", lambda: SimpleNamespace(database_url=SecretStr(url)))
    monkeypatch.setattr(local_database, "dotenv_values", lambda _: {"POSTGRES_PORT": "5433", "POSTGRES_DB": "dev", "POSTGRES_USER": "dev"})
    with pytest.raises(local_database.LocalDatabaseError):
        local_database.local_url()
