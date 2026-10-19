// Sauvegarde et progression commune.
// - Export / import d'un fichier JSON (v2 ; les fichiers v1 sont migrés à la lecture).
// - Synchro à deux par GitHub Gist, sans serveur : chaque joueur écrit dans SON gist secret (progress.json),
//   lit celui du partenaire et fusionne clé par clé (la marque la plus récente gagne, voir progress.ts).
//   Envoi groupé 5 s après la dernière coche et au passage en arrière-plan ; lecture au démarrage et au retour
//   au premier plan, avec ETag (réponse 304 sans quota). Le jeton (classic, scope gist) reste sur l'appareil.
import { effect, signal } from '@preact/signals';
import { absorb, active, flush, getMeta, importProfiles, localChange, me, profiles, setMeta, setPartner, type Profile } from './store.ts';
import { effective, onKeys, type Progress } from './progress.ts';

const FILE = 'progress.json';
const API = 'https://api.github.com';
const DESC = 'Coral Wiki — progression (synchro à deux)';

export type Backup = { app: 'coral-wiki'; version: 2; exported_at: string; player: { id: string; name: string }; profiles: Profile[] };
export type GistFile = { app: 'coral-wiki'; version: 2; player: { id: string; name: string }; partie: { id: string; name: string }; updated: number; progress: Progress };

