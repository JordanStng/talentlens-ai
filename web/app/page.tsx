"use client";

import { useEffect, useState, type FormEvent } from "react";
import AnforderungenTab from "@/components/AnforderungenTab";
import DokuTab from "@/components/DokuTab";
import GenehmigtTab from "@/components/GenehmigtTab";
import ScreeningTab from "@/components/ScreeningTab";
import VerlaufTab from "@/components/VerlaufTab";
import {
  ApiError,
  fetchHealth,
  fetchLabels,
  fetchStelle,
  speicherePasswort,
} from "@/lib/api";
import type { Labels } from "@/lib/types";

type Tab = "screening" | "anforderungen" | "genehmigt" | "verlauf" | "doku";

const TABS: { id: Tab; label: string }[] = [
  { id: "screening", label: "Screening" },
  { id: "anforderungen", label: "Anforderungen" },
  { id: "genehmigt", label: "Genehmigt" },
  { id: "verlauf", label: "Verlauf" },
  { id: "doku", label: "So funktioniert's" },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("screening");
  const [labels, setLabels] = useState<Labels | null>(null);
  const [stelle, setStelle] = useState("");
  const [lebenslaufPflicht, setLebenslaufPflicht] = useState(true);
  const [motivationPflicht, setMotivationPflicht] = useState(false);
  const [apiFehler, setApiFehler] = useState(false);
  const [keyFehlt, setKeyFehlt] = useState(false);
  const [passwortNoetig, setPasswortNoetig] = useState(false);

  // labels/stelle laufen durch den Passwortschutz: 401 -> Passwort-Gate zeigen
  const laden = () =>
    Promise.all([fetchHealth(), fetchLabels(), fetchStelle()])
      .then(([health, l, s]) => {
        setKeyFehlt(!health.api_key_geladen);
        setLabels(l);
        // lokal bearbeitete Werte ueberleben den Reload
        setStelle(localStorage.getItem("tl.stelle") ?? s);
        setLebenslaufPflicht(localStorage.getItem("tl.ko.lebenslauf") !== "0");
        setMotivationPflicht(localStorage.getItem("tl.ko.motivation") === "1");
        setApiFehler(false);
        setPasswortNoetig(false);
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) setPasswortNoetig(true);
        else setApiFehler(true);
      });

  useEffect(() => {
    laden();
  }, []);

  const stelleAendern = (s: string) => {
    setStelle(s);
    localStorage.setItem("tl.stelle", s);
  };
  const lebenslaufAendern = (v: boolean) => {
    setLebenslaufPflicht(v);
    localStorage.setItem("tl.ko.lebenslauf", v ? "1" : "0");
  };
  const motivationAendern = (v: boolean) => {
    setMotivationPflicht(v);
    localStorage.setItem("tl.ko.motivation", v ? "1" : "0");
  };

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6">
      <header className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4 border-b border-line pt-10 pb-0">
        <div className="pb-4">
          <h1 className="font-serif text-3xl italic">TalentLens</h1>
          <p className="mt-0.5 text-sm text-ink-faint">
            CV-Screening mit LangChain: bewertet, begründet und sortiert.
          </p>
        </div>
        <nav className="flex flex-wrap gap-6" aria-label="Bereiche">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`border-b-2 pb-3 text-sm transition-colors ${
                tab === t.id
                  ? "border-tanne font-medium text-ink"
                  : "border-transparent text-ink-soft hover:text-ink"
              }`}
              aria-current={tab === t.id ? "page" : undefined}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="py-10">
        {apiFehler && (
          <div className="mb-8 rounded-lg bg-rot-soft px-4 py-3 text-sm text-rot">
            API nicht erreichbar. Läuft das Backend?{" "}
            <code className="text-xs">
              uvicorn api.main:app --reload --port 8000
            </code>
          </div>
        )}
        {keyFehlt && !apiFehler && (
          <div className="mb-8 rounded-lg bg-gold-soft px-4 py-3 text-sm text-gold">
            <strong className="font-medium">GOOGLE_API_KEY fehlt.</strong> Das
            Backend läuft, hat aber keinen Key — Analysen schlagen fehl. Lege
            im Projekt-Root eine <code className="text-xs">.env</code> an
            (Vorlage: <code className="text-xs">.env.example</code>) mit{" "}
            <code className="text-xs">GOOGLE_API_KEY=…</code> und starte das
            Backend neu. Die <code className="text-xs">.env</code> ist nicht im
            Git, muss nach dem Klonen also neu erstellt werden.
          </div>
        )}
        {passwortNoetig && <PasswortGate onFreigabe={laden} />}
        {labels && !passwortNoetig && (
          <>
            {tab === "screening" && (
              <ScreeningTab
                stelle={stelle}
                labels={labels}
                lebenslaufPflicht={lebenslaufPflicht}
                motivationPflicht={motivationPflicht}
                zuAnforderungen={() => setTab("anforderungen")}
              />
            )}
            {tab === "anforderungen" && (
              <AnforderungenTab
                stelle={stelle}
                setStelle={stelleAendern}
                lebenslaufPflicht={lebenslaufPflicht}
                setLebenslaufPflicht={lebenslaufAendern}
                motivationPflicht={motivationPflicht}
                setMotivationPflicht={motivationAendern}
              />
            )}
            {tab === "genehmigt" && <GenehmigtTab labels={labels} />}
            {tab === "verlauf" && <VerlaufTab labels={labels} />}
            {tab === "doku" && <DokuTab labels={labels} />}
          </>
        )}
        {!labels && !apiFehler && !passwortNoetig && (
          <p className="text-sm text-ink-faint">Lade…</p>
        )}
      </main>

      <footer className="border-t border-line py-6 text-xs text-ink-faint">
        Uni-Projekt · LangChain + Gemini · Nur fiktive Testdaten — keine echten
        Bewerberdaten hochladen.
      </footer>
    </div>
  );
}

