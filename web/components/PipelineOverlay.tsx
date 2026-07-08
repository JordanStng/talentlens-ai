"use client";

import { useEffect, useRef, useState } from "react";
import type {
  LiveStand,
  PipelineSchritt,
  ScreeningErgebnis,
} from "@/lib/types";
import { formatScore, Spinner, StatusChip } from "./ui";

/** Detail-Ansicht der Pipeline als Popup: links das Flow-Chart von oben nach
 *  unten (mit Live-Status, Zeiten und Auto-Scroll zum aktiven Schritt),
 *  rechts die Erklaerung samt echtem Code-Ausschnitt. Waehrend einer Analyse
 *  folgt die rechte Seite automatisch dem laufenden Schritt; ein Klick auf
 *  einen Knoten pinnt ihn. Geoeffnet wird das Popup ueber die laufende
 *  Bewerbungskarte im Screening-Tab. */

interface Knoten {
  id: PipelineSchritt;
  label: string;
  llm?: boolean; // Schritt ruft Gemini auf
}

const HAUPT_KNOTEN: Knoten[] = [
  { id: "extraktion", label: "Extraktion & Klassifikation", llm: true },
  { id: "ko_pruefung", label: "K.O.-Prüfung" },
];

const KO_KNOTEN: Knoten = { id: "ko_ablehnung", label: "Direkte Ablehnung" };

const BEWERTUNGS_ZWEIG_KNOTEN: Knoten[] = [
  { id: "zusammenfuehren", label: "Zusammenführen" },
  { id: "anonymisierung", label: "Anonymisierung", llm: true },
  { id: "bewertung", label: "Bewertung", llm: true },
  { id: "selbstkritik", label: "Selbstkritik", llm: true },
  { id: "score", label: "Score & Empfehlung" },
];

type KnotenStatus =
  | "ausstehend"
  | "laeuft"
  | "fertig"
  | "uebersprungen"
  | "fehler";

type Auswahl = PipelineSchritt | "kette";

interface SchrittDetail {
  titel: string;
  baustein: string; // LangChain-Baustein als Badge
  beschreibung: string;
  datei: string;
  code: string;
}

/* Die Code-Ausschnitte sind (leicht gekuerzte) Originalzeilen aus dem Repo —
 * bei Aenderungen an der Pipeline hier mitpflegen. */
