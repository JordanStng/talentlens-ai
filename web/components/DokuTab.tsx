"use client";

import { useEffect, useState } from "react";
import { fetchKonfiguration } from "@/lib/api";
import type { Konfiguration, Labels } from "@/lib/types";
import { EmpfehlungChip, formatScore, ScoreBar, StatusChip } from "./ui";

/** Doku fuer Teammitglieder: Wie funktioniert das Screening, wie entsteht
 *  der Score? Gewichte/Schwellen kommen live aus /api/konfiguration und
 *  koennen daher nie vom Code abweichen. */

interface Schritt {
  titel: string;
  text: string;
  datei: string;
  llm: string | null; // null = deterministisch, sonst Beschreibung der Aufrufe
}

const SCHRITTE: Schritt[] = [
  {
    titel: "Posteingang",
    text: "Der Bulk-Upload nimmt gemischte PDFs an. Pro Datei bestimmt ein LLM-Aufruf, welche Dokumente darin stecken (Segmente als Seitenbereiche), von wem sie stammen und wo ein Dokument endet. Ein Sammel-PDF aus zweiseitigem Lebenslauf und Anschreiben wird von pypdf physisch aufgeteilt. Dokumente mit demselben erkannten Namen landen in derselben Bewerbung.",
    datei: "core/eingang.py",
    llm: "1 Aufruf pro hochgeladenem PDF",
  },
  {
    titel: "Extraktion",
    text: "PyPDFLoader zieht den Text aus jedem PDF, einfaches Cleaning entfernt Mehrfach-Leerzeichen und Leerzeilen-Stapel. Gescannte PDFs ohne Textebene werden mit einer klaren Fehlermeldung abgewiesen (kein OCR).",
    datei: "core/extraction.py",
    llm: null,
  },
  {
    titel: "Klassifikation",
    text: "Jede Datei der Bewerbung wird als Lebenslauf, Motivationsschreiben oder Sonstiges eingestuft (Dateiname + Textauszug, Structured Output). Mehrteilige Lebensläufe werden später zu einem Text zusammengeführt.",
    datei: "core/klassifikation.py",
    llm: "1 Aufruf pro Datei",
  },
  {
    titel: "K.O.-Prüfung",
    text: "Reine Python-Logik über den Klassifikations-Ergebnissen: Fehlt ein als erforderlich markiertes Dokument, endet die Pipeline hier. Die Bewerbung wird ohne LLM-Bewertung abgelehnt und der Grund im Verlauf vermerkt. Technisch ist das ein RunnableBranch in der LCEL-Kette.",
    datei: "core/pipeline.py",
    llm: null,
  },
  {
    titel: "Anonymisierung",
    text: "Bevor bewertet wird, entfernt ein LLM-Schritt Name, Geschlecht, Alter, Herkunft und Kontaktdaten aus den Texten (Bias-Mitigation). Das bewertende LLM sieht nur fachliche Inhalte; im Dashboard bleibt der Name für HR natürlich sichtbar.",
    datei: "core/anonymization.py",
    llm: "1 Aufruf pro Dokumentart (CV, Anschreiben)",
  },
  {
    titel: "Bewertung",
    text: "Das Herzstück: Das LLM bewertet die vier Kriterien einzeln nach einer festen Rubrik (1–2 keine Anzeichen … 9–10 übertrifft die Anforderungen) und muss jeden Score mit wörtlichen Zitaten aus den Unterlagen belegen. Die Antwort ist per Pydantic-Schema erzwungen strukturiert, inklusive Ablehnungsgründen als feste Kategorien statt Freitext. Das Motivationsschreiben dient als Kontext, ersetzt aber keine fehlende Qualifikation im CV.",
    datei: "core/evaluation.py · core/schemas.py",
    llm: "1 Aufruf",
  },
  {
    titel: "Selbstkritik",
    text: "Ein zweiter, unabhängiger LLM-Aufruf prüft die Bewertung gegen die Unterlagen: Finden sich die Zitate wirklich im Text? Passt die Score-Höhe zur Begründung? Bei Beanstandung wird die Bewertung genau einmal mit den Korrekturhinweisen wiederholt (bewusst begrenzt, keine Endlosschleife). Korrigierte Bewertungen sind im Verlauf markiert.",
    datei: "core/evaluation.py · core/pipeline.py",
    llm: "1 Aufruf (+1 bei Korrektur)",
  },
  {
    titel: "Score & Einstufung",
    text: "Der Gesamt-Score wird NICHT vom LLM vergeben, sondern deterministisch in Python berechnet (Details unten). Daraus folgt die Empfehlung, daraus der Status. Alles landet in SQLite, der Verlauf überlebt also Neustarts.",
    datei: "core/ranking.py · core/storage.py",
    llm: null,
  },
];

