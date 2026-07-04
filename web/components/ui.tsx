export function formatScore(score: number): string {
  return score.toLocaleString("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export function StatusChip({
  status,
  ko,
  empfehlung,
}: {
  status: "genehmigt" | "abgelehnt";
  ko?: boolean;
  empfehlung?: string | null;
}) {
  // Genehmigt mit Empfehlung "Pruefen" soll ueberall (auch im Verlauf)
  // als "Pruefen" erkennbar sein, nicht nur als "Genehmigt".
  if (status === "genehmigt" && empfehlung === "Pruefen") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-soft px-2.5 py-0.5 text-xs font-medium text-gold">
        <span className="size-1.5 rounded-full bg-gold" />
        Prüfen
      </span>
    );
  }
  if (status === "genehmigt") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-tanne-soft px-2.5 py-0.5 text-xs font-medium text-tanne-deep">
        <span className="size-1.5 rounded-full bg-tanne" />
        Genehmigt
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-rot-soft px-2.5 py-0.5 text-xs font-medium text-rot">
      <span className="size-1.5 rounded-full bg-rot" />
      {ko ? "K.O." : "Abgelehnt"}
    </span>
  );
}

export function EmpfehlungChip({ empfehlung }: { empfehlung: string }) {
  const stil =
    empfehlung === "Einladen"
      ? "bg-tanne-soft text-tanne-deep"
      : empfehlung === "Pruefen"
        ? "bg-gold-soft text-gold"
        : "bg-rot-soft text-rot";
  const label = empfehlung === "Pruefen" ? "Prüfen" : empfehlung;
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${stil}`}>
      {label}
    </span>
  );
}

export function ScoreBar({ score }: { score: number }) {
  const farbe = score >= 7 ? "bg-tanne" : score >= 5 ? "bg-gold" : "bg-rot";
  return (
    <div className="h-0.5 w-full rounded-full bg-line">
      <div
        className={`h-0.5 rounded-full ${farbe}`}
        style={{ width: `${score * 10}%` }}
      />
    </div>
  );
}

export function FortschrittsBalken({
  fertig,
  gesamt,
}: {
  fertig: number;
  gesamt: number;
}) {
  const prozent = gesamt > 0 ? (fertig / gesamt) * 100 : 0;
  return (
    <div
      role="progressbar"
      aria-valuenow={fertig}
      aria-valuemin={0}
      aria-valuemax={gesamt}
      className="h-1 w-full rounded-full bg-line"
    >
      <div
        className="h-1 rounded-full bg-tanne transition-[width] duration-500 ease-out"
        style={{ width: `${prozent}%` }}
      />
    </div>
  );
}

export function Spinner() {
  return (
    <span
      className="inline-block size-3.5 animate-spin rounded-full border-[1.5px] border-line-strong border-t-tanne"
      aria-label="Wird bewertet"
    />
  );
}