const DETAILS: Record<Auswahl, SchrittDetail> = {
  kette: {
    titel: "Die ganze Kette",
    baustein: "LCEL · RunnableSequence + RunnableBranch",
    beschreibung:
      "Die Screening-Pipeline ist eine deklarative LangChain-Kette (LCEL): " +
      "Schritte werden mit dem |-Operator komponiert, die Verzweigung nach " +
      "der K.O.-Prüfung übernimmt ein RunnableBranch — pures LangChain, " +
      "bewusst kein LangGraph. Diese Live-Ansicht entsteht direkt aus der " +
      "Kette: astream_events() meldet jeden benannten Schritt als Event, " +
      "die API streamt sie zeilenweise ans Frontend.",
    datei: "core/pipeline.py · api/main.py",
    code: `# core/pipeline.py — die Kette (LCEL, kein LangGraph)
return (
    RunnableLambda(_extrahieren_und_klassifizieren, name="extraktion")
    | RunnableLambda(_ko_pruefung, name="ko_pruefung")
    | RunnableBranch(
        (
            lambda state: state["ko_grund"] is not None,
            RunnableLambda(_ko_ergebnis, name="ko_ablehnung"),
        ),
        bewertungs_zweig,
    )
)

# api/main.py — daraus entstehen die Events dieser Live-Ansicht
async for event in get_pipeline().astream_events(eingabe):
    if event["event"] == "on_chain_end" and name in PIPELINE_SCHRITTE:
        yield zeile({"typ": "schritt", "schritt": name})`,
  },
  extraktion: {
    titel: "Extraktion & Klassifikation",
    baustein: "Chain: Prompt | LLM · with_structured_output",
    beschreibung:
      "Jede hochgeladene PDF wird zu Text extrahiert und vom LLM " +
      "klassifiziert: Lebenslauf, Motivationsschreiben oder Sonstiges. " +
      "with_structured_output zwingt Gemini in ein Pydantic-Schema — statt " +
      "Freitext kommt ein validiertes Objekt zurück.",
    datei: "core/pipeline.py · core/klassifikation.py",
    code: `def _extrahieren_und_klassifizieren(state: dict) -> dict:
    dokumente = []
    for datei in state["dateien"]:
        text = extrahiere_pdf_text(datei["pfad"])
        klassifikation = klassifikations_chain.invoke(
            {"datei_name": datei["name"], "auszug": text[:1500]}
        )
        dokumente.append(
            {"name": datei["name"], "typ": klassifikation.typ, "text": text}
        )
    return {**state, "dokumente": dokumente}

# core/klassifikation.py — die Chain dahinter
KLASSIFIKATIONS_PROMPT | llm.with_structured_output(DokumentKlassifikation)`,
  },
  ko_pruefung: {
    titel: "K.O.-Prüfung",
    baustein: "RunnableLambda · kein LLM",
    beschreibung:
      "Formale K.O.-Kriterien sind reines Python — deterministisch, " +
      "kostenlos, in Millisekunden erledigt. Direkt danach entscheidet ein " +
      "RunnableBranch über den Weg: K.O. führt zur sofortigen Ablehnung " +
      "ohne LLM, sonst folgt die volle Bewertung.",
    datei: "core/pipeline.py",
    code: `def pruefe_ko(dokumente: list[dict], ko_kriterien: dict) -> KOGrund | None:
    typen = {d["typ"] for d in dokumente}
    if (
        ko_kriterien.get("lebenslauf_erforderlich", True)
        and DokumentTyp.LEBENSLAUF not in typen
    ):
        return KOGrund.LEBENSLAUF_FEHLT
    if (
        ko_kriterien.get("motivationsschreiben_erforderlich", False)
        and DokumentTyp.MOTIVATIONSSCHREIBEN not in typen
    ):
        return KOGrund.MOTIVATIONSSCHREIBEN_FEHLT
    return None`,
  },
  ko_ablehnung: {
    titel: "Direkte Ablehnung",
    baustein: "RunnableBranch · Zweig A",
    beschreibung:
      "Der kurze Zweig: Fehlt ein Pflichtdokument, wird die Bewerbung ohne " +
      "jede LLM-Bewertung abgelehnt — mit dokumentiertem K.O.-Grund. Das " +
      "spart Kosten und Zeit und verhindert, dass unvollständige " +
      "Bewerbungen inhaltlich bewertet werden.",
    datei: "core/pipeline.py",
    code: `# Zweig A: K.O. -> direkte Ablehnung ohne Bewertung
def _ko_ergebnis(state: dict) -> dict:
    return {
        **state,
        "status": "abgelehnt",
        "bewertung": None,      # keine LLM-Bewertung noetig
        "gesamt_score": None,
        "empfehlung": None,
    }`,
  },
  zusammenfuehren: {
    titel: "Zusammenführen",
    baustein: "RunnableLambda",
    beschreibung:
      "Mehrteilige Lebensläufe (z. B. zwei getrennt hochgeladene PDFs) " +
      "werden zu einem CV-Text vereint, Motivationsschreiben bleiben " +
      "separat. Der Zustand fließt als dict durch die Kette — jeder Schritt " +
      "reichert ihn an, LangChain reicht ihn weiter.",
    datei: "core/pipeline.py",
    code: `def _texte_zusammenfuehren(state: dict) -> dict:
    cv_teile = [
        d["text"] for d in state["dokumente"]
        if d["typ"] == DokumentTyp.LEBENSLAUF
    ]
    motivation_teile = [
        d["text"] for d in state["dokumente"]
        if d["typ"] == DokumentTyp.MOTIVATIONSSCHREIBEN
    ]
    return {
        **state,
        "cv_text": "\\n\\n".join(cv_teile),
        "motivation_text": "\\n\\n".join(motivation_teile) or None,
    }`,
  },
  anonymisierung: {
    titel: "Anonymisierung",
    baustein: "Chain: Prompt | LLM | StrOutputParser",
    beschreibung:
      "Bias-Mitigation: Vor der Bewertung ersetzt das LLM Namen, " +
      "Geschlecht, Alter, Herkunft und Kontaktdaten durch [ENTFERNT] — die " +
      "Bewertung sieht nur noch Qualifikationen. Eine klassische " +
      "LCEL-Minikette: Prompt, Modell und Parser per |-Operator verbunden.",
    datei: "core/anonymization.py · core/pipeline.py",
    code: `# core/anonymization.py
ANONYMISIERUNGS_PROMPT | llm | StrOutputParser()

# core/pipeline.py
def _anonymisieren(state: dict) -> dict:
    cv_anonym = anonymisierungs_chain.invoke({"cv_text": state["cv_text"]})
    motivation_anonym = (
        anonymisierungs_chain.invoke({"cv_text": state["motivation_text"]})
        if state["motivation_text"]
        else KEIN_MOTIVATIONSSCHREIBEN
    )
    return {**state, "cv_text": cv_anonym, "motivation_text": motivation_anonym}`,
  },
  bewertung: {
    titel: "Bewertung",
    baustein: "with_structured_output(Bewertung)",
    beschreibung:
      "Das Herzstück: Gemini bewertet den anonymisierten CV gegen die " +
      "Stellenausschreibung — pro Kriterium ein Score von 1–10 mit " +
      "Begründung und wörtlichen Belegen aus den Unterlagen. Das " +
      "Pydantic-Schema erzwingt die Struktur, freie Formate sind " +
      "ausgeschlossen.",
    datei: "core/evaluation.py · core/schemas.py",
    code: `# core/evaluation.py
BEWERTUNGS_PROMPT | llm.with_structured_output(Bewertung)

# core/schemas.py — das erzwungene Schema
class Bewertung(BaseModel):
    kriterien: list[KriteriumScore]  # Score 1-10, Begruendung, Belege
    staerken: list[str]
    ablehnungsgruende: list[AblehnungsGrund]
    zusammenfassung: str`,
  },
  selbstkritik: {
    titel: "Selbstkritik",
    baustein: "LLM-as-a-Judge · max. 1 Korrektur",
    beschreibung:
      "Ein zweiter LLM-Aufruf prüft die eigene Bewertung: Sind alle Scores " +
      "durch die zitierten Belege gedeckt? Wenn nicht, wird die Bewertung " +
      "genau einmal mit den Beanstandungen als Hinweis wiederholt — bewusst " +
      "begrenzt, keine Endlosschleife.",
    datei: "core/pipeline.py",
    code: `def _pruefe_und_korrigiere(state: dict) -> dict:
    urteil = kritik_chain.invoke({
        "cv_text": state["cv_text"],
        "motivation_text": state["motivation_text"],
        "bewertung_json": state["bewertung"].model_dump_json(indent=2),
    })
    if urteil.belegt:
        return {**state, "korrigiert": False}

    neue_bewertung = bewertungs_chain.invoke({
        ...,
        "hinweis": KORREKTUR_HINWEIS.format("\\n- ".join(urteil.maengel)),
    })
    return {**state, "bewertung": neue_bewertung, "korrigiert": True}`,
  },
  score: {
    titel: "Score & Empfehlung",
    baustein: "RunnableLambda · deterministisch",
    beschreibung:
      "Aus den Kriterien-Scores wird ein gewichteter Gesamt-Score (10–100) " +
      "berechnet und in eine Empfehlung übersetzt: Einladen, Prüfen oder " +
      "Ablehnen. Bewusst reines Python statt LLM — reproduzierbar und " +
      "transparent gewichtet. Die finale Entscheidung trifft ein Mensch.",
    datei: "core/ranking.py",
    code: `def berechne_gesamtscore(bewertung: Bewertung) -> float:
    """Gewichtete Summe der Kriterien-Scores, skaliert auf 10-100."""
    scores = {ks.kriterium.value: ks.score for ks in bewertung.kriterien}
    gewichtet = sum(
        gewicht * scores.get(name, 1)
        for name, gewicht in KRITERIEN_GEWICHTE.items()
    )
    return round(gewichtet * 10, 1)

def leite_empfehlung_ab(gesamt_score: float) -> str:
    if gesamt_score >= SCHWELLE_EINLADEN:
        return "Einladen"
    if gesamt_score >= SCHWELLE_PRUEFEN:
        return "Pruefen"
    return "Ablehnen"`,
  },
};

