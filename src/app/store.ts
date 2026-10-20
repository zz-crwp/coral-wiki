// Progression du joueur : un document par profil (partie), stocké dans IndexedDB.
// Signals réactifs en mémoire, écriture différée (300 ms) pour ne pas bloquer l'interface.
// v2 : chaque coche est une marque { état, horodatage, auteur } (voir progress.ts) ; la progression
// du partenaire (synchro à deux) est gardée à part et fusionnée pour les clés communes.
import { signal, computed } from '@preact/signals';
import { openDB, type IDBPDatabase } from 'idb';
import type { Season } from './data.ts';
import { effective, mark, merge, onKeys, type Progress } from './progress.ts';

export type GameDate = { season: Season; day: number; year: number };
export type Profile = {
  id: string;
  name: string;
  created: number;
  updated: number;
  date: GameDate;
  weather: string; // sunny | rain | storm | snow | windy | blizzard
  hour: number; // ancien réglage de l'heure de jeu (≤ 2.0), conservé pour la compatibilité des sauvegardes, plus utilisé
  prog: Progress; // clé de suivi → marque { s, t, par }
  checks?: Record<string, number>; // v1 (clé → horodatage) : lu seulement pour migrer
  partners?: Partner[]; // progression des autres joueurs du compte commun (lue dans le gist)
  favs: string[]; // ancienne liste de favoris (migrée vers `session`)
  session?: string[]; // « Ma session » : fiches épinglées pour la journée de jeu
  paliers?: Record<string, number>; // palier possédé par outil : 0 = de base … 4 = osmium
  coeurs?: Record<string, number>; // niveau de cœurs avec chaque habitant (0–10, ou 15 marié)
};

export type Partner = { name: string; player: string; prog: Progress; fetched?: number };
export type Player = { id: string; name: string };

const DB_NAME = 'coral-wiki';
const DB_VERSION = 2;
let db: IDBPDatabase | null = null;

export const profiles = signal<Profile[]>([]);
export const activeId = signal<string>('');
export const active = computed(() => profiles.value.find((p) => p.id === activeId.value) ?? profiles.value[0]);
export const storageOk = signal(true);
export const ready = signal(false);
/** Joueur de cet appareil (auteur des coches). */
export const me = signal<Player>({ id: 'moi', name: 'Moi' });
/** Coches effectives du profil actif (les miennes + les communes du partenaire) : clé → horodatage. */
export const checks = computed(() => onKeys(marks.value));
/** Marques effectives (auteur compris) du profil actif. */
const others = (p: Profile | undefined) => (p?.partners ?? []).map((x) => x.prog);
export const marks = computed(() => effective(active.value?.prog ?? {}, others(active.value)));
/** Auteur d'une coche quand ce n'est pas moi (prénom du partenaire), sinon rien. */
export function byPartner(key: string): string | null {
  const m = marks.value[key];
  if (!m || m.s !== 1 || m.par === me.value.id) return null;
  return active.value?.partners?.find((x) => x.player === m.par)?.name ?? null;
}
/** Appelé après chaque coche locale (la synchro programme l'envoi groupé). */
export const localChange = signal(0);
const newId = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export { normalizeProfile as normalize } from './progress.ts';
import { normalizeProfile as normalize } from './progress.ts';

function newProfile(name: string): Profile {
  const now = Date.now();
  return { id: newId('p'), name, created: now, updated: now, date: { season: 'spring', day: 1, year: 1 }, weather: 'sunny', hour: 9, prog: {}, favs: [], session: [], paliers: {}, coeurs: {} };
}

