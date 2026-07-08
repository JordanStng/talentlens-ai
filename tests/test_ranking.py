"""Deterministisches Ranking: gewichteter Gesamt-Score und Empfehlung."""

import pytest

from conftest import beispiel_bewertung
from core.config import KRITERIEN_GEWICHTE, SCHWELLE_EINLADEN, SCHWELLE_PRUEFEN
from core.ranking import berechne_gesamtscore, leite_empfehlung_ab, sortiere_ergebnisse

ALLE_KRITERIEN = list(KRITERIEN_GEWICHTE)


def test_gewichte_summieren_auf_eins():
    assert sum(KRITERIEN_GEWICHTE.values()) == pytest.approx(1.0)


def test_maximale_scores_ergeben_100():
    bewertung = beispiel_bewertung({name: 10 for name in ALLE_KRITERIEN})
    assert berechne_gesamtscore(bewertung) == 100.0


def test_minimale_scores_ergeben_10():
    bewertung = beispiel_bewertung({name: 1 for name in ALLE_KRITERIEN})
    assert berechne_gesamtscore(bewertung) == 10.0


def test_gewichtete_summe():
    scores = {
        "berufserfahrung": 8,
        "skills": 6,
        "ausbildung": 10,
        "sprachkenntnisse": 4,
    }
    erwartet = round(
        sum(KRITERIEN_GEWICHTE[name] * score for name, score in scores.items()) * 10,
        1,
    )
    assert berechne_gesamtscore(beispiel_bewertung(scores)) == erwartet


def test_fehlendes_kriterium_zaehlt_konservativ_als_1():
    bewertung = beispiel_bewertung({"berufserfahrung": 10})  # Rest fehlt
    erwartet = round(
        (
            KRITERIEN_GEWICHTE["berufserfahrung"] * 10
            + sum(
                gewicht
                for name, gewicht in KRITERIEN_GEWICHTE.items()
                if name != "berufserfahrung"
            )
        )
        * 10,
        1,
    )
    assert berechne_gesamtscore(bewertung) == erwartet


def test_empfehlung_schwellen():
    assert leite_empfehlung_ab(SCHWELLE_EINLADEN) == "Einladen"
    assert leite_empfehlung_ab(SCHWELLE_EINLADEN - 0.1) == "Pruefen"
    assert leite_empfehlung_ab(SCHWELLE_PRUEFEN) == "Pruefen"
    assert leite_empfehlung_ab(SCHWELLE_PRUEFEN - 0.1) == "Ablehnen"
    assert leite_empfehlung_ab(100.0) == "Einladen"
    assert leite_empfehlung_ab(10.0) == "Ablehnen"


def test_sortierung_beste_zuerst():
    ergebnisse = [
        {"kandidat": "B", "gesamt_score": 55.0},
        {"kandidat": "A", "gesamt_score": 91.5},
        {"kandidat": "C", "gesamt_score": 73.0},
    ]
    sortiert = sortiere_ergebnisse(ergebnisse)
    assert [e["kandidat"] for e in sortiert] == ["A", "C", "B"]
