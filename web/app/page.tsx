"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import AnforderungenTab from "@/components/AnforderungenTab";
import AssistentTab from "@/components/AssistentTab";
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

type Tab =
  | "screening"
  | "anforderungen"
  | "genehmigt"
  | "verlauf"
  | "assistent"
  | "doku";

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
    <div className="flex min-h-screen w-full">
      {/* --- Sidebar ------------------------------------------------------ */}
      <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-line bg-surface px-3 pt-7 pb-5 max-md:w-16 max-md:px-2">
        <div className="px-3 max-md:px-0 max-md:text-center">
          <h1 className="font-serif text-2xl italic max-md:hidden">
            TalentLens
          </h1>
          <span aria-hidden className="hidden font-serif text-2xl italic max-md:inline">
            T
          </span>
          <p className="mt-0.5 text-xs text-ink-faint max-md:hidden">
            CV-Screening mit LangChain
          </p>
        </div>

        <nav className="mt-8 flex flex-col gap-1" aria-label="Bereiche">
          <NavEintrag
            label="Screening"
            aktiv={tab === "screening"}
            onClick={() => setTab("screening")}
            icon={<ScreeningIcon />}
          />
          <NavEintrag
            label="Anforderungen"
            aktiv={tab === "anforderungen"}
            onClick={() => setTab("anforderungen")}
            icon={<AnforderungenIcon />}
          />
          <NavEintrag
            label="Genehmigt"
            aktiv={tab === "genehmigt"}
            onClick={() => setTab("genehmigt")}
            icon={<GenehmigtIcon />}
          />
          <NavEintrag
            label="Verlauf"
            aktiv={tab === "verlauf"}
            onClick={() => setTab("verlauf")}
            icon={<VerlaufIcon />}
          />
          <NavEintrag
            label="Assistent"
            aktiv={tab === "assistent"}
            onClick={() => setTab("assistent")}
            icon={<AssistentIcon />}
          />
        </nav>

        <div className="mt-auto border-t border-line pt-3">
          <NavEintrag
            label="So funktioniert's"
            aktiv={tab === "doku"}
            onClick={() => setTab("doku")}
            icon={<HilfeIcon />}
          />
          <p className="mt-3 px-3 text-[11px] leading-relaxed text-ink-faint max-md:hidden">
            Uni-Projekt · LangChain + Gemini. Nur fiktive Testdaten — keine
            echten Bewerberdaten hochladen.
          </p>
        </div>
      </aside>

      {/* --- Contentfenster ------------------------------------------------ */}
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-4xl px-8 py-10 max-md:px-5">
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
              <strong className="font-medium">GOOGLE_API_KEY fehlt.</strong>{" "}
              Das Backend läuft, hat aber keinen Key — Analysen schlagen fehl.
              Lege im Projekt-Root eine <code className="text-xs">.env</code>{" "}
              an (Vorlage: <code className="text-xs">.env.example</code>) mit{" "}
              <code className="text-xs">GOOGLE_API_KEY=…</code> und starte das
              Backend neu. Die <code className="text-xs">.env</code> ist nicht
              im Git, muss nach dem Klonen also neu erstellt werden.
            </div>
          )}
          {passwortNoetig && <PasswortGate onFreigabe={laden} />}
          {labels && !passwortNoetig && (
            <>
              {/* Alle Bereiche bleiben gemountet und werden nur versteckt: So
                  ueberlebt der Screening-Zustand (laufende Analysen, Karten,
                  Fortschritt) den Wechsel. Verlauf/Genehmigt laden beim
                  Aktivieren frisch nach. */}
              <div className={tab === "screening" ? "" : "hidden"}>
                <ScreeningTab
                  stelle={stelle}
                  labels={labels}
                  lebenslaufPflicht={lebenslaufPflicht}
                  motivationPflicht={motivationPflicht}
                  zuAnforderungen={() => setTab("anforderungen")}
                />
              </div>
              <div className={tab === "anforderungen" ? "" : "hidden"}>
                <AnforderungenTab
                  stelle={stelle}
                  setStelle={stelleAendern}
                  lebenslaufPflicht={lebenslaufPflicht}
                  setLebenslaufPflicht={lebenslaufAendern}
                  motivationPflicht={motivationPflicht}
                  setMotivationPflicht={motivationAendern}
                />
              </div>
              <div className={tab === "genehmigt" ? "" : "hidden"}>
                <GenehmigtTab labels={labels} aktiv={tab === "genehmigt"} />
              </div>
              <div className={tab === "verlauf" ? "" : "hidden"}>
                <VerlaufTab labels={labels} aktiv={tab === "verlauf"} />
              </div>
              <div className={tab === "assistent" ? "" : "hidden"}>
                <AssistentTab stelle={stelle} />
              </div>
              <div className={tab === "doku" ? "" : "hidden"}>
                <DokuTab labels={labels} />
              </div>
            </>
          )}
          {!labels && !apiFehler && !passwortNoetig && (
            <p className="text-sm text-ink-faint">Lade…</p>
          )}
        </div>
      </main>
    </div>
  );
}

/** Sidebar-Navigationspunkt: Icon + Label, auf schmalen Screens nur Icon. */
function NavEintrag({
  label,
  aktiv,
  onClick,
  icon,
}: {
  label: string;
  aktiv: boolean;
  onClick: () => void;
  icon: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-current={aktiv ? "page" : undefined}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors max-md:justify-center max-md:px-0 ${
        aktiv
          ? "bg-tanne-soft font-medium text-tanne-deep"
          : "text-ink-soft hover:bg-canvas hover:text-ink"
      }`}
    >
      <span aria-hidden className="shrink-0">
        {icon}
      </span>
      <span className="max-md:sr-only">{label}</span>
    </button>
  );
}

/* --- Icons (Inline-SVG, Stroke-Stil) --------------------------------------- */

function IconRahmen({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[18px]"
    >
      {children}
    </svg>
  );
}

function ScreeningIcon() {
  // Dokument mit Lupe
  return (
    <IconRahmen>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <circle cx="11" cy="14" r="2.5" />
      <path d="m12.9 15.9 2.1 2.1" />
    </IconRahmen>
  );
}

function AnforderungenIcon() {
  // Klemmbrett mit Liste
  return (
    <IconRahmen>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M12 11h4" />
      <path d="M12 16h4" />
      <path d="M8 11h.01" />
      <path d="M8 16h.01" />
    </IconRahmen>
  );
}

function GenehmigtIcon() {
  return (
    <IconRahmen>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </IconRahmen>
  );
}

function VerlaufIcon() {
  // Uhr mit Rueckwaerts-Pfeil
  return (
    <IconRahmen>
      <path d="M3 12a9 9 0 1 0 3-6.7L3.5 7.5" />
      <path d="M3 3v4.5h4.5" />
      <path d="M12 8v4l2.5 2.5" />
    </IconRahmen>
  );
}

function AssistentIcon() {
  // Sprechblase
  return (
    <IconRahmen>
      <path d="M21 12a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.4-5.7a8.4 8.4 0 0 1-.9-3.3A8.5 8.5 0 0 1 12 3.5h.5a8.5 8.5 0 0 1 8.5 8.5z" />
    </IconRahmen>
  );
}

function HilfeIcon() {
  return (
    <IconRahmen>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.3 9a2.8 2.8 0 0 1 5.4.9c0 1.8-2.7 2.4-2.7 3.6" />
      <path d="M12 17h.01" />
    </IconRahmen>
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
