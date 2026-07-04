import type {
  Entwurf,
  Konfiguration,
  Labels,
  ScreeningErgebnis,
  VerlaufEintrag,
} from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

// Optionales Zugriffs-Passwort (fuers Hosting): wird lokal gespeichert und
// bei jedem Aufruf mitgeschickt. Das Backend prueft es nur, wenn dort
// TALENTLENS_PASSWORT gesetzt ist.
const PASSWORT_KEY = "tl.passwort";

export function speicherePasswort(passwort: string) {
  localStorage.setItem(PASSWORT_KEY, passwort);
}

function passwortHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const passwort = localStorage.getItem(PASSWORT_KEY);
  return passwort ? { "X-Passwort": passwort } : {};
}

function api(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(path, {
    ...init,
    headers: { ...(init.headers as Record<string, string>), ...passwortHeader() },
  });
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const detail = await res
      .json()
      .then((d) => d.detail as string)
      .catch(() => res.statusText);
    throw new ApiError(detail || `HTTP ${res.status}`, res.status);
  }
  return res.json();
}

export async function fetchStelle(): Promise<string> {
  const data = await json<{ text: string }>(await api("/api/stelle"));
  return data.text;
}

export async function fetchLabels(): Promise<Labels> {
  return json(await api("/api/labels"));
}

export async function fetchKonfiguration(): Promise<Konfiguration> {
  return json(await api("/api/konfiguration"));
}

export async function fetchHealth(): Promise<{
  ok: boolean;
  api_key_geladen: boolean;
  passwort_erforderlich: boolean;
  modell: string;
}> {
  return json(await api("/api/health", { cache: "no-store" }));
}

export async function fetchErgebnisse(): Promise<VerlaufEintrag[]> {
  return json(await api("/api/ergebnisse", { cache: "no-store" }));
}

export async function loescheVerlauf(): Promise<void> {
  await json(await api("/api/ergebnisse", { method: "DELETE" }));
}

// --- Entwuerfe (persistente Uploads) ---------------------------------------

export async function fetchEntwuerfe(): Promise<Entwurf[]> {
  return json(await api("/api/entwuerfe", { cache: "no-store" }));
}

export async function erstelleEntwurf(kandidat: string): Promise<Entwurf> {
  return json(
    await api("/api/entwuerfe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kandidat }),
    }),
  );
}

export async function benenneEntwurfUm(
  id: number,
  kandidat: string,
): Promise<void> {
  await json(
    await api(`/api/entwuerfe/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kandidat }),
    }),
  );
}

export async function loescheEntwurf(id: number): Promise<void> {
  await json(await api(`/api/entwuerfe/${id}`, { method: "DELETE" }));
}

export async function ladeDateienHoch(
  id: number,
  dateien: File[],
): Promise<Entwurf> {
  const form = new FormData();
  for (const datei of dateien) form.append("dateien", datei);
  return json(
    await api(`/api/entwuerfe/${id}/dateien`, { method: "POST", body: form }),
  );
}

export async function loescheDatei(
  id: number,
  name: string,
): Promise<Entwurf> {
  return json(
    await api(`/api/entwuerfe/${id}/dateien/${encodeURIComponent(name)}`, {
      method: "DELETE",
    }),
  );
}

export interface EingangErgebnis {
  entwuerfe: Entwurf[];
  verarbeitet: { datei: string; kandidat: string; dokumente: string[] }[];
  fehler: { datei: string; meldung: string }[];
}

export async function bulkUpload(dateien: File[]): Promise<EingangErgebnis> {
  const form = new FormData();
  for (const datei of dateien) form.append("dateien", datei);
  return json(await api("/api/eingang", { method: "POST", body: form }));
}

export async function analysiereEntwurf(
  id: number,
  opts: {
    kandidat: string;
    stelle: string;
    lebenslaufErforderlich: boolean;
    motivationsschreibenErforderlich: boolean;
  },
): Promise<ScreeningErgebnis> {
  const form = new FormData();
  form.set("kandidat", opts.kandidat);
  form.set("stelle", opts.stelle);
  form.set("lebenslauf_erforderlich", String(opts.lebenslaufErforderlich));
  form.set(
    "motivationsschreiben_erforderlich",
    String(opts.motivationsschreibenErforderlich),
  );
  return json(
    await api(`/api/entwuerfe/${id}/analysieren`, {
      method: "POST",
      body: form,
    }),
  );
}
