// Sauvegarde de la progression : export/import JSON et synchronisation via un Gist GitHub privé.
// Le jeton (PAT « classic », scope gist) reste sur l'appareil, dans IndexedDB ; il n'est envoyé qu'à api.github.com.
import { signal } from '@preact/signals';
import { flush, getMeta, importProfiles, profiles, setMeta, type Profile } from './store.ts';

const FILE = 'coral-wiki.json';
const API = 'https://api.github.com';

export type Backup = { app: 'coral-wiki'; version: 1; exported_at: string; profiles: Profile[] };

export function backup(): Backup {
  return { app: 'coral-wiki', version: 1, exported_at: new Date().toISOString(), profiles: profiles.value };
}

export function parseBackup(text: string): Profile[] {
  let j: any;
  try {
    j = JSON.parse(text);
  } catch {
    throw new Error("Ce fichier n'est pas du JSON valide.");
  }
  if (j?.app !== 'coral-wiki' || !Array.isArray(j.profiles)) throw new Error("Ce fichier n'est pas une sauvegarde Coral Wiki.");
  return j.profiles;
}

/** Téléchargement d'un fichier de sauvegarde (aucun envoi réseau). */
export async function exportFile() {
  await flush();
  const blob = new Blob([JSON.stringify(backup(), null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `coral-wiki-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function importFile(file: File, replace: boolean) {
  const list = parseBackup(await file.text());
  await importProfiles(list, replace);
  return list.length;
}

// ---------- Gist ----------

export type GistConf = { token: string; gistId?: string; login?: string; lastSync?: number; auto?: boolean };
export const gist = signal<GistConf | null>(null);
export const syncState = signal<{ busy: boolean; msg: string; error: boolean }>({ busy: false, msg: '', error: false });

export async function loadGistConf() {
  gist.value = (await getMeta<GistConf>('gist')) ?? null;
  if (gist.value?.auto && navigator.onLine) syncNow().catch(() => {});
}

async function saveConf(c: GistConf | null) {
  gist.value = c;
  await setMeta('gist', c ?? undefined);
}

class GhError extends Error {
  status: number;
  constructor(status: number, msg: string) {
    super(msg);
    this.status = status;
  }
}

async function gh(token: string, path: string, init: RequestInit = {}) {
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
    cache: 'no-store',
  });
  if (r.status === 401) throw new GhError(401, 'Jeton refusé ou expiré.');
  if (r.status === 403 || r.status === 404) {
    const scopes = r.headers.get('x-oauth-scopes');
    if (scopes !== null && !scopes.split(/,\s*/).includes('gist')) throw new GhError(403, 'Ce jeton n’a pas le scope « gist ».');
    if (scopes === null && path === '/gists' && init.method === 'POST')
      throw new GhError(403, 'Jeton « fine-grained » détecté : il ne donne pas accès aux Gists. Créez un jeton « classic » avec le scope gist.');
    throw new GhError(r.status, r.status === 404 ? 'Gist introuvable.' : 'Accès refusé par GitHub.');
  }
  if (!r.ok) throw new GhError(r.status, `GitHub a répondu ${r.status}.`);
  return { json: await r.json(), scopes: r.headers.get('x-oauth-scopes') };
}

/** Vérifie le jeton (classic + scope gist) et l'enregistre. */
export async function connect(token: string, auto: boolean) {
  token = token.trim();
  if (!/^(ghp_|gho_)?[A-Za-z0-9_]{20,}$/.test(token) || token.startsWith('github_pat_'))
    throw new Error(token.startsWith('github_pat_') ? 'Jeton « fine-grained » : il ne donne pas accès aux Gists. Créez un jeton « classic » avec le scope gist.' : 'Format de jeton inattendu.');
  const { json, scopes } = await gh(token, '/user');
  if (scopes === null) throw new Error('Jeton « fine-grained » : il ne donne pas accès aux Gists. Créez un jeton « classic » avec le scope gist.');
  if (!scopes.split(/,\s*/).includes('gist')) throw new Error('Ce jeton n’a pas le scope « gist ».');
  await saveConf({ token, login: json.login, auto });
  return syncNow();
}

export async function disconnect() {
  await saveConf(null);
  syncState.value = { busy: false, msg: 'Synchronisation désactivée. Le Gist reste sur votre compte GitHub.', error: false };
}

export async function setAuto(auto: boolean) {
  if (gist.value) await saveConf({ ...gist.value, auto });
}

async function findGist(token: string): Promise<string | undefined> {
  for (let page = 1; page <= 5; page++) {
    const { json } = await gh(token, `/gists?per_page=100&page=${page}`);
    const hit = (json as any[]).find((g) => g.files?.[FILE]);
    if (hit) return hit.id;
    if ((json as any[]).length < 100) return undefined;
  }
}

async function readGist(token: string, id: string): Promise<Profile[]> {
  const { json } = await gh(token, `/gists/${id}`);
  const f = json.files?.[FILE];
  if (!f) return [];
  // Fichier volumineux : contenu tronqué dans la réponse, à relire via raw_url.
  const text = f.truncated ? await (await fetch(f.raw_url, { cache: 'no-store' })).text() : f.content;
  return parseBackup(text);
}

let running: Promise<void> | null = null;
/** Récupère le Gist, fusionne (version la plus récente de chaque profil), puis renvoie le résultat. */
export function syncNow(): Promise<void> {
  return (running ??= doSync().finally(() => (running = null)));
}

async function doSync() {
  const c = gist.value;
  if (!c) return;
  syncState.value = { busy: true, msg: 'Synchronisation…', error: false };
  try {
    await flush();
    let id = c.gistId ?? (await findGist(c.token));
    if (id) {
      try {
        const remote = await readGist(c.token, id);
        if (remote.length) await importProfiles(remote, false);
      } catch (e) {
        if (e instanceof GhError && e.status === 404) id = undefined;
        else throw e;
      }
    }
    const content = JSON.stringify(backup());
    if (id) await gh(c.token, `/gists/${id}`, { method: 'PATCH', body: JSON.stringify({ files: { [FILE]: { content } } }) });
    else id = (await gh(c.token, '/gists', { method: 'POST', body: JSON.stringify({ description: 'Coral Wiki — progression (sauvegarde automatique)', public: false, files: { [FILE]: { content } } }) })).json.id as string;
    await saveConf({ ...c, gistId: id, lastSync: Date.now() });
    syncState.value = { busy: false, msg: `Synchronisé à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.`, error: false };
  } catch (e) {
    const msg = !navigator.onLine ? 'Hors ligne : synchronisation reportée.' : e instanceof Error ? e.message : 'Erreur inconnue.';
    syncState.value = { busy: false, msg, error: true };
    throw e;
  }
}

// Synchronisation automatique : quand l'app passe en arrière-plan, si des modifications ont eu lieu depuis.
addEventListener('visibilitychange', () => {
  const c = gist.value;
  if (document.visibilityState !== 'hidden' || !c?.auto || !navigator.onLine) return;
  const changed = profiles.value.some((p) => p.updated > (c.lastSync ?? 0));
  if (changed) syncNow().catch(() => {});
});