/** Einfacher Zugriffsschutz fuers Hosting: fragt das gemeinsame Passwort ab
 *  und prueft es gegen die API. Erscheint nur, wenn das Backend mit
 *  TALENTLENS_PASSWORT gestartet wurde. */
function PasswortGate({ onFreigabe }: { onFreigabe: () => Promise<void> }) {
  const [passwort, setPasswort] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [prueft, setPrueft] = useState(false);

  async function absenden(e: FormEvent) {
    e.preventDefault();
    if (!passwort.trim() || prueft) return;
    setPrueft(true);
    setFehler(null);
    speicherePasswort(passwort.trim());
    try {
      await fetchLabels(); // schlaegt bei falschem Passwort mit 401 fehl
      await onFreigabe();
    } catch (err) {
      setFehler(
        err instanceof ApiError && err.status === 401
          ? "Falsches Passwort."
          : "API nicht erreichbar.",
      );
    }
    setPrueft(false);
  }

  return (
    <form onSubmit={absenden} className="mx-auto max-w-sm py-16 text-center">
      <p className="font-serif text-2xl italic">Zugang geschützt</p>
      <p className="mt-2 text-sm text-ink-faint">
        Diese Instanz ist passwortgeschützt. Das Passwort bekommst du vom
        Team.
      </p>
      <input
        type="password"
        value={passwort}
        onChange={(e) => setPasswort(e.target.value)}
        placeholder="Passwort"
        autoFocus
        className="mt-6 w-full rounded-lg border border-line bg-surface px-4 py-2.5 text-sm outline-none focus:border-tanne"
      />
      {fehler && <p className="mt-2 text-sm text-rot">{fehler}</p>}
      <button
        type="submit"
        disabled={prueft || !passwort.trim()}
        className="mt-4 w-full rounded-lg bg-tanne px-5 py-2.5 text-sm font-medium text-surface transition-colors hover:bg-tanne-deep disabled:cursor-not-allowed disabled:opacity-40"
      >
        {prueft ? "Prüfe…" : "Entsperren"}
      </button>
    </form>
  );
}