export function backup(): Backup {
  // `checks` (clé → horodatage) en plus des marques : un fichier v2 reste importable par la v1 (retour arrière)
  const list = profiles.value.map((p) => ({ ...p, checks: onKeys(effective(p.prog, p.partner?.prog)) }));
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

// ---------- Gist ----------

export type GistConf = {
  token: string;
  login?: string;
  gistId?: string; // mon gist
  etag?: string; // dernier ETag de mon gist
  partnerGistId?: string;
  profileId?: string; // partie synchronisée
  lastPush?: number;
  lastPull?: number;
  auto?: boolean;
};
export const gist = signal<GistConf | null>(null);
export const syncState = signal<{ busy: boolean; msg: string; error: boolean }>({ busy: false, msg: '', error: false });

export async function loadGistConf() {
  gist.value = (await getMeta<GistConf>('gist2')) ?? null;
  if (gist.value && navigator.onLine) pullNow().catch(() => {});
}

async function saveConf(c: GistConf | null) {
  gist.value = c;
  await setMeta('gist2', c ?? undefined);
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

/** « https://gist.github.com/login/abc123 », « abc123 » → identifiant du gist. */
export function gistIdFrom(input: string): string | null {
  const m = /([0-9a-f]{20,40})\/?(?:#.*)?$/i.exec(input.trim());
  return m ? m[1].toLowerCase() : null;
}

/** Lien à envoyer au partenaire. */
export const shareLink = () => (gist.value?.gistId ? `https://gist.github.com/${gist.value.login ?? ''}${gist.value.login ? '/' : ''}${gist.value.gistId}` : '');

async function fileOf(json: any): Promise<GistFile | null> {
  const f = json?.files?.[FILE];
  if (!f) return null;
  const text = f.truncated ? await (await fetch(f.raw_url, { cache: 'no-store' })).text() : f.content;
  try {
    const j = JSON.parse(text);
    return j?.app === 'coral-wiki' && j.version === 2 && j.progress ? (j as GistFile) : null;
  } catch {
    return null;
  }
}

/** Vérifie le jeton (classic + scope gist), retrouve ou crée mon gist. */
export async function connect(token: string, auto = true) {
  token = token.trim();
  if (token.startsWith('github_pat_')) throw new Error(FINE);
  if (!/^(ghp_|gho_)?[A-Za-z0-9_]{20,}$/.test(token)) throw new Error('Format de jeton inattendu.');
  const { json, scopes } = await gh(token, '/user');
  if (scopes === null) throw new Error(FINE);
  if (!scopes.split(/,\s*/).includes('gist')) throw new Error('Ce jeton n’a pas le scope « gist ».');
  const c: GistConf = { token, login: json.login, auto, profileId: active.value?.id };
  // Mon gist existe peut-être déjà (autre appareil, réinstallation) : on le retrouve par son fichier
  for (let page = 1; page <= 5 && !c.gistId; page++) {
    const list = (await gh(token, `/gists?per_page=100&page=${page}`)).json as any[];
    c.gistId = list.find((g) => g.files?.[FILE] && String(g.description ?? '').startsWith('Coral Wiki'))?.id;
    if (list.length < 100) break;
  }
  await saveConf(c);
  await syncNow();
}

export async function disconnect() {
  await saveConf(null);
  syncState.value = { busy: false, msg: 'Synchronisation désactivée. Votre gist reste sur votre compte GitHub.', error: false };
}

export async function setAuto(auto: boolean) {
  if (gist.value) await saveConf({ ...gist.value, auto });
}

/** Appairage : identifiant ou lien du gist du partenaire. Vérifie qu'il s'agit bien d'une progression Coral Wiki. */
export async function pair(input: string) {
  const c = gist.value;
  if (!c) throw new Error('Connectez d’abord votre compte GitHub.');
  const id = gistIdFrom(input);
  if (!id) throw new Error('Collez l’identifiant ou le lien du gist de votre partenaire.');
  if (id === c.gistId) throw new Error('C’est votre propre gist : collez celui de votre partenaire.');
  const { json, etag } = await gh(c.token, `/gists/${id}`);
  const f = await fileOf(json);
  if (!f) throw new Error('Ce gist ne contient pas de progression Coral Wiki.');
  await saveConf({ ...c, partnerGistId: id });
  setPartner({ name: f.player.name, player: f.player.id, gistId: id, prog: f.progress, etag, fetched: Date.now() });
  syncState.value = { busy: false, msg: `Appairé avec ${f.player.name}.`, error: false };
}

export async function unpair() {
  if (gist.value) await saveConf({ ...gist.value, partnerGistId: undefined });
  setPartner(undefined);
}

const synced = () => {
  const c = gist.value;
  return !!c && !!active.value && (!c.profileId || c.profileId === active.value.id);
};

let pulling: Promise<void> | null = null;
/** Lit mon gist (autres appareils) et celui du partenaire, avec ETag. */
export function pullNow(): Promise<void> {
  return (pulling ??= doPull().finally(() => (pulling = null)));
}
async function doPull() {
  const c = gist.value;
  if (!c || !synced() || !navigator.onLine) return;
  try {
    let etag = c.etag;
    if (c.gistId) {
      const r = await gh(c.token, `/gists/${c.gistId}`, { etag: c.etag });
      if (!r.notModified) {
        const f = await fileOf(r.json);
        if (f) absorb(f.progress);
        etag = r.etag;
      }
    }
    const p = active.value;
    if (c.partnerGistId && p) {
      const r = await gh(c.token, `/gists/${c.partnerGistId}`, { etag: p.partner?.gistId === c.partnerGistId ? p.partner?.etag : undefined });
      if (!r.notModified) {
        const f = await fileOf(r.json);
        if (f) setPartner({ name: f.player.name, player: f.player.id, gistId: c.partnerGistId, prog: f.progress, etag: r.etag, fetched: Date.now() });
      }
    }
    await saveConf({ ...gist.value!, etag, lastPull: Date.now() });
    syncState.value = { busy: false, msg: `À jour (${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}).`, error: false };
  } catch (e) {
    syncState.value = { busy: false, msg: e instanceof Error ? e.message : 'Erreur de lecture.', error: true };
  }
}

let pushing: Promise<void> | null = null;
/** Écrit mes marques dans mon gist (création au premier envoi). */
export function pushNow(keepalive = false): Promise<void> {
  return (pushing ??= doPush(keepalive).finally(() => (pushing = null)));
}
async function doPush(keepalive: boolean) {
  const c = gist.value;
  const p = active.value;
  if (!c || !p || !synced() || !navigator.onLine) return;
  pending = false;
  const body: GistFile = { app: 'coral-wiki', version: 2, player: me.value, partie: { id: p.id, name: p.name }, updated: Date.now(), progress: p.prog };
  const files = { [FILE]: { content: JSON.stringify(body) } };
  try {
    if (c.gistId) {
      const r = await gh(c.token, `/gists/${c.gistId}`, { method: 'PATCH', body: JSON.stringify({ files }), keepalive });
      await saveConf({ ...gist.value!, etag: r.etag, lastPush: Date.now(), profileId: c.profileId ?? p.id });
    } else {
      const r = await gh(c.token, '/gists', { method: 'POST', body: JSON.stringify({ description: DESC, public: false, files }) });
      await saveConf({ ...gist.value!, gistId: r.json.id, etag: r.etag, lastPush: Date.now(), profileId: p.id });
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
