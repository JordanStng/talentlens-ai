"""Live-Analyse: Schritt-Events der Pipeline und der NDJSON-Stream der API.

Die LLM-Chains werden durch RunnableLambdas mit festen Antworten ersetzt -
geprueft wird die Verdrahtung: Feuern die benannten Schritte in der
richtigen Reihenfolge, nimmt der K.O.-Fall den kurzen Zweig, und streamt
der Endpoint daraus die richtigen NDJSON-Zeilen?
"""

import asyncio
import json

import pytest
from fastapi.testclient import TestClient
from langchain_core.runnables import RunnableLambda

from conftest import beispiel_bewertung
from core import pipeline as pipeline_modul
from core.schemas import DokumentKlassifikation, DokumentTyp, KritikUrteil

BEWERTUNG = beispiel_bewertung({
    "berufserfahrung": 8, "skills": 8, "ausbildung": 8, "sprachkenntnisse": 8,
})


@pytest.fixture
def fake_chains(monkeypatch):
    """Pipeline-Fabrik mit deterministischen Fake-Chains (ohne API-Key).

    Dateinamen mit 'cv' werden als Lebenslauf klassifiziert, alles andere
    als Sonstiges - so laesst sich der K.O.-Zweig gezielt ausloesen.
    belegt=False laesst die Selbstkritik einmal korrigieren.
    """

    def baue(belegt: bool = True):
        monkeypatch.setattr(
            pipeline_modul, "extrahiere_pdf_text",
            lambda pfad: f"Text aus {pfad}",
        )
        monkeypatch.setattr(
            pipeline_modul, "build_klassifikations_chain",
            lambda llm: RunnableLambda(lambda e: DokumentKlassifikation(
                typ=DokumentTyp.LEBENSLAUF
                if "cv" in e["datei_name"]
                else DokumentTyp.SONSTIGES
            )),
        )
        monkeypatch.setattr(
            pipeline_modul, "build_anonymisierungs_chain",
            lambda llm: RunnableLambda(lambda e: "[anonymisiert]"),
        )
        monkeypatch.setattr(
            pipeline_modul, "build_bewertungs_chain",
            lambda llm: RunnableLambda(lambda e: BEWERTUNG),
        )
        monkeypatch.setattr(
            pipeline_modul, "build_kritik_chain",
            lambda llm: RunnableLambda(
                lambda e: KritikUrteil(belegt=belegt, maengel=[] if belegt else ["Beleg fehlt"])
            ),
        )
        return pipeline_modul.build_screening_pipeline(llm=object())

    return baue


def eingabe(datei_name: str) -> dict:
    return {
        "dateien": [{"name": datei_name, "pfad": f"/tmp/{datei_name}"}],
        "stelle": "# Junior Data Analyst",
        "kandidat": "Anna Schmidt",
        "ko_kriterien": {"lebenslauf_erforderlich": True},
    }


def schritt_namen(pipeline, pipeline_eingabe: dict) -> list[str]:
    """Namen der beendeten Pipeline-Schritte in Event-Reihenfolge."""

    async def sammle():
        namen = []
        async for event in pipeline.astream_events(pipeline_eingabe):
            if (
                event["event"] == "on_chain_end"
                and event.get("name") in pipeline_modul.PIPELINE_SCHRITTE
            ):
                namen.append(event["name"])
        return namen

    return asyncio.run(sammle())


# --- Pipeline-Events ----------------------------------------------------------

def test_bewertungszweig_feuert_alle_schritte_in_reihenfolge(fake_chains):
    assert schritt_namen(fake_chains(), eingabe("cv.pdf")) == [
        "extraktion", "ko_pruefung", "zusammenfuehren",
        "anonymisierung", "bewertung", "selbstkritik", "score",
    ]


def test_ko_fall_nimmt_den_kurzen_zweig(fake_chains):
    assert schritt_namen(fake_chains(), eingabe("zeugnis.pdf")) == [
        "extraktion", "ko_pruefung", "ko_ablehnung",
    ]


# --- Live-Endpoint (NDJSON-Stream) ---------------------------------------------

def stream_zeilen(client: TestClient, entwurf_id: int) -> list[dict]:
    with client.stream(
        "POST",
        f"/api/entwuerfe/{entwurf_id}/analysieren/live",
        data={"stelle": "# Junior Data Analyst", "kandidat": "Anna Schmidt"},
    ) as res:
        assert res.status_code == 200
        return [json.loads(z) for z in res.iter_lines() if z.strip()]


@pytest.fixture
def api_client(temp_storage, monkeypatch):
    import api.main as api_main

    monkeypatch.delenv("TALENTLENS_PASSWORT", raising=False)

    def baue(pipeline):
        monkeypatch.setattr(api_main, "_pipeline", pipeline)
        return TestClient(api_main.app)

    return baue


def test_live_endpoint_streamt_schritte_und_ergebnis(
    temp_storage, fake_chains, api_client
):
    client = api_client(fake_chains(belegt=False))
    entwurf = temp_storage.erstelle_entwurf("Anna Schmidt")
    temp_storage.speichere_entwurf_datei(entwurf["id"], "cv.pdf", b"%PDF-fake")

    zeilen = stream_zeilen(client, entwurf["id"])
    schritte = [z for z in zeilen if z["typ"] == "schritt"]

    assert [z["schritt"] for z in schritte] == [
        "extraktion", "ko_pruefung", "zusammenfuehren",
        "anonymisierung", "bewertung", "selbstkritik", "score",
    ]
    ko = next(z for z in schritte if z["schritt"] == "ko_pruefung")
    assert ko["ko_grund"] is None  # Zweig-Entscheidung kommt im Stream mit
    kritik = next(z for z in schritte if z["schritt"] == "selbstkritik")
    assert kritik["korrigiert"] is True  # belegt=False -> einmal korrigiert

    ergebnis = zeilen[-1]
    assert ergebnis["typ"] == "ergebnis"
    assert ergebnis["status"] == "genehmigt"
    assert ergebnis["korrigiert"] is True
    # Entwurf ist wie beim klassischen Endpoint in den Verlauf gewandert
    assert temp_storage.lade_entwurf(entwurf["id"]) is None
    assert temp_storage.lade_ergebnisse()[0]["kandidat"] == "Anna Schmidt"


def test_live_endpoint_ko_fall(temp_storage, fake_chains, api_client):
    client = api_client(fake_chains())
    entwurf = temp_storage.erstelle_entwurf("Anna Schmidt")
    temp_storage.speichere_entwurf_datei(entwurf["id"], "zeugnis.pdf", b"%PDF-fake")

    zeilen = stream_zeilen(client, entwurf["id"])
    schritte = [z for z in zeilen if z["typ"] == "schritt"]

    assert [z["schritt"] for z in schritte] == [
        "extraktion", "ko_pruefung", "ko_ablehnung",
    ]
    ko = next(z for z in schritte if z["schritt"] == "ko_pruefung")
    assert ko["ko_grund"] == "lebenslauf_fehlt"
    assert zeilen[-1]["typ"] == "ergebnis"
    assert zeilen[-1]["status"] == "abgelehnt"
    assert zeilen[-1]["bewertung"] is None
