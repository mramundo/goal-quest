import { config, githubApiUrl, githubRawUrl } from "./config";
import { SEED, type SeedPath } from "./seed";

/**
 * Wrapper GitHub Contents API per leggere/scrivere JSON di dominio.
 *
 * Lettura: raw.githubusercontent.com — gratis, senza rate limit spinto, no auth.
 * Scrittura: Contents API con PAT fine-grained.
 *
 * Non è un client generico: sa solo gestire file JSON dentro `data/`.
 */

interface ContentResponse {
  sha: string;
  content: string; // base64
  encoding: string;
}

class GithubError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`GitHub API error ${status}`);
  }
}

const shaCache = new Map<string, string>();

/** Seed bundlato come fallback (primo run / repo non ancora pubblicato). */
function seedFor<T>(path: string, fallback: T): T {
  if (path in SEED) return SEED[path as SeedPath] as unknown as T;
  return fallback;
}

/**
 * Legge un file JSON dal repo via raw.githubusercontent.com.
 * Ritorna il seed bundlato se il file remoto non esiste (404).
 */
export async function readJsonRaw<T>(path: string, fallback: T): Promise<T> {
  const url = `${githubRawUrl(`${config.github.dataDir}/${path}`)}?cb=${Date.now()}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (res.status === 404) return seedFor(path, fallback);
    if (!res.ok) throw new GithubError(res.status, await res.text());
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof GithubError) throw err;
    // Network error (CORS, offline): in demo mode usa il seed, in prod rilancia
    console.warn("[github] raw read failed, using seed fallback", path, err);
    return seedFor(path, fallback);
  }
}

/**
 * Legge un file via Contents API — usato prima di una scrittura per ottenere lo SHA.
 * Se il file non esiste, ritorna `null`.
 */
async function readViaApi(path: string): Promise<ContentResponse | null> {
  const url = githubApiUrl(`contents/${config.github.dataDir}/${path}?ref=${config.github.branch}`);
  const res = await fetch(url, {
    headers: authHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new GithubError(res.status, await res.text());
  const data = (await res.json()) as ContentResponse;
  shaCache.set(path, data.sha);
  return data;
}

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (config.github.token) {
    h.Authorization = `Bearer ${config.github.token}`;
  }
  return h;
}

function toBase64(value: string): string {
  // btoa non gestisce bene UTF-8; uso TextEncoder
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function fromBase64(value: string): string {
  const binary = atob(value.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/**
 * Scrive un file JSON nel repo. Retry automatico (max 3) su conflitto SHA.
 * Lancia se demoMode è attivo o se non c'è il token.
 */
export async function writeJson<T>(path: string, data: T, message: string): Promise<void> {
  if (!config.github.token) {
    throw new Error(
      "Nessun token GitHub configurato. Modalità demo: i dati non verranno persistiti."
    );
  }

  const payload = JSON.stringify(data, null, 2);
  const content = toBase64(payload + "\n");

  for (let attempt = 0; attempt < 3; attempt++) {
    let sha = shaCache.get(path);
    if (!sha) {
      const current = await readViaApi(path);
      sha = current?.sha;
    }

    const body: Record<string, unknown> = {
      message,
      content,
      branch: config.github.branch,
    };
    if (sha) body.sha = sha;

    const url = githubApiUrl(`contents/${config.github.dataDir}/${path}`);
    const res = await fetch(url, {
      method: "PUT",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const result = (await res.json()) as { content?: { sha: string } };
      if (result.content?.sha) shaCache.set(path, result.content.sha);
      return;
    }

    if (res.status === 409 || res.status === 422) {
      // SHA stale → ricarico e riprovo
      shaCache.delete(path);
      continue;
    }

    throw new GithubError(res.status, await res.text());
  }
  throw new Error(`writeJson: troppi conflitti scrivendo ${path}`);
}

/**
 * Legge via API (ottimo per avere SHA aggiornato) ma con fallback a raw
 * quando il PAT non è settato.
 */
export async function readJson<T>(path: string, fallback: T): Promise<T> {
  if (config.github.token) {
    try {
      const res = await readViaApi(path);
      if (!res) return fallback;
      return JSON.parse(fromBase64(res.content)) as T;
    } catch (err) {
      if (err instanceof GithubError && err.status === 404) return fallback;
      console.warn("[github] api read failed, trying raw", path, err);
    }
  }
  return readJsonRaw(path, fallback);
}
