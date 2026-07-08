"""Pydantic-Schemas: Die Validierung faengt unplausible LLM-Outputs ab."""

import pytest
from pydantic import ValidationError

from conftest import beispiel_bewertung
from core.schemas import Bewertung, DokumentSegment, KriteriumScore, PdfAufteilung


@pytest.mark.parametrize("score", [0, 11, -3])
def test_score_ausserhalb_1_bis_10_wird_abgewiesen(score):
    with pytest.raises(ValidationError):
        KriteriumScore(
            kriterium="skills", score=score, begruendung="x", belege=[]
        )


@pytest.mark.parametrize("score", [1, 10])
def test_score_grenzen_sind_gueltig(score):
    ks = KriteriumScore(kriterium="skills", score=score, begruendung="x", belege=[])
    assert ks.score == score


def test_unbekanntes_kriterium_wird_abgewiesen():
    with pytest.raises(ValidationError):
        KriteriumScore(kriterium="humor", score=5, begruendung="x", belege=[])


def test_segment_seiten_muessen_ab_1_zaehlen():
    with pytest.raises(ValidationError):
        DokumentSegment(start_seite=0, end_seite=1, typ="lebenslauf")


def test_aufteilung_ohne_erkannten_namen_ist_gueltig():
    aufteilung = PdfAufteilung(
        segmente=[DokumentSegment(start_seite=1, end_seite=2, typ="lebenslauf")]
    )
    assert aufteilung.kandidat is None


def test_bewertung_json_roundtrip():
    bewertung = beispiel_bewertung({"skills": 7, "berufserfahrung": 9})
    kopie = Bewertung.model_validate_json(bewertung.model_dump_json())
    assert kopie == bewertung