export default function PipelineOverlay({
  offen,
  onSchliessen,
  kandidat,
  stand,
  laeuft,
  fehlgeschlagen,
  ergebnis,
}: {
  offen: boolean;
  onSchliessen: () => void;
  kandidat: string | null;
  stand?: LiveStand;
  laeuft: boolean;
  fehlgeschlagen: boolean;
  ergebnis?: ScreeningErgebnis;
}) {
  const [auswahl, setAuswahl] = useState<Auswahl | null>(null);
  const [jetzt, setJetzt] = useState(0); // Live-Uhr fuer den laufenden Schritt
  const flowRef = useRef<HTMLDivElement>(null);

  // Schliessen setzt die Auswahl zurueck: Beim naechsten Oeffnen folgt die
  // Erklaerung wieder automatisch der Analyse
  const schliessen = () => {
    setAuswahl(null);
    onSchliessen();
  };

  useEffect(() => {
    if (!offen) return;
    const taste = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAuswahl(null);
        onSchliessen();
      }
    };
    window.addEventListener("keydown", taste);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", taste);
      document.body.style.overflow = "";
    };
  }, [offen, onSchliessen]);

  useEffect(() => {
    if (!offen || !laeuft) return;
    const uhr = setInterval(() => setJetzt(Date.now()), 250);
    return () => clearInterval(uhr);
  }, [offen, laeuft]);

  // --- Status & Zeiten aus dem gestreamten Stand ableiten -------------------
  const fertigIds = new Set((stand?.fertig ?? []).map((e) => e.schritt));
  const zweigBekannt = stand !== undefined && stand.koGrund !== undefined;
  const ko = zweigBekannt && stand?.koGrund !== null;
  const pfad: Knoten[] = [
    ...HAUPT_KNOTEN,
    ...(zweigBekannt ? (ko ? [KO_KNOTEN] : BEWERTUNGS_ZWEIG_KNOTEN) : []),
  ];
  const aktiverSchritt = stand
    ? pfad.find((k) => !fertigIds.has(k.id))?.id
    : undefined;

  const status = (id: PipelineSchritt): KnotenStatus => {
    if (fertigIds.has(id)) return "fertig";
    if (id === aktiverSchritt && fehlgeschlagen) return "fehler";
    if (id === aktiverSchritt && laeuft) return "laeuft";
    const imKoZweig = id === KO_KNOTEN.id;
    const imBewertungsZweig = BEWERTUNGS_ZWEIG_KNOTEN.some((k) => k.id === id);
    if (zweigBekannt && (ko ? imBewertungsZweig : imKoZweig))
      return "uebersprungen";
    return "ausstehend";
  };

  // Dauer pro Schritt (die Events tragen kumulierte Zeiten seit Start)
  const dauern = new Map<PipelineSchritt, number>();
  let vorher = 0;
  for (const eintrag of stand?.fertig ?? []) {
    dauern.set(eintrag.schritt, eintrag.ms - vorher);
    vorher = eintrag.ms;
  }
  const laufendeDauer =
    laeuft && stand?.startZeit && jetzt
      ? Math.max(0, jetzt - stand.startZeit - vorher)
      : undefined;

  // Beim Live-Folgen den aktiven Knoten im Flow sichtbar halten
  useEffect(() => {
    if (!offen || !laeuft || !aktiverSchritt) return;
    flowRef.current
      ?.querySelector(`[data-knoten="${aktiverSchritt}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [offen, laeuft, aktiverSchritt]);

  if (!offen) return null;

  // Ohne Pin folgt die Erklaerung dem laufenden Schritt, sonst der Ueberblick
  const anzeige: Auswahl =
    auswahl ?? (laeuft && aktiverSchritt ? aktiverSchritt : "kette");
  const detail = DETAILS[anzeige];

  const knotenKlick = (id: PipelineSchritt) =>
    setAuswahl(id === auswahl ? null : id);

  const knoten = (k: Knoten) => (
    <FlussKnoten
      key={k.id}
      knoten={k}
      status={status(k.id)}
      gewaehlt={anzeige === k.id}
      dauerMs={
        status(k.id) === "laeuft" ? laufendeDauer : dauern.get(k.id)
      }
      korrigiert={k.id === "selbstkritik" && stand?.korrigiert}
      onKlick={() => knotenKlick(k.id)}
    />
  );

  return (
    // Klick auf den abgedunkelten Hintergrund schliesst; Klicks im Dialog
    // selbst duerfen nicht durchschlagen (stopPropagation)
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 sm:p-8"
      onClick={schliessen}
    >
      <div
        className="rise-in flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-line bg-canvas shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Pipeline-Ansicht"
      >
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-6 py-4">
          <div>
            <h2 className="font-serif text-2xl italic">Screening-Pipeline</h2>
            <p className="mt-0.5 text-sm text-ink-faint">
              pures LangChain (LCEL) · Live-Events aus{" "}
              <code className="text-xs">astream_events()</code>
            </p>
          </div>
          <div className="flex items-center gap-4">
            {kandidat && (
              <span className="text-sm text-ink-soft">
                {laeuft && <Spinner />}{" "}
                <span className="font-medium">{kandidat}</span>
              </span>
            )}
            {ergebnis && (
              <span className="flex items-center gap-2">
                {ergebnis.gesamt_score !== null && (
                  <span className="font-serif text-xl">
                    {formatScore(ergebnis.gesamt_score)}
                    <span className="text-xs text-ink-faint">/100</span>
                  </span>
                )}
                <StatusChip
                  status={ergebnis.status}
                  ko={ergebnis.ko_grund !== null}
                  empfehlung={ergebnis.empfehlung}
                />
              </span>
            )}
            <button
              onClick={schliessen}
              aria-label="Pipeline-Ansicht schließen"
              className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-soft transition-colors hover:border-tanne hover:text-ink"
            >
              Schließen ✕
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          {/* Flow-Chart: der Weg von oben nach unten */}
          <div
            ref={flowRef}
            className="w-72 shrink-0 overflow-y-auto border-r border-line px-5 py-5"
          >
            {knoten(HAUPT_KNOTEN[0])}
            <Verbindung aktiv={fertigIds.has("extraktion")} />
            {knoten(HAUPT_KNOTEN[1])}

            {/* Verzweigung: rechts der K.O.-Ausstieg, unten geht es weiter */}
            <div
              className={`ml-5 border-l-2 ${
                zweigBekannt && !ko ? "border-tanne" : "border-line"
              }`}
            >
              <div className="flex items-center pt-2">
                <div
                  className={`h-0 w-3 border-t-2 ${
                    zweigBekannt && ko ? "border-tanne" : "border-line"
                  }`}
                />
                <span className="mx-1.5 text-[10px] text-ink-faint">K.O.</span>
                <div className="min-w-0 flex-1">{knoten(KO_KNOTEN)}</div>
              </div>
              <p className="py-1.5 pl-2 text-[10px] text-ink-faint">
                bestanden ↓
              </p>
            </div>

            {BEWERTUNGS_ZWEIG_KNOTEN.map((k, i) => (
              <span key={k.id}>
                {i > 0 && (
                  <Verbindung
                    aktiv={fertigIds.has(BEWERTUNGS_ZWEIG_KNOTEN[i - 1].id)}
                  />
                )}
                {knoten(k)}
              </span>
            ))}
          </div>

          {/* Erklaerung & Code zum gewaehlten bzw. laufenden Schritt */}
          <div className="min-w-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="font-serif text-xl italic">{detail.titel}</h3>
                <span className="rounded-full bg-tanne-soft px-2.5 py-0.5 font-mono text-[11px] text-tanne-deep">
                  {detail.baustein}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {auswahl !== null && laeuft && (
                  <button
                    onClick={() => setAuswahl(null)}
                    className="text-xs font-medium text-tanne transition-colors hover:text-tanne-deep"
                  >
                    ● wieder live folgen
                  </button>
                )}
                {anzeige !== "kette" && (
                  <button
                    onClick={() => setAuswahl("kette")}
                    className="text-xs text-ink-faint transition-colors hover:text-ink"
                  >
                    Gesamte Kette anzeigen
                  </button>
                )}
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              {detail.beschreibung}
            </p>
            <CodeBlock datei={detail.datei} code={detail.code} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Verbindung({ aktiv }: { aktiv: boolean }) {
  return (
    <div
      className={`ml-5 h-5 border-l-2 ${aktiv ? "border-tanne" : "border-line"}`}
    />
  );
}

const KNOTEN_STIL: Record<KnotenStatus, string> = {
  ausstehend: "border-line text-ink-soft",
  laeuft: "border-tanne bg-tanne-soft text-tanne-deep",
  fertig: "border-line-strong text-ink",
  uebersprungen: "border-dashed border-line text-ink-faint opacity-50",
  fehler: "border-rot bg-rot-soft text-rot",
};

function FlussKnoten({
  knoten,
  status,
  gewaehlt,
  dauerMs,
  korrigiert,
  onKlick,
}: {
  knoten: Knoten;
  status: KnotenStatus;
  gewaehlt: boolean;
  dauerMs?: number;
  korrigiert?: boolean;
  onKlick: () => void;
}) {
  return (
    <button
      data-knoten={knoten.id}
      onClick={onKlick}
      className={`flex w-full items-center gap-2 rounded-lg border bg-surface px-3 py-2 text-left text-sm transition-all hover:border-tanne ${
        KNOTEN_STIL[status]
      } ${gewaehlt ? "ring-2 ring-tanne/40" : ""}`}
    >
      <span className="w-4 shrink-0 text-center">
        {status === "laeuft" ? (
          <Spinner />
        ) : status === "fertig" ? (
          <span className="text-tanne">✓</span>
        ) : status === "fehler" ? (
          "✕"
        ) : (
          <span className="text-xs text-ink-faint">○</span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        {knoten.label}
        {knoten.llm && (
          <span
            className="ml-1.5 rounded border border-current px-1 text-[9px] uppercase tracking-wide opacity-60"
            title="Dieser Schritt ruft das LLM (Gemini) auf"
          >
            LLM
          </span>
        )}
        {korrigiert && (
          <span
            className="ml-1.5 rounded-full bg-gold-soft px-1.5 text-[10px] font-medium text-gold"
            title="Die Selbstkritik hat Mängel gefunden — die Bewertung wurde einmal korrigiert wiederholt"
          >
            korrigiert
          </span>
        )}
      </span>
      {dauerMs !== undefined && (
        <span className="shrink-0 text-[10px] text-ink-faint">
          {(dauerMs / 1000).toLocaleString("de-DE", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })}
          &thinsp;s
        </span>
      )}
    </button>
  );
}

/** Hebt LangChain-Bausteine im Code hervor und dimmt Kommentare —
 *  bewusst simpel (zeilen-/tokenbasiert) statt echtem Highlighter. */
const LANGCHAIN_TOKENS =
  /(RunnableLambda|RunnableBranch|RunnablePassthrough|RunnableSequence|with_structured_output|astream_events|StrOutputParser|ChatPromptTemplate|\.invoke)/g;

function CodeBlock({ datei, code }: { datei: string; code: string }) {
  return (
    <div className="mt-4 overflow-hidden rounded-lg bg-ink">
      <p className="border-b border-canvas/10 px-4 py-2 font-mono text-[11px] text-canvas/50">
        {datei}
      </p>
      <pre className="overflow-x-auto px-4 py-3 font-mono text-xs leading-relaxed text-canvas/90">
        {code.split("\n").map((zeile, i) => (
          <div
            key={i}
            className={zeile.trimStart().startsWith("#") ? "text-canvas/45" : ""}
          >
            {zeile
              ? zeile
                  .split(LANGCHAIN_TOKENS)
                  .map((teil, j) =>
                    j % 2 === 1 ? (
                      <span key={j} className="font-medium text-tanne-soft">
                        {teil}
                      </span>
                    ) : (
                      teil
                    ),
                  )
              : " "}
          </div>
        ))}
      </pre>
    </div>
  );
}
