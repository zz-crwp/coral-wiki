// Sauvegarde et progression commune.
// - Export / import d'un fichier JSON (v2 ; les fichiers v1 sont migrés à la lecture).
// - Progression commune par GitHub Gist, sans serveur : UN compte GitHub pour le foyer, le même jeton sur chaque
//   téléphone ; chaque joueur n'a qu'un prénom. Le gist secret commun contient un fichier par joueur
//   (joueur-<id>.json) : chacun n'écrit que le sien, lit tous les autres et fusionne clé par clé (la marque
//   la plus récente gagne, voir progress.ts). Envoi groupé 5 s après la dernière coche et au passage en
//   arrière-plan ; lecture au démarrage et au retour au premier plan, avec ETag (réponse 304 sans quota).
import { effect, signal } from '@preact/signals';
import { absorb, active, flush, getMeta, importProfiles, localChange, me, profiles, setMeta, setPartners, type Partner, type Profile } from './store.ts';
import { effective, onKeys, type Progress } from './progress.ts';

const fileOfPlayer = (id: string) => `joueur-${id}.json`;
const PLAYER_FILE = /^joueur-(.+)\.json$/;
const API = 'https://api.github.com';
const DESC = 'Coral Wiki — progression commune';

export type Backup = { app: 'coral-wiki'; version: 2; exported_at: string; player: { id: string; name: string }; profiles: Profile[] };
export type GistFile = { app: 'coral-wiki'; version: 2; player: { id: string; name: string }; partie: { id: string; name: string }; updated: number; progress: Progress };

export function backup(): Backup {
  // `checks` (clé → horodatage) en plus des marques : un fichier v2 reste importable par la v1 (retour arrière)
  const list = profiles.value.map((p) => ({ ...p, checks: onKeys(effective(p.prog, (p.partners ?? []).map((x) => x.prog))) }));
  return { app: 'coral-wiki', version: 2, exported_at: new Date().toISOString(), player: me.value, profiles: list };
}

export function parseBackup(text: string): unknown[] {
  let j: any;
  try {
    j = JSON.parse(text);
  } catch {
    throw new Error("Ce fichier n'est pas du JSON valide.");
  }
  if (j?.app !== 'coral-wiki' || !Array.isArray(j.profiles)) throw new Error("Ce fichier n'est pas une sauvegarde Coral Wiki.");
  return j.profiles;
}

/** Téléchargement d'un fichier JSON (aucun envoi réseau). */
export function download(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function exportFile() {
  await flush();
  download(`coral-wiki-${new Date().toISOString().slice(0, 10)}.json`, backup());
}

export async function importFile(file: File, replace: boolean) {
  const list = parseBackup(await file.text());
  await importProfiles(list, replace);
  return list.length;
}

// ---------- Gist commun ----------

export type GistConf = {
  token: string;
  login?: string;
  gistId?: string; // gist commun du foyer
  etag?: string; // dernier ETag lu
  profileId?: string; // partie synchronisée
  lastPush?: number;
  lastPull?: number;
  auto?: boolean;
};
export const gist = signal<GistConf | null>(null);
export const syncState = signal<{ busy: boolean; msg: string; error: boolean }>({ busy: false, msg: '', error: false });

export async function loadGistConf() {
  gist.value = (await getMeta<GistConf>('gist3')) ?? null;
  if (gist.value && navigator.onLine) pullNow().catch(() => {});
}

async function saveConf(c: GistConf | null) {
  gist.value = c;
  await setMeta('gist3', c ?? undefined);
}

class GhError extends Error {
  status: number;
  constructor(status: number, msg: string) {
    super(msg);
    this.status = status;
  }
}
const FINE = 'Jeton « fine-grained » : il ne donne pas accès aux Gists. Créez un jeton « classic » avec le scope gist.';

async function gh(token: string, path: string, init: RequestInit & { etag?: string } = {}) {
  const { etag, ...rest } = init;
  const r = await fetch(`${API}${path}`, {
    ...rest,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
      ...(etag ? { 'If-None-Match': etag } : {}),
    },
    cache: 'no-store',
  });
  if (r.status === 304) return { json: null, etag, scopes: r.headers.get('x-oauth-scopes'), notModified: true };
  if (r.status === 401) throw new GhError(401, 'Jeton refusé ou expiré.');
  if (r.status === 403 || r.status === 404) {
    const scopes = r.headers.get('x-oauth-scopes');
    if (scopes !== null && !scopes.split(/,\s*/).includes('gist')) throw new GhError(403, 'Ce jeton n’a pas le scope « gist ».');
    if (scopes === null && path === '/gists' && rest.method === 'POST') throw new GhError(403, FINE);
    throw new GhError(r.status, r.status === 404 ? 'Gist introuvable.' : 'Accès refusé par GitHub.');
  }
  if (!r.ok) throw new GhError(r.status, `GitHub a répondu ${r.status}.`);
  return { json: await r.json(), etag: r.headers.get('etag') ?? undefined, scopes: r.headers.get('x-oauth-scopes'), notModified: false };
}

/** Fichiers des joueurs dans le gist commun (contenu tronqué relu via raw_url). */
async function playersOf(json: any): Promise<GistFile[]> {
  const out: GistFile[] = [];
  for (const [name, f] of Object.entries<any>(json?.files ?? {})) {
    if (!PLAYER_FILE.test(name)) continue;
    const text = f.truncated ? await (await fetch(f.raw_url, { cache: 'no-store' })).text() : f.content;
    try {
      const j = JSON.parse(text);
      if (j?.app === 'coral-wiki' && j.version === 2 && j.progress && j.player?.id) out.push(j as GistFile);
    } catch {}
  }
  return out;
}

/** Joueurs vus dans le gist commun (hors moi), pour l'écran des réglages. */
export const others = () => active.value?.partners ?? [];

