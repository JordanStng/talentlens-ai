"""HR-Assistent: Werkzeuge und Agent-Loop (mit Fake-LLM, ohne API-Key).

Das Fake-Modell liefert vorgegebene Antworten inklusive tool_calls - so
laesst sich pruefen, dass der Loop Werkzeuge wirklich ausfuehrt, die
Aufrufe protokolliert und beim Runden-Limit sauber abschliesst.
"""

from langchain_core.language_models import GenericFakeChatModel
from langchain_core.messages import AIMessage

from conftest import beispiel_ergebnis
from core.agent import MAX_RUNDEN, beantworte_frage, build_werkzeuge
from core.schemas import KOGrund


class WerkzeugFakeLLM(GenericFakeChatModel):
    """GenericFakeChatModel kann kein bind_tools - hier reicht ein No-Op,
    denn die 'Tool-Entscheidungen' stecken schon in den Fake-Antworten."""

    def bind_tools(self, tools, **kwargs):
        return self


def tool_aufruf(name: str, args: dict, id_: str = "call_1") -> AIMessage:
    return AIMessage(content="", tool_calls=[{"name": name, "args": args, "id": id_}])


def seed(temp_storage):
    temp_storage.speichere_ergebnis(
        beispiel_ergebnis("Anna Schmidt", scores={
            "berufserfahrung": 9, "skills": 8, "ausbildung": 9, "sprachkenntnisse": 7,
        })
    )
    temp_storage.speichere_ergebnis(
        beispiel_ergebnis("Ben Keller", ko_grund=KOGrund.MOTIVATIONSSCHREIBEN_FEHLT)
    )


# --- Werkzeuge (direkt, ohne LLM) -------------------------------------------

def werkzeuge(stelle: str = ""):
    return {w.name: w for w in build_werkzeuge(stelle)}


def test_liste_bewerbungen_filtert_nach_status(temp_storage):
    seed(temp_storage)
    abgelehnte = werkzeuge()["liste_bewerbungen"].invoke({"status": "abgelehnt"})
    assert [e["kandidat"] for e in abgelehnte] == ["Ben Keller"]
    assert abgelehnte[0]["ko_grund"] == "Kein Motivationsschreiben eingereicht"
    assert len(werkzeuge()["liste_bewerbungen"].invoke({"status": "alle"})) == 2


def test_hole_bewertung_findet_teil_treffer(temp_storage):
    seed(temp_storage)
    detail = werkzeuge()["hole_bewertung"].invoke({"kandidat": "anna"})
    assert detail["kandidat"] == "Anna Schmidt"
    assert {k["kriterium"]: k["score"] for k in detail["kriterien"]}["skills"] == 8
    assert detail["zusammenfassung"]


def test_hole_bewertung_unbekannter_name_nennt_kandidaten(temp_storage):
    seed(temp_storage)
    detail = werkzeuge()["hole_bewertung"].invoke({"kandidat": "Clara Witt"})
    assert "fehler" in detail
    assert detail["vorhandene_kandidaten"] == ["Anna Schmidt", "Ben Keller"]


def test_ko_kandidat_hat_hinweis_statt_kriterien(temp_storage):
    seed(temp_storage)
    detail = werkzeuge()["hole_bewertung"].invoke({"kandidat": "Ben Keller"})
    assert "K.O." in detail["hinweis"]
    assert "kriterien" not in detail


def test_statistik_zaehlt_status_und_gruende(temp_storage):
    seed(temp_storage)
    stats = werkzeuge()["statistik"].invoke({})
    assert stats["anzahl_gesamt"] == 2
    assert stats["genehmigt"] == 1
    assert stats["davon_ko"] == 1
    assert stats["durchschnitts_score"] == 80.0
    assert stats["ko_gruende"] == {"Kein Motivationsschreiben eingereicht": 1}


def test_stellenausschreibung_kommt_aus_dem_dashboard_zustand(temp_storage):
    text = werkzeuge("# Senior Analyst\nAnforderungen ...")[
        "lese_stellenausschreibung"
    ].invoke({})
    assert text.startswith("# Senior Analyst")


# --- Agent-Loop ---------------------------------------------------------------

def test_loop_fuehrt_werkzeug_aus_und_antwortet(temp_storage):
    seed(temp_storage)
    llm = WerkzeugFakeLLM(messages=iter([
        tool_aufruf("liste_bewerbungen", {"status": "alle"}),
        AIMessage(content="Es gibt zwei Bewerbungen."),
    ]))
    ergebnis = beantworte_frage("Wie viele Bewerbungen gibt es?", llm=llm)
    assert ergebnis["antwort"] == "Es gibt zwei Bewerbungen."
    assert ergebnis["tool_aufrufe"] == [
        {"tool": "liste_bewerbungen", "args": {"status": "alle"}}
    ]


def test_loop_uebersteht_unbekanntes_werkzeug(temp_storage):
    seed(temp_storage)
    llm = WerkzeugFakeLLM(messages=iter([
        tool_aufruf("gibt_es_nicht", {}),
        AIMessage(content="Trotzdem eine Antwort."),
    ]))
    ergebnis = beantworte_frage("Test?", llm=llm)
    assert ergebnis["antwort"] == "Trotzdem eine Antwort."
    assert ergebnis["tool_aufrufe"][0]["tool"] == "gibt_es_nicht"


def test_runden_limit_erzwingt_abschluss(temp_storage):
    seed(temp_storage)
    endlos = [
        tool_aufruf("statistik", {}, id_=f"call_{i}") for i in range(MAX_RUNDEN)
    ]
    llm = WerkzeugFakeLLM(messages=iter([*endlos, AIMessage(content="Fazit.")]))
    ergebnis = beantworte_frage("Test?", llm=llm)
    assert ergebnis["antwort"] == "Fazit."
    assert len(ergebnis["tool_aufrufe"]) == MAX_RUNDEN
