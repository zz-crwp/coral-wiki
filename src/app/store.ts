// Progression du joueur : un document par profil (partie), stocké dans IndexedDB.
// Signals réactifs en mémoire, écriture différée (300 ms) pour ne pas bloquer l'interface.
import { signal, computed } from '@preact/signals';
import { openDB, type IDBPDatabase } from 'idb';
import type { Season } from './data.ts';

export type GameDate = { season: Season; day: number; year: number };
export type Profile = {
  id: string;
  name: string;
  created: number;
  updated: number;
  date: GameDate;
  weather: string; // sunny | rain | storm | snow | windy | blizzard
  hour: number; // heure en jeu affichée sur « Aujourd'hui » (6–26)
  checks: Record<string, number>; // clé de suivi → horodatage de la coche
  favs: string[]; // ancienne liste de favoris (migrée vers `session`)
  session?: string[]; // « Ma session » : fiches épinglées pour la journée de jeu
  paliers?: Record<string, number>; // palier possédé par outil : 0 = de base … 4 = osmium
  coeurs?: Record<string, number>; // niveau de cœurs avec chaque habitant (0–10, ou 15 marié)
};

const DB_NAME = 'coral-wiki';
let db: IDBPDatabase | null = null;

export const profiles = signal<Profile[]>([]);
export const activeId = signal<string>('');
export const active = computed(() => profiles.value.find((p) => p.id === activeId.value) ?? profiles.value[0]);
export const storageOk = signal(true);
export const ready = signal(false);

function newProfile(name: string): Profile {
  const now = Date.now();
  return { id: `p${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`, name, created: now, updated: now, date: { season: 'spring', day: 1, year: 1 }, weather: 'sunny', hour: 9, checks: {}, favs: [], session: [], paliers: {}, coeurs: {} };
}

export async function initStore() {
  try {
    db = await openDB(DB_NAME, 1, {
      upgrade(d) {
        d.createObjectStore('profiles', { keyPath: 'id' });
        d.createObjectStore('meta');
      },
    });
    let list = (await db.getAll('profiles')) as Profile[];
    if (!list.length) {
      const p = newProfile('Ma ferme');
      await db.put('profiles', p);
      list = [p];
    }
    // Migration : les favoris deviennent les épingles de la session
    for (const p of list) if (!p.session) p.session = [...(p.favs ?? [])];
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

function update(fn: (p: Profile) => Profile) {
  const cur = active.value;
  if (!cur) return;
  const next = { ...fn(cur), updated: Date.now() };
  profiles.value = profiles.value.map((p) => (p.id === cur.id ? next : p));
  persist(next);
}

export const isChecked = (key: string) => !!active.value?.checks[key];

export function setCheck(key: string, on: boolean) {
  update((p) => {
    const checks = { ...p.checks };
    if (on) checks[key] = Date.now();
    else delete checks[key];
    return { ...p, checks };
  });
}
export const toggle = (key: string) => setCheck(key, !isChecked(key));

export function setChecks(keys: string[], on: boolean) {
  update((p) => {
    const checks = { ...p.checks };
    for (const k of keys) on ? (checks[k] = Date.now()) : delete checks[k];
    return { ...p, checks };
  });
}

export const setDate = (date: GameDate) => update((p) => ({ ...p, date }));
export const setWeather = (weather: string) => update((p) => ({ ...p, weather }));
export const setHour = (hour: number) => update((p) => ({ ...p, hour }));

export function toggleFav(id: string) {
  togglePin(id);
}

// --- Ma session : fiches épinglées ---
export const pinned = (id: string) => !!active.value?.session?.includes(id);
export function togglePin(id: string) {
  update((p) => {
    const s = p.session ?? [];
    return { ...p, session: s.includes(id) ? s.filter((x) => x !== id) : [...s, id] };
  });
}
export function setSession(ids: string[]) {
  update((p) => ({ ...p, session: ids }));
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
  if (!p || typeof p.id !== 'string' || typeof p.checks !== 'object' || !p.date?.season) return null;
  return { name: 'Partie', created: Date.now(), updated: 0, weather: 'sunny', hour: 9, favs: [], ...p, checks: { ...p.checks } };
}

/**
 * Fusion : pour chaque profil présent des deux côtés, la version modifiée le plus récemment gagne ;
 * les profils absents d'un côté sont ajoutés. `replace` remplace tout.
 */
export function mergeProfiles(local: Profile[], incoming: Profile[]): Profile[] {
  // Un profil jamais utilisé (créé par défaut au premier lancement) s'efface devant les profils importés.
  const pristine = (p: Profile) => !Object.keys(p.checks).length && !p.favs.length && p.updated === p.created;
  const out = new Map(local.filter((p) => !incoming.length || incoming.some((i) => i.id === p.id) || !pristine(p)).map((p) => [p.id, p]));
  for (const p of incoming) {
    const cur = out.get(p.id);
    if (!cur || (p.updated ?? 0) > (cur.updated ?? 0)) out.set(p.id, p);
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

/** Coche ou décoche, avec un toast « Annuler » (aucune boîte de confirmation). */
export function toggleWithUndo(key: string, label: string, notify: (msg: string, undo: () => void) => void) {
  const was = isChecked(key);
  setCheck(key, !was);
  notify(was ? `${label} : décoché` : `${label} : coché`, () => setCheck(key, was));
}