export default function DokuTab({ labels }: { labels: Labels }) {
  const [konfig, setKonfig] = useState<Konfiguration | null>(null);
  const [demoScores, setDemoScores] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchKonfiguration().then((k) => {
      setKonfig(k);
      // Startwerte fuer den interaktiven Rechner
      setDemoScores(
        Object.fromEntries(Object.keys(k.gewichte).map((name) => [name, 7])),
      );
    });
  }, []);

  if (!konfig) return <p className="text-sm text-ink-faint">Lade…</p>;

  const gesamt =
    Object.entries(konfig.gewichte).reduce(
      (summe, [name, gewicht]) => summe + gewicht * (demoScores[name] ?? 1),
      0,
    ) * 10;
  const empfehlung =
    gesamt >= konfig.schwelle_einladen
      ? "Einladen"
      : gesamt >= konfig.schwelle_pruefen
        ? "Pruefen"
        : "Ablehnen";

  return (
    <div className="mx-auto max-w-2xl space-y-14">
      <section>
        <p className="text-sm leading-relaxed text-ink-soft">
          Diese Seite erklärt, was zwischen PDF-Upload und Ranking passiert:
          ein Einstieg für alle, die am Code mitarbeiten oder die Ergebnisse
          nachvollziehen wollen. Kern sind eine{" "}
          <strong className="font-medium text-ink">
            LangChain-LCEL-Pipeline
          </strong>{" "}
          fürs Screening und ein{" "}
          <strong className="font-medium text-ink">Tool-Calling-Agent</strong>{" "}
          für den Assistent-Tab (beides pures LangChain, kein LangGraph),
          Modell{" "}
          <code className="rounded bg-surface px-1 py-0.5 text-xs">
            {konfig.modell}
          </code>{" "}
          mit <code className="rounded bg-surface px-1 py-0.5 text-xs">temperature=0</code>{" "}
          für reproduzierbare Bewertungen.
        </p>
      </section>

      {/* --- Pipeline-Schritte ------------------------------------------ */}
      <section>
        <h2 className="font-serif text-2xl italic">
          Was passiert mit einer Bewerbung?
        </h2>
        <ol className="mt-6 space-y-0">
          {SCHRITTE.map((schritt, i) => (
            <li key={schritt.titel} className="relative flex gap-5 pb-8">
              {i < SCHRITTE.length - 1 && (
                <span
                  aria-hidden
                  className="absolute top-8 left-[0.9rem] h-full w-px bg-line"
                />
              )}
              <span className="z-10 flex size-7 shrink-0 items-center justify-center rounded-full border border-line bg-surface font-serif text-sm">
                {i + 1}
              </span>
              <div>
                <h3 className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-medium">{schritt.titel}</span>
                  <span
                    className={`rounded-full px-2 py-px text-[10px] font-medium tracking-wide uppercase ${
                      schritt.llm
                        ? "bg-gold-soft text-gold"
                        : "bg-tanne-soft text-tanne-deep"
                    }`}
                  >
                    {schritt.llm ? "LLM" : "deterministisch"}
                  </span>
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                  {schritt.text}
                </p>
                <p className="mt-1.5 text-xs text-ink-faint">
                  <code>{schritt.datei}</code>
                  {schritt.llm && <> · {schritt.llm}</>}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* --- Assistent (Agent) -------------------------------------------- */}
      <section>
        <h2 className="font-serif text-2xl italic">
          Der Assistent: hier arbeitet ein Agent
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-ink-soft">
          Das Screening oben ist eine <em>feste</em> Kette — jede Bewerbung
          durchläuft dieselben Schritte in derselben Reihenfolge. Das ist
          Absicht: reproduzierbare Scores, planbare Kosten, auditierbarer
          Ablauf. Der Assistent-Tab funktioniert anders: Dort bekommt das
          LLM fünf Lese-Werkzeuge (Ergebnisliste, Einzelbewertung, Vergleich,
          Statistik, Stellenausschreibung) und entscheidet pro Runde selbst,
          welche es mit welchen Argumenten aufruft — oder ob es genug weiß
          und antwortet. Eine Frage wie „Warum ist Ben rausgeflogen, und wäre
          er ohne K.O. besser als Clara?&ldquo; löst so eine
          Mehrschritt-Kette aus: Ablehnung nachschlagen, Bewertungen holen,
          vergleichen. Die aufgerufenen Werkzeuge werden unter jeder Antwort
          eingeblendet.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          Der Agent-Loop ist mit LangChain-Primitiven gebaut (
          <code className="text-xs">bind_tools</code> +{" "}
          <code className="text-xs">ToolMessage</code>), nicht mit LangGraph,
          und auf fünf Werkzeug-Runden begrenzt. Alle Werkzeuge lesen nur —
          der Agent kann keine Bewertungen ändern.
        </p>
        <p className="mt-1.5 text-xs text-ink-faint">
          <code>core/agent.py</code> · 1 LLM-Aufruf pro Werkzeug-Runde
        </p>
      </section>

      {/* --- Score ------------------------------------------------------- */}
      <section>
        <h2 className="font-serif text-2xl italic">Wie entsteht der Score?</h2>
        <p className="mt-4 text-sm leading-relaxed text-ink-soft">
          Das LLM vergibt pro Kriterium 1–10 nach fester Rubrik; den
          Gesamt-Score rechnet Python als gewichtete Summe, skaliert auf
          10–100. LLMs sind als Gesamt-Urteiler schlecht kalibriert (Scores
          clustern um 7–8); die Mathe-Schicht macht das Ranking reproduzierbar
          und die Gewichtung diskutierbar. Sie steht in{" "}
          <code className="text-xs">core/config.py</code>.
        </p>

        <div className="mt-6 rounded-xl border border-line bg-surface p-5">
          <p className="text-xs tracking-wide text-ink-faint uppercase">
            Zum Ausprobieren
          </p>
          <div className="mt-4 space-y-4">
            {Object.entries(konfig.gewichte).map(([name, gewicht]) => (
              <div key={name}>
                <div className="flex items-baseline justify-between text-sm">
                  <label htmlFor={`demo-${name}`} className="font-medium">
                    {labels.kriterien[name] ?? name}
                    <span className="ml-2 text-xs font-normal text-ink-faint">
                      Gewicht {Math.round(gewicht * 100)}%
                    </span>
                  </label>
                  <span className="font-serif">
                    {demoScores[name] ?? 1}
                    <span className="text-xs text-ink-faint">/10</span>
                  </span>
                </div>
                <input
                  id={`demo-${name}`}
                  type="range"
                  min={1}
                  max={10}
                  value={demoScores[name] ?? 1}
                  onChange={(e) =>
                    setDemoScores((s) => ({
                      ...s,
                      [name]: Number(e.target.value),
                    }))
                  }
                  className="mt-1 w-full accent-tanne"
                />
                <ScoreBar score={demoScores[name] ?? 1} />
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-baseline justify-between border-t border-line pt-4">
            <span className="text-sm text-ink-soft">
              Σ Gewicht × Score × 10 =
            </span>
            <span className="flex items-center gap-3">
              <EmpfehlungChip empfehlung={empfehlung} />
              <span className="font-serif text-3xl">
                {formatScore(gesamt)}
                <span className="ml-1 text-sm text-ink-faint">/100</span>
              </span>
            </span>
          </div>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-ink-soft">
          Ab <strong className="font-medium text-ink">{formatScore(konfig.schwelle_einladen)}</strong> lautet
          die Empfehlung <em>Einladen</em>, ab{" "}
          <strong className="font-medium text-ink">{formatScore(konfig.schwelle_pruefen)}</strong>{" "}
          <em>Prüfen</em>, darunter <em>Ablehnen</em>. Im Tab
          „Genehmigt&ldquo; landet, wer nicht abgelehnt wurde; die finale
          Entscheidung trifft
          immer ein Mensch. Kleine Unterschiede (±5 Punkte) sind nicht
          signifikant.
        </p>
      </section>

      {/* --- Ergebnis-Markierungen ---------------------------------------- */}
      <section>
        <h2 className="font-serif text-2xl italic">
          Was am Ende rauskommen kann
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-ink-soft">
          Diese Markierungen begegnen dir im Live-Flow während der Analyse,
          im Genehmigt-Tab und im Verlauf:
        </p>
        <dl className="mt-5 space-y-4">
          <div className="flex items-start gap-4">
            <dt className="w-28 shrink-0 pt-0.5">
              <StatusChip status="genehmigt" empfehlung="Einladen" />
            </dt>
            <dd className="text-sm leading-relaxed text-ink-soft">
              Screening bestanden mit Gesamt-Score ab{" "}
              {formatScore(konfig.schwelle_einladen)} — Empfehlung{" "}
              <em>Einladen</em>.
            </dd>
          </div>
          <div className="flex items-start gap-4">
            <dt className="w-28 shrink-0 pt-0.5">
              <StatusChip status="genehmigt" empfehlung="Pruefen" />
            </dt>
            <dd className="text-sm leading-relaxed text-ink-soft">
              Der Graubereich ({formatScore(konfig.schwelle_pruefen)}–
              {formatScore(konfig.schwelle_einladen)}): hat das Screening
              überstanden und landet im Genehmigt-Tab, verdient aber einen
              genaueren menschlichen Blick.
            </dd>
          </div>
          <div className="flex items-start gap-4">
            <dt className="w-28 shrink-0 pt-0.5">
              <StatusChip status="abgelehnt" />
            </dt>
            <dd className="text-sm leading-relaxed text-ink-soft">
              Inhaltlich bewertet, aber unter{" "}
              {formatScore(konfig.schwelle_pruefen)} Punkten — die
              Schwachstellen stehen als Ablehnungsgründe im Verlauf.
            </dd>
          </div>
          <div className="flex items-start gap-4">
            <dt className="w-28 shrink-0 pt-0.5">
              <StatusChip status="abgelehnt" ko />
            </dt>
            <dd className="text-sm leading-relaxed text-ink-soft">
              Am Formal-Check gescheitert (Pflichtdokument fehlt): direkte
              Ablehnung <em>vor</em> der Bewertung — deshalb ohne Score und
              ohne LLM-Einschätzung.
            </dd>
          </div>
          <div className="flex items-start gap-4">
            <dt className="w-28 shrink-0 pt-0.5">
              <span className="rounded-full bg-gold-soft px-2.5 py-0.5 text-xs font-medium text-gold">
                korrigiert
              </span>
            </dt>
            <dd className="text-sm leading-relaxed text-ink-soft">
              Die Selbstkritik hat die erste Bewertung beanstandet — etwa
              ein Beleg-Zitat, das so nicht im CV steht — und die Bewertung
              wurde genau einmal mit den Korrekturhinweisen wiederholt.
              Angezeigt wird immer die korrigierte Fassung. Das sagt nichts
              über die Person aus, sondern zeigt, dass die
              Qualitätssicherung gegriffen hat; die Scores dort mit etwas
              mehr Vorsicht lesen.
            </dd>
          </div>
        </dl>
      </section>

      {/* --- K.O. + Ablehnungsgruende ------------------------------------ */}
      <section>
        <h2 className="font-serif text-2xl italic">
          K.O.-Kriterien &amp; Ablehnungsgründe
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-ink-soft">
          K.O.-Kriterien sind harte Formal-Checks <em>vor</em> der Bewertung:
          Fehlt ein Pflichtdokument, gibt es weder Score noch
          LLM-Einschätzung, nur einen Verlaufs-Eintrag mit dem Grund.
          Aktuell konfigurierbar:
        </p>
        <ul className="mt-3 space-y-1.5">
          {Object.values(labels.ko).map((label) => (
            <li key={label} className="flex items-center gap-2 text-sm">
              <span className="rounded-full bg-rot-soft px-2 py-px text-[10px] font-medium text-rot">
                K.O.
              </span>
              {label}
            </li>
          ))}
        </ul>
        <p className="mt-5 text-sm leading-relaxed text-ink-soft">
          Inhaltliche Schwächen erfasst das LLM dagegen als feste
          Kategorien (kein Freitext), damit man im Verlauf filtern und
          zählen kann, woran Bewerbungen scheitern:
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {Object.values(labels.gruende).map((label) => (
            <span
              key={label}
              className="rounded-full bg-rot-soft px-2.5 py-0.5 text-xs text-rot"
            >
              {label}
            </span>
          ))}
        </div>
      </section>

      {/* --- Stack & Grenzen --------------------------------------------- */}
      <section>
        <h2 className="font-serif text-2xl italic">Stack &amp; Grenzen</h2>
        <dl className="mt-4 space-y-3 text-sm leading-relaxed">
          <div>
            <dt className="font-medium">Stack</dt>
            <dd className="text-ink-soft">
              LangChain (LCEL) + Gemini · FastAPI (<code className="text-xs">api/</code>) ·
              Next.js + Tailwind (<code className="text-xs">web/</code>) ·
              SQLite (<code className="text-xs">data/ergebnisse.db</code>).
              Uploads liegen unter <code className="text-xs">data/uploads/</code>,
              Testdaten erzeugt <code className="text-xs">scripts/generate_test_cvs.py</code>.
            </dd>
          </div>
          <div>
            <dt className="font-medium">Grenzen</dt>
            <dd className="text-ink-soft">
              Kein OCR für gescannte PDFs. Anonymisierung entfernt direkte
              Merkmale, aber keine indirekten Proxys (Stadtteile,
              Vereinsnamen). Der EU AI Act stuft Bewerber-Screening als
              Hochrisiko-System ein; dieses Projekt ist eine Studienarbeit,
              kein Produktivsystem, und ersetzt keine HR-Entscheidung.
            </dd>
          </div>
          <div>
            <dt className="font-medium">Selbst nachvollziehen</dt>
            <dd className="text-ink-soft">
              <code className="text-xs">
                python scripts/screen_cli.py data/test_cvs/* --ko-motivationsschreiben
              </code>{" "}
              fährt das komplette Screening über die Testdaten, inklusive
              eines Kandidaten, der absichtlich am K.O. scheitert, und eines
              Sammel-PDFs für den Bulk-Upload.
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
