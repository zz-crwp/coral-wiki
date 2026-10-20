// Tests de la progression v2 : fusion (ordre d'arrivée indifférent) et migration v1 → v2 sans perte.
// node --test scripts/qa/progress.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { effective, mark, merge, migrateChecks, normalizeProfile, onKeys, type Progress } from '../../src/app/progress.ts';

const A = 'jA', B = 'jB';
// Générateur pseudo-aléatoire reproductible
function rng(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
}
function randomProgress(r: () => number, par: string, n: number): Progress {
  const p: Progress = {};
  for (let i = 0; i < n; i++) p[`musee:item${Math.floor(r() * 40)}`] = { s: r() < 0.7 ? 1 : 0, t: 1_700_000_000_000 + Math.floor(r() * 50), par };
  return p;
}
const permutations = <T,>(xs: T[]): T[][] => (xs.length <= 1 ? [xs] : xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p])));

test('fusion : même résultat quel que soit l’ordre d’arrivée (300 cas aléatoires, 3 sources)', () => {
  const r = rng(42);
  for (let k = 0; k < 300; k++) {
    const srcs = [randomProgress(r, A, 25), randomProgress(r, B, 25), randomProgress(r, A, 10)];
    const ref = merge(...srcs);
    for (const order of permutations(srcs)) assert.deepEqual(merge(...order), ref);
    // Fusion incrémentale (arrivées successives) = fusion d'un bloc
    assert.deepEqual(merge(merge(srcs[2], srcs[0]), srcs[1]), ref);
  }
});

test('fusion : idempotente', () => {
  const r = rng(7);
  const a = randomProgress(r, A, 30), b = randomProgress(r, B, 30);
  const m = merge(a, b);
  assert.deepEqual(merge(m, m), m);
  assert.deepEqual(merge(m, a, b), m);
});

test('fusion : la marque la plus récente gagne, décocher compris', () => {
  const a: Progress = { 'musee:tuna': { s: 1, t: 100, par: A } };
  const b: Progress = { 'musee:tuna': { s: 0, t: 200, par: B } };
  assert.equal(merge(a, b)['musee:tuna'].s, 0);
  assert.equal(merge(b, a)['musee:tuna'].s, 0);
  const c: Progress = { 'musee:tuna': { s: 1, t: 300, par: A } };
  assert.equal(merge(a, b, c)['musee:tuna'].s, 1);
});

test('fusion : égalité d’horodatage tranchée de façon stable', () => {
  const a: Progress = { k: { s: 1, t: 5, par: A } };
  const b: Progress = { k: { s: 0, t: 5, par: B } };
  assert.deepEqual(merge(a, b), merge(b, a));
});

test('fusion : marques invalides ignorées', () => {
  const bad = { k: { s: 2, t: 'x', par: 1 } } as unknown as Progress;
  assert.deepEqual(merge({ k: { s: 1, t: 1, par: A } }, bad), { k: { s: 1, t: 1, par: A } });
});

test('effective : seules les clés communes du partenaire comptent', () => {
  const mine: Progress = { 'cadeau:scott:w1:1': { s: 1, t: 1, par: A } };
  const partner: Progress = { 'musee:tuna': { s: 1, t: 2, par: B }, 'cadeau:scott:w1:2': { s: 1, t: 3, par: B }, 'temple:o:x': { s: 1, t: 4, par: B }, 'pris:tuna': { s: 1, t: 5, par: B } };
  const on = onKeys(effective(mine, partner));
  assert.deepEqual(Object.keys(on).sort(), ['cadeau:scott:w1:1', 'musee:tuna', 'pris:tuna', 'temple:o:x']);
});

test('effective : plusieurs autres joueurs (compte commun), commun seulement', () => {
  const mine: Progress = {};
  const b: Progress = { 'musee:tuna': { s: 1, t: 2, par: B }, 'succes:x': { s: 1, t: 2, par: B } };
  const c: Progress = { 'musee:tuna': { s: 0, t: 3, par: 'jC' }, 'temple:o:y': { s: 1, t: 1, par: 'jC' } };
  assert.deepEqual(Object.keys(onKeys(effective(mine, [b, c]))), ['temple:o:y']);
  assert.deepEqual(effective(mine, [b, c]), effective(mine, [c, b]));
});

test('mark : une annulation gagne toujours contre la marque qu’elle annule', () => {
  const m1 = mark(undefined, true, A, 1000);
  const m2 = mark(m1, false, A, 1000); // même milliseconde
  assert.ok(m2.t > m1.t);
  assert.equal(merge({ k: m1 }, { k: m2 }).k.s, 0);
});

test('migration v1 → v2 : aucune coche perdue, horodatages conservés', () => {
  const r = rng(3);
  const checks: Record<string, number> = {};
  for (let i = 0; i < 500; i++) checks[`k${i}`] = 1_600_000_000_000 + Math.floor(r() * 1e9);
  checks['ancien-format'] = 1 as number; // valeur non horodatée
  const v1 = { id: 'p1', name: 'Ma ferme', created: 10, updated: 20, date: { season: 'spring', day: 3, year: 1 }, weather: 'rain', hour: 9, checks, favs: ['tuna'] };
  const v2 = normalizeProfile(v1, A);
  assert.equal(v2.checks, undefined);
  assert.deepEqual(Object.keys(v2.prog).sort(), Object.keys(checks).sort());
  for (const [k, t] of Object.entries(checks)) {
    assert.equal(v2.prog[k].s, 1);
    assert.equal(v2.prog[k].par, A);
    assert.equal(v2.prog[k].t, t > 1 ? t : 1);
  }
  assert.deepEqual(v2.session, ['tuna']);
  assert.equal(v2.weather, 'rain');
  // Rejouer la migration ne change rien
  assert.deepEqual(normalizeProfile(v2, A), v2);
});

test('migration : coches à zéro ou absentes ignorées', () => {
  assert.deepEqual(migrateChecks({ a: 0, b: undefined as unknown as number }, A, 1), {});
  assert.deepEqual(migrateChecks(undefined, A, 1), {});
});