export async function initStore() {
  try {
    db = await openDB(DB_NAME, DB_VERSION, {
      async upgrade(d, oldVersion, _v, tx) {
        if (oldVersion < 1) {
          d.createObjectStore('profiles', { keyPath: 'id' });
          d.createObjectStore('meta');
        }
        if (oldVersion < 2) {
          d.createObjectStore('sauvegardes', { keyPath: 'id' });
          // v1 → v2 : sauvegarde intégrale avant toute conversion, puis migration des coches
          const old = (await tx.objectStore('profiles').getAll()) as any[];
          let player = (await tx.objectStore('meta').get('player')) as Player | undefined;
          if (!player) {
            player = { id: newId('j'), name: 'Moi' };
            await tx.objectStore('meta').put(player, 'player');
          }
          if (old.length) {
            await tx.objectStore('sauvegardes').put({ id: `v1-${Date.now()}`, at: Date.now(), version: 1, raison: 'Avant la mise à jour v2', profiles: old });
            for (const p of old) await tx.objectStore('profiles').put(normalize(p, player.id));
          }
        }
      },
    });
    let player = (await db.get('meta', 'player')) as Player | undefined;
    if (!player) {
      player = { id: newId('j'), name: 'Moi' };
      await db.put('meta', player, 'player');
    }
    me.value = player;
    let list = ((await db.getAll('profiles')) as any[]).map((p) => normalize(p, player!.id));
    if (!list.length) {
      const p = newProfile('Ma ferme');
      await db.put('profiles', p);
      list = [p];
    }
    profiles.value = list.sort((a, b) => a.created - b.created);
    activeId.value = ((await db.get('meta', 'active')) as string) ?? list[0].id;
  } catch {
    // Navigation privée stricte, IndexedDB indisponible : progression en mémoire seulement.
    storageOk.value = false;
    const p = newProfile('Ma ferme');
    profiles.value = [p];
    activeId.value = p.id;
  }
  ready.value = true;
}

const timers = new Map<string, number>();
function persist(p: Profile) {
  if (!db) return;
  clearTimeout(timers.get(p.id));
  timers.set(
    p.id,
    window.setTimeout(() => {
      timers.delete(p.id);
      db!.put('profiles', p).catch(() => (storageOk.value = false));
    }, 300),
  );
}
// Écrit immédiatement ce qui est en attente si l'onglet se ferme ou passe en arrière-plan.
addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flush();
});
addEventListener('pagehide', () => flush());

function update(fn: (p: Profile) => Profile) {
  const cur = active.value;
  if (!cur) return;
  const next = { ...fn(cur), updated: Date.now() };
  profiles.value = profiles.value.map((p) => (p.id === cur.id ? next : p));
  persist(next);
}

export const isChecked = (key: string) => !!checks.value[key];

export function setCheck(key: string, on: boolean) {
  setChecks([key], on);
}
export const toggle = (key: string) => setCheck(key, !isChecked(key));

export function setChecks(keys: string[], on: boolean) {
  if (!keys.length) return;
  update((p) => {
    const prog = { ...p.prog };
    const eff = effective(p.prog, others(p));
    const now = Date.now();
    for (const k of keys) prog[k] = mark(eff[k] ?? prog[k], on, me.value.id, now);
    return { ...p, prog };
  });
  flush(); // une coche est écrite tout de suite : fermer l'app juste après ne la perd pas
  localChange.value++;
}
/** Remplace la progression des autres joueurs (lue dans le gist commun) sur le profil actif. */
export function setPartners(partners: Partner[]) {
  update((p) => ({ ...p, partners }));
  flush(); // écrit tout de suite : une relecture réseau ne doit pas être perdue si l'app se ferme
}
/** Intègre des marques reçues (mon propre Gist relu depuis un autre appareil). */
export function absorb(prog: Progress) {
  update((p) => ({ ...p, prog: merge(p.prog, prog) }));
  flush();
}
export async function setPlayerName(name: string) {
  me.value = { ...me.value, name: name.trim() || 'Moi' };
  await db?.put('meta', me.value, 'player');
}

export const setDate = (date: GameDate) => update((p) => ({ ...p, date }));
export const setWeather = (weather: string) => update((p) => ({ ...p, weather }));


// --- Ma session : fiches épinglées ---
export const pinned = (id: string) => !!active.value?.session?.includes(id);
export function togglePin(id: string) {
  update((p) => {
    const s = p.session ?? [];
    return { ...p, session: s.includes(id) ? s.filter((x) => x !== id) : [...s, id] };
  });
}

// --- Paliers d'outils et cœurs ---
export const palier = (tool: string) => active.value?.paliers?.[tool] ?? 0;
export function setPalier(tool: string, n: number) {
  update((p) => ({ ...p, paliers: { ...(p.paliers ?? {}), [tool]: n } }));
}
export const coeurs = (npc: string) => active.value?.coeurs?.[npc] ?? 0;
export function setCoeurs(npc: string, n: number) {
  update((p) => ({ ...p, coeurs: { ...(p.coeurs ?? {}), [npc]: n } }));
}