/**
 * Connexion : vérifie le jeton (classic + scope gist) et retrouve le gist commun du compte s'il existe déjà
 * (deuxième téléphone) ; sinon il sera créé au premier envoi. Aucun appairage : même jeton = même gist.
 */
export async function connect(token: string, auto = true) {
  token = token.trim();
  if (token.startsWith('github_pat_')) throw new Error(FINE);
  if (!/^(ghp_|gho_)?[A-Za-z0-9_]{20,}$/.test(token)) throw new Error('Format de jeton inattendu.');
  const { json, scopes } = await gh(token, '/user');
  if (scopes === null) throw new Error(FINE);
  if (!scopes.split(/,\s*/).includes('gist')) throw new Error('Ce jeton n’a pas le scope « gist ».');
  const c: GistConf = { token, login: json.login, auto, profileId: active.value?.id };
  // Le plus ancien gist « Coral Wiki — progression commune » du compte : tous les téléphones tombent sur le même
  const found: any[] = [];
  for (let page = 1; page <= 5; page++) {
    const list = (await gh(token, `/gists?per_page=100&page=${page}`)).json as any[];
    found.push(...list.filter((g) => String(g.description ?? '') === DESC));
    if (list.length < 100) break;
  }
  c.gistId = found.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))[0]?.id;
  await saveConf(c);
  await syncNow();
}

export async function disconnect() {
  await saveConf(null);
  setPartners([]);
  syncState.value = { busy: false, msg: 'Synchronisation désactivée sur ce téléphone. Le gist reste sur le compte GitHub.', error: false };
}

export async function setAuto(auto: boolean) {
  if (gist.value) await saveConf({ ...gist.value, auto });
}

const synced = () => {
  const c = gist.value;
  return !!c && !!active.value && (!c.profileId || c.profileId === active.value.id);
};

let pulling: Promise<void> | null = null;
/** Lit le gist commun (ETag) : mes marques venues d'ailleurs sont fusionnées, celles des autres joueurs gardées à part. */
export function pullNow(): Promise<void> {
  return (pulling ??= doPull().finally(() => (pulling = null)));
}
async function doPull() {
  const c = gist.value;
  if (!c?.gistId || !synced() || !navigator.onLine) return;
  try {
    const r = await gh(c.token, `/gists/${c.gistId}`, { etag: c.etag });
    if (!r.notModified) {
      const players = await playersOf(r.json);
      const mine = players.find((f) => f.player.id === me.value.id);
      if (mine) absorb(mine.progress);
      const list: Partner[] = players.filter((f) => f.player.id !== me.value.id).map((f) => ({ name: f.player.name, player: f.player.id, prog: f.progress, fetched: Date.now() }));
      setPartners(list);
    }
    await saveConf({ ...gist.value!, etag: r.etag, lastPull: Date.now() });
    syncState.value = { busy: false, msg: `À jour (${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}).`, error: false };
  } catch (e) {
    syncState.value = { busy: false, msg: e instanceof Error ? e.message : 'Erreur de lecture.', error: true };
  }
}

let pushing: Promise<void> | null = null;
/** Écrit MON fichier dans le gist commun (création du gist au tout premier envoi du foyer). */
export function pushNow(keepalive = false): Promise<void> {
  return (pushing ??= doPush(keepalive).finally(() => (pushing = null)));
}
async function doPush(keepalive: boolean) {
  const c = gist.value;
  const p = active.value;
  if (!c || !p || !synced() || !navigator.onLine) return;
  pending = false;
  const body: GistFile = { app: 'coral-wiki', version: 2, player: me.value, partie: { id: p.id, name: p.name }, updated: Date.now(), progress: p.prog };
  // Seul mon fichier est envoyé : celui des autres joueurs n'est jamais réécrit
  const files = { [fileOfPlayer(me.value.id)]: { content: JSON.stringify(body) } };
  try {
    if (c.gistId) {
      await gh(c.token, `/gists/${c.gistId}`, { method: 'PATCH', body: JSON.stringify({ files }), keepalive });
      await saveConf({ ...gist.value!, lastPush: Date.now(), profileId: c.profileId ?? p.id });
    } else {
      const r = await gh(c.token, '/gists', { method: 'POST', body: JSON.stringify({ description: DESC, public: false, files }) });
      await saveConf({ ...gist.value!, gistId: r.json.id, lastPush: Date.now(), profileId: p.id });
    }
  } catch (e) {
    pending = true;
    syncState.value = { busy: false, msg: !navigator.onLine ? 'Hors ligne : envoi reporté.' : e instanceof Error ? e.message : 'Erreur d’envoi.', error: true };
  }
}

/** Synchronisation complète, à la demande : lecture puis écriture. */
export async function syncNow() {
  syncState.value = { busy: true, msg: 'Synchronisation…', error: false };
  await flush();
  await pullNow();
  await pushNow();
  if (!syncState.value.error) syncState.value = { busy: false, msg: `Synchronisé à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.`, error: false };
}

// Envoi groupé : 5 s après la dernière coche locale ; tout de suite si l'app passe en arrière-plan.
let pending = false;
let timer = 0;
effect(() => {
  if (!localChange.value || !gist.value?.auto) return;
  pending = true;
  clearTimeout(timer);
  timer = window.setTimeout(() => pushNow().catch(() => {}), 5000);
});
addEventListener('visibilitychange', () => {
  const c = gist.value;
  if (!c?.auto) return;
  if (document.visibilityState === 'hidden' && pending) {
    clearTimeout(timer);
    pushNow(true).catch(() => {});
  } else if (document.visibilityState === 'visible' && Date.now() - (c.lastPull ?? 0) > 20_000) pullNow().catch(() => {});
});
