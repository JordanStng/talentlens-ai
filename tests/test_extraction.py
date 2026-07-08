"""Text-Bereinigung und Schutz gegen gescannte PDFs (kein OCR)."""

import pytest

from core.extraction import bereinige_text

LANGER_TEXT = "Berufserfahrung als Data Analyst mit Python, SQL und Tableau. " * 3


def test_mehrfach_leerzeichen_werden_zusammengefasst():
    text = bereinige_text("Python   und \t SQL. " + LANGER_TEXT)
    assert "Python und SQL." in text


def test_leerzeilen_stapel_werden_reduziert():
    text = bereinige_text("Abschnitt A\n\n\n\n\nAbschnitt B " + LANGER_TEXT)
    assert "Abschnitt A\n\nAbschnitt B" in text


def test_nullbytes_werden_entfernt():
    assert "\x00" not in bereinige_text("A\x00B " + LANGER_TEXT)


def test_zu_wenig_text_deutet_auf_scan_und_wirft_fehler():
    with pytest.raises(ValueError, match="gescanntes PDF"):
        bereinige_text("Nur ein paar Zeichen")
