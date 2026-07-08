"""Gemeinsame Test-Konfiguration.

Projekt-Root in den Import-Pfad haengen (es gibt bewusst kein installier-
bares Package) und Storage-Fixtures bereitstellen, die SQLite/Uploads in
ein Temp-Verzeichnis umbiegen - Tests beruehren nie die echte data/-DB.
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core import storage  # noqa: E402
from core.schemas import Bewertung, DokumentTyp, KriteriumScore  # noqa: E402


@pytest.fixture
def temp_storage(tmp_path, monkeypatch):
    """SQLite und Uploads in ein frisches Temp-Verzeichnis umleiten."""
    monkeypatch.setattr(storage, "DB_PFAD", tmp_path / "test.db")
    monkeypatch.setattr(storage, "UPLOADS_PFAD", tmp_path / "uploads")
    return storage


def beispiel_bewertung(scores: dict[str, int]) -> Bewertung:
    """Bewertung mit gegebenen Kriterien-Scores (Rest-Felder minimal)."""
    return Bewertung(
        kriterien=[
            KriteriumScore(
                kriterium=name, score=score, begruendung="Test", belege=["Zitat"]
            )
            for name, score in scores.items()
        ],
        staerken=["Teststaerke"],
        ablehnungsgruende=[],
        zusammenfassung="Testzusammenfassung",
    )


def beispiel_ergebnis(
    kandidat: str = "Anna Schmidt",
    scores: dict[str, int] | None = None,
    ko_grund=None,
) -> dict:
    """Pipeline-Ergebnis-Dict, wie es storage.speichere_ergebnis erwartet."""
    bewertet = ko_grund is None
    return {
        "kandidat": kandidat,
        "stelle": "# Junior Data Analyst\nAnforderungen ...",
        "status": "genehmigt" if bewertet else "abgelehnt",
        "ko_grund": ko_grund,
        "gesamt_score": 80.0 if bewertet else None,
        "empfehlung": "Einladen" if bewertet else None,
        "korrigiert": False,
        "dokumente": [{"name": "cv.pdf", "typ": DokumentTyp.LEBENSLAUF}],
        "bewertung": beispiel_bewertung(
            scores
            or {
                "berufserfahrung": 8,
                "skills": 8,
                "ausbildung": 8,
                "sprachkenntnisse": 8,
            }
        )
        if bewertet
        else None,
    }
