"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";

/** Anforderungskonfiguration: Stellenausschreibung + K.O.-Kriterien.
 *  Standardmaessig eine gerenderte Leseansicht (praesentationstauglich);
 *  der rohe Markdown-Text ist nur im Bearbeiten-Modus sichtbar. */
export default function AnforderungenTab({
  stelle,
  setStelle,
  lebenslaufPflicht,
  setLebenslaufPflicht,
  motivationPflicht,
  setMotivationPflicht,
}: {
  stelle: string;
  setStelle: (s: string) => void;
  lebenslaufPflicht: boolean;
  setLebenslaufPflicht: (v: boolean) => void;
  motivationPflicht: boolean;
  setMotivationPflicht: (v: boolean) => void;
}) {
  const [bearbeiten, setBearbeiten] = useState(false);

  return (
    <div className="mx-auto max-w-3xl space-y-12">
      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 className="font-serif text-2xl italic">Stellenausschreibung</h2>
          {stelle.trim() && (
            <button
              onClick={() => setBearbeiten(!bearbeiten)}
              className="text-xs font-medium text-tanne transition-colors hover:text-tanne-deep"
            >
              {bearbeiten ? "Fertig — Leseansicht zeigen" : "Bearbeiten"}
            </button>
          )}
        </div>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-faint">
          Gegen diese Anforderungen werden alle Bewerbungen bewertet.
          Änderungen gelten sofort für die nächste Analyse und bleiben lokal
          im Browser gespeichert.
        </p>

        {bearbeiten ? (
          <>
            <textarea
              value={stelle}
              onChange={(e) => setStelle(e.target.value)}
              rows={22}
              autoFocus
              placeholder="Stellenausschreibung hier einfügen…"
              className="mt-4 w-full resize-y rounded-xl border border-line bg-surface p-4 text-sm leading-relaxed text-ink outline-none focus:border-tanne"
            />
            <p className="mt-2 text-xs text-ink-faint">
              Markdown wird unterstützt: <code># Titel</code>,{" "}
              <code>## Abschnitt</code>, <code>- Aufzählung</code>,{" "}
              <code>**fett**</code>.
            </p>
          </>
        ) : stelle.trim() ? (
          <div className="mt-4 rounded-xl border border-line bg-surface px-6 py-7 sm:px-8">
            <ReactMarkdown
              components={{
                h1: ({ children }) => (
                  <h3 className="font-serif text-2xl italic text-ink">
                    {children}
                  </h3>
                ),
                h2: ({ children }) => (
                  <h4 className="mt-7 mb-2 text-xs font-medium tracking-wide text-tanne-deep uppercase first:mt-0">
                    {children}
                  </h4>
                ),
                h3: ({ children }) => (
                  <h5 className="mt-5 mb-1.5 text-sm font-medium text-ink">
                    {children}
                  </h5>
                ),
                p: ({ children }) => (
                  <p className="my-2 max-w-prose text-sm leading-relaxed text-ink-soft">
                    {children}
                  </p>
                ),
                ul: ({ children }) => (
                  <ul className="my-2 max-w-prose list-disc space-y-1.5 pl-5 marker:text-tanne">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="my-2 max-w-prose list-decimal space-y-1.5 pl-5 marker:text-tanne">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="text-sm leading-relaxed text-ink-soft">
                    {children}
                  </li>
                ),
                strong: ({ children }) => (
                  <strong className="font-medium text-ink">{children}</strong>
                ),
                a: ({ children, href }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-tanne underline decoration-line-strong underline-offset-2 hover:decoration-tanne"
                  >
                    {children}
                  </a>
                ),
                code: ({ children }) => (
                  <code className="rounded bg-tanne-soft px-1 py-0.5 text-xs">
                    {children}
                  </code>
                ),
              }}
            >
              {stelle}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-line-strong px-6 py-12 text-center">
            <p className="font-serif text-xl italic text-ink-faint">
              Noch keine Stellenausschreibung hinterlegt.
            </p>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-faint">
              Ohne sie kann keine Analyse gestartet werden.
            </p>
            <button
              onClick={() => setBearbeiten(true)}
              className="mt-5 rounded-lg bg-tanne px-5 py-2.5 text-sm font-medium text-surface transition-colors hover:bg-tanne-deep"
            >
              Ausschreibung einfügen
            </button>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-base font-medium">K.O.-Kriterien</h2>
        <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-faint">
          Wird ein Pflichtdokument nicht erkannt, wird die Bewerbung ohne
          LLM-Bewertung direkt abgelehnt.
        </p>
        <div className="mt-4 space-y-2.5">
          <label className="flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={lebenslaufPflicht}
              onChange={(e) => setLebenslaufPflicht(e.target.checked)}
              className="mt-0.5 size-4 accent-tanne"
            />
            Lebenslauf erforderlich
          </label>
          <label className="flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={motivationPflicht}
              onChange={(e) => setMotivationPflicht(e.target.checked)}
              className="mt-0.5 size-4 accent-tanne"
            />
            Motivationsschreiben erforderlich
          </label>
        </div>
      </section>
    </div>
  );
}
