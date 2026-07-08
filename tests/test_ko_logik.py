"""K.O.-Pruefung: reine Python-Logik ueber den klassifizierten Dokumenten."""

from core.pipeline import pruefe_ko
from core.schemas import DokumentTyp, KOGrund

CV = {"typ": DokumentTyp.LEBENSLAUF}
MOTIVATION = {"typ": DokumentTyp.MOTIVATIONSSCHREIBEN}
SONSTIGES = {"typ": DokumentTyp.SONSTIGES}


def test_fehlender_lebenslauf_ist_ko():
    ko = pruefe_ko([MOTIVATION], {"lebenslauf_erforderlich": True})
    assert ko == KOGrund.LEBENSLAUF_FEHLT


def test_fehlendes_motivationsschreiben_ist_ko_wenn_erforderlich():
    ko = pruefe_ko(
        [CV],
        {"lebenslauf_erforderlich": True, "motivationsschreiben_erforderlich": True},
    )
    assert ko == KOGrund.MOTIVATIONSSCHREIBEN_FEHLT


def test_vollstaendige_bewerbung_ohne_ko():
    ko = pruefe_ko(
        [CV, MOTIVATION, SONSTIGES],
        {"lebenslauf_erforderlich": True, "motivationsschreiben_erforderlich": True},
    )
    assert ko is None


def test_deaktivierte_kriterien_greifen_nicht():
    ko = pruefe_ko(
        [SONSTIGES],
        {"lebenslauf_erforderlich": False, "motivationsschreiben_erforderlich": False},
    )
    assert ko is None


def test_default_lebenslauf_pflicht_motivation_optional():
    # Fehlende Keys: Lebenslauf ist per Default Pflicht, Motivation nicht
    assert pruefe_ko([MOTIVATION], {}) == KOGrund.LEBENSLAUF_FEHLT
    assert pruefe_ko([CV], {}) is None


def test_fehlt_beides_zaehlt_der_lebenslauf_zuerst():
    ko = pruefe_ko(
        [SONSTIGES],
        {"lebenslauf_erforderlich": True, "motivationsschreiben_erforderlich": True},
    )
    assert ko == KOGrund.LEBENSLAUF_FEHLT
