"""SQLite-Persistenz: Ergebnisse und Entwuerfe (gegen eine Temp-DB)."""

from conftest import beispiel_ergebnis
from core.schemas import KOGrund
from core.storage import _sicherer_dateiname, stelle_titel


def test_ergebnis_roundtrip(temp_storage):
    temp_storage.speichere_ergebnis(beispiel_ergebnis("Anna Schmidt"))
    eintraege = temp_storage.lade_ergebnisse()
    assert len(eintraege) == 1
    eintrag = eintraege[0]
    assert eintrag["kandidat"] == "Anna Schmidt"
    assert eintrag["status"] == "genehmigt"
    assert eintrag["gesamt_score"] == 80.0
    assert eintrag["stelle_titel"] == "Junior Data Analyst"
    assert eintrag["bewertung"]["kriterien"][0]["score"] == 8


def test_ko_ergebnis_ohne_bewertung(temp_storage):
    temp_storage.speichere_ergebnis(
        beispiel_ergebnis("Ben Keller", ko_grund=KOGrund.MOTIVATIONSSCHREIBEN_FEHLT)
    )
    eintrag = temp_storage.lade_ergebnisse()[0]
    assert eintrag["status"] == "abgelehnt"
    assert eintrag["ko_grund"] == "motivationsschreiben_fehlt"
    assert eintrag["bewertung"] is None
    assert eintrag["gesamt_score"] is None


def test_neueste_ergebnisse_zuerst(temp_storage):
    temp_storage.speichere_ergebnis(beispiel_ergebnis("Erste"))
    temp_storage.speichere_ergebnis(beispiel_ergebnis("Zweite"))
    kandidaten = [e["kandidat"] for e in temp_storage.lade_ergebnisse()]
    assert kandidaten == ["Zweite", "Erste"]


def test_stelle_titel():
    assert stelle_titel("# Junior Data Analyst\n\nText") == "Junior Data Analyst"
    assert stelle_titel("\n\n  Data Engineer  \n") == "Data Engineer"
    assert stelle_titel("") == "Unbenannte Stelle"
    assert len(stelle_titel("x" * 500)) == 120


def test_entwurf_suche_ist_case_insensitiv(temp_storage):
    temp_storage.erstelle_entwurf("Anna Schmidt")
    gefunden = temp_storage.finde_entwurf_nach_kandidat("  anna schmidt ")
    assert gefunden is not None
    assert gefunden["kandidat"] == "Anna Schmidt"
    assert temp_storage.finde_entwurf_nach_kandidat("Ben Keller") is None


def test_dateiname_ohne_pfad_tricks():
    assert _sicherer_dateiname("../../etc/passwd.pdf") == "passwd.pdf"
    assert _sicherer_dateiname("cv?*|.pdf") == "cv___.pdf"
    assert _sicherer_dateiname("") == "datei.pdf"


def test_namenskollision_bekommt_suffix(temp_storage):
    entwurf = temp_storage.erstelle_entwurf("Anna Schmidt")
    temp_storage.speichere_entwurf_datei(entwurf["id"], "cv.pdf", b"eins")
    temp_storage.speichere_entwurf_datei(entwurf["id"], "cv.pdf", b"zwei")
    namen = [d["name"] for d in temp_storage.entwurf_dateien(entwurf["id"])]
    assert namen == ["cv (2).pdf", "cv.pdf"]
