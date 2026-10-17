// Mémoire de traduction EN → FR (non officielle), clé = empreinte du texte EN.
// scripts/i18n/fr/<lot>.json : { "<hash>": "texte FR" }. Un texte modifié sur le wiki change de hash → retraduit.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const I18N_DIR = import.meta.dirname;

export function h(en: string): string {
  return createHash('sha1').update(en.trim()).digest('hex').slice(0, 10);
}

export class TM {
  map = new Map<string, string>();
  missing = new Map<string, Map<string, string>>(); // lot → hash → EN
  hits = 0;
  /** Clés marquées « = » : texte identique en FR (noms propres). */
  same = new Set<string>();

  constructor() {
    const dir = join(I18N_DIR, 'fr');
    if (!existsSync(dir)) return;
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      const obj: Record<string, string> = JSON.parse(readFileSync(join(dir, f), 'utf8'));
      for (const [k, v] of Object.entries(obj)) if (v) this.map.set(k, v);
      this.same = new Set([...this.same, ...Object.entries(obj).filter(([, v]) => v === '=').map(([k]) => k)]);
    }
  }

  /** Traduction FR ou null ; consigne le texte manquant dans le lot indiqué. */
  get(en: string | undefined | null, lot: string): string | null {
    if (!en || !en.trim()) return null;
    if (!/[A-Za-z]{2}/.test(en)) return en.trim(); // nombres, symboles
    const k = h(en);
    const fr = this.map.get(k);
    if (fr === '=') return en.trim();
    if (fr) {
      this.hits++;
      return fr;
    }
    (this.missing.get(lot) ?? this.missing.set(lot, new Map()).get(lot)!).set(k, en.trim());
    return null;
  }

  /** Traduit ou renvoie l'original. */
  t(en: string, lot: string): string {
    return this.get(en, lot) ?? en;
  }
}