// --- Gestion des profils (interface au jalon 5) ---
export async function createProfile(name: string) {
  const p = newProfile(name);
  profiles.value = [...profiles.value, p];
  await db?.put('profiles', p);
  await switchProfile(p.id);
  return p;
}
export async function switchProfile(id: string) {
  activeId.value = id;
  await db?.put('meta', id, 'active');
}
export async function renameProfile(id: string, name: string) {
  profiles.value = profiles.value.map((p) => (p.id === id ? { ...p, name } : p));
  const p = profiles.value.find((x) => x.id === id);
  if (p) await db?.put('profiles', p);
}
export async function deleteProfile(id: string) {
  if (profiles.value.length <= 1) return;
  profiles.value = profiles.value.filter((p) => p.id !== id);
  await db?.delete('profiles', id);
  if (activeId.value === id) await switchProfile(profiles.value[0].id);
}
/** Profil importé valide (structure minimale), complété des champs absents. */
function sane(p: any): Profile | null {
  if (!p || typeof p.id !== 'string' || (typeof p.checks !== 'object' && typeof p.prog !== 'object') || !p.date?.season) return null;
  return normalize({ name: 'Partie', created: Date.now(), updated: 0, ...p }, me.value.id);
}

/**
 * Fusion : pour chaque profil présent des deux côtés, la version modifiée le plus récemment gagne ;
 * les profils absents d'un côté sont ajoutés. `replace` remplace tout.
 */
export function mergeProfiles(local: Profile[], incoming: Profile[]): Profile[] {
  // Un profil jamais utilisé (créé par défaut au premier lancement) s'efface devant les profils importés.
  const pristine = (p: Profile) => !Object.keys(p.prog).length && !p.favs.length && p.updated === p.created;
  const out = new Map(local.filter((p) => !incoming.length || incoming.some((i) => i.id === p.id) || !pristine(p)).map((p) => [p.id, p]));
  for (const p of incoming) {
    const cur = out.get(p.id);
    // Réglages : la version la plus récente ; coches : fusion marque par marque (aucune perdue)
    if (!cur) out.set(p.id, p);
    else out.set(p.id, { ...((p.updated ?? 0) > (cur.updated ?? 0) ? p : cur), prog: merge(cur.prog, p.prog) });
  }
  return [...out.values()].sort((a, b) => a.created - b.created);
}

export async function importProfiles(list: unknown[], replace = false) {
  const clean = list.map(sane).filter((p): p is Profile => !!p);
  if (!clean.length) throw new Error('Aucun profil valide dans ce fichier.');
  profiles.value = replace ? clean : mergeProfiles(profiles.value, clean);
  if (db) {
    const tx = db.transaction('profiles', 'readwrite');
    if (replace) await tx.store.clear();
    for (const p of clean) await tx.store.put(p);
    await tx.done;
  }
  if (!profiles.value.some((p) => p.id === activeId.value)) await switchProfile(profiles.value[0].id);
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  try {
    return (await db?.get('meta', key)) as T | undefined;
  } catch {
    return undefined;
  }
}
export async function setMeta(key: string, value: unknown) {
  if (value === undefined) await db?.delete('meta', key);
  else await db?.put('meta', value, key);
}
/** Écrit immédiatement les profils en attente (avant export ou synchronisation). */
export async function flush() {
  if (!db) return;
  for (const [id, t] of timers) {
    clearTimeout(t);
    const p = profiles.value.find((x) => x.id === id);
    if (p) await db.put('profiles', p);
  }
  timers.clear();
}

/** Jour de la semaine en jeu : chaque saison de 28 jours commence un lundi (0 = lundi). */
export const weekday = (day: number) => (day - 1) % 7;
export const WEEKDAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

/** Sauvegardes automatiques (avant migration) : liste et contenu. */
export async function listBackups(): Promise<{ id: string; at: number; raison: string; profiles: unknown[] }[]> {
  try {
    return ((await db?.getAll('sauvegardes')) ?? []) as any[];
  } catch {
    return [];
  }
}

/** Coche ou décoche, avec un toast « Annuler » (aucune boîte de confirmation). */
export function toggleWithUndo(key: string, label: string, notify: (msg: string, undo: () => void) => void) {
  const was = isChecked(key);
  setCheck(key, !was);
  notify(was ? `${label} : décoché` : `${label} : coché`, () => setCheck(key, was));
}
