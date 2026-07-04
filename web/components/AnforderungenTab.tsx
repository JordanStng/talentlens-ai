"use client";

/** Anforderungskonfiguration: Stellenausschreibung + K.O.-Kriterien.
 *  Eigener Tab, damit der wichtigste fachliche Input nicht in der
 *  Seitenleiste der Screening-Seite untergeht. */
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
  return (
    <div className="mx-auto max-w-3xl space-y-12">
      <section>
        <h2 className="font-serif text-2xl italic">Stellenausschreibung</h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-faint">
          Gegen diese Anforderungen werden alle Bewerbungen bewertet.
          Änderungen gelten sofort für die nächste Analyse und bleiben lokal
          im Browser gespeichert.
        </p>
        <textarea
          value={stelle}
          onChange={(e) => setStelle(e.target.value)}
          rows={22}
          placeholder="Stellenausschreibung hier einfügen…"
          className="mt-4 w-full resize-y rounded-xl border border-line bg-surface p-4 text-sm leading-relaxed text-ink outline-none focus:border-tanne"
        />
        {!stelle.trim() && (
          <p className="mt-2 text-sm text-rot">
            Ohne Stellenausschreibung kann keine Analyse gestartet werden.
          </p>
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
