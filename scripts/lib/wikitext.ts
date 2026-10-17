// Parseur wikitext minimal mais robuste : templates imbriqués, liens, balises opaques.

export type Template = {
  name: string; // nom normalisé (« Infobox crop »)
  params: Record<string, string>; // nommés + positionnels ("1", "2", …), valeurs brutes
  start: number;
  end: number;
};

const OPAQUE_TAGS = ['gallery', 'ref', 'nowiki', 'pre', 'tabber', 'math', 'syntaxhighlight', 'source', 'includeonly', 'noinclude'];

/** Position de fin d'une balise opaque commençant en i (ou -1). */
function skipOpaque(s: string, i: number): number {
  if (s[i] !== '<') return -1;
  if (s.startsWith('<!--', i)) {
    const e = s.indexOf('-->', i + 4);
    return e < 0 ? s.length : e + 3;
  }
  const m = /^<([a-z]+)\b[^>]*?(\/?)>/i.exec(s.slice(i, i + 200));
  if (!m) return -1;
  const tag = m[1].toLowerCase();
  if (!OPAQUE_TAGS.includes(tag)) return -1;
  if (m[2] === '/') return i + m[0].length;
  const close = s.toLowerCase().indexOf(`</${tag}>`, i + m[0].length);
  return close < 0 ? s.length : close + tag.length + 3;
}

export function normName(n: string): string {
  const t = n.replace(/<!--[\s\S]*?-->/g, '').replace(/_/g, ' ').trim().replace(/\s+/g, ' ').replace(/^Template:/i, '');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Parse un template dont `{{` est en `start`. Renvoie null si non fermé. */
export function parseTemplateAt(s: string, start: number): Template | null {
  let i = start + 2;
  let depthT = 0; // {{ }} imbriqués
  let depthL = 0; // [[ ]]
  const parts: string[] = [];
  let cur = '';
  while (i < s.length) {
    const op = skipOpaque(s, i);
    if (op > 0) {
      cur += s.slice(i, op);
      i = op;
      continue;
    }
    if (s.startsWith('{{{', i) && depthT >= 0) {
      // paramètre de template ({{{x}}}) : traité comme texte opaque
      const e = s.indexOf('}}}', i + 3);
      if (e > 0) {
        cur += s.slice(i, e + 3);
        i = e + 3;
        continue;
      }
    }
    if (s.startsWith('{{', i)) {
      depthT++;
      cur += '{{';
      i += 2;
      continue;
    }
    if (s.startsWith('}}', i)) {
      if (depthT === 0) {
        parts.push(cur);
        return build(parts, start, i + 2);
      }
      depthT--;
      cur += '}}';
      i += 2;
      continue;
    }
    if (s.startsWith('[[', i)) {
      depthL++;
      cur += '[[';
      i += 2;
      continue;
    }
    if (s.startsWith(']]', i) && depthL > 0) {
      depthL--;
      cur += ']]';
      i += 2;
      continue;
    }
    if (s[i] === '|' && depthT === 0 && depthL === 0) {
      parts.push(cur);
      cur = '';
      i++;
      continue;
    }
    cur += s[i];
    i++;
  }
  return null;
}

function build(parts: string[], start: number, end: number): Template {
  const name = normName(parts[0].split(':').length > 1 && /^\s*#/.test(parts[0]) ? parts[0] : parts[0]);
  const params: Record<string, string> = {};
  let pos = 1;
  for (const p of parts.slice(1)) {
    const eq = indexOfTopLevelEq(p);
    if (eq >= 0) params[p.slice(0, eq).trim()] = p.slice(eq + 1).trim();
    else params[String(pos++)] = p.trim();
  }
  return { name, params, start, end };
}

function indexOfTopLevelEq(p: string): number {
  let dT = 0;
  let dL = 0;
  for (let i = 0; i < p.length; i++) {
    if (p.startsWith('{{', i)) (dT++, i++);
    else if (p.startsWith('}}', i)) (dT--, i++);
    else if (p.startsWith('[[', i)) (dL++, i++);
    else if (p.startsWith(']]', i)) (dL--, i++);
    else if (p[i] === '<') {
      const op = skipOpaque(p, i);
      if (op > 0) i = op - 1;
    } else if (p[i] === '=' && dT === 0 && dL === 0) return i;
  }
  return -1;
}

/** Tous les templates de premier niveau (et, si `deep`, imbriqués) d'un texte. */
export function templates(s: string, deep = false): Template[] {
  const out: Template[] = [];
  let i = 0;
  while (i < s.length) {
    const op = skipOpaque(s, i);
    if (op > 0) {
      i = op;
      continue;
    }
    if (s.startsWith('{{', i) && !s.startsWith('{{{', i)) {
      const t = parseTemplateAt(s, i);
      if (t) {
        out.push(t);
        if (deep) for (const v of Object.values(t.params)) out.push(...templates(v, true));
        i = t.end;
        continue;
      }
    }
    i++;
  }
  return out;
}

export function findTemplate(s: string, name: string | RegExp): Template | undefined {
  return templates(s).find((t) => (typeof name === 'string' ? t.name.toLowerCase() === name.toLowerCase() : name.test(t.name)));
}

export function findTemplates(s: string, name: string | RegExp, deep = false): Template[] {
  return templates(s, deep).filter((t) => (typeof name === 'string' ? t.name.toLowerCase() === name.toLowerCase() : name.test(t.name)));
}

/** Liens internes [[Cible|Label]] → cibles (hors fichiers/catégories). */
export function links(s: string): string[] {
  const out: string[] = [];
  for (const m of s.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g)) {
    const t = m[1].trim();
    if (/^(file|image|category|fichier|catégorie):/i.test(t)) continue;
    out.push(normName(t));
  }
  return out;
}

/** Fichiers référencés ([[File:X]] et lignes de <gallery>). */
export function files(s: string): string[] {
  const out: string[] = [];
  for (const m of s.matchAll(/\[\[(?:File|Image):([^|\]]+)/gi)) out.push(normName(m[1]));
  for (const g of s.matchAll(/<gallery[^>]*>([\s\S]*?)<\/gallery>/gi))
    for (const line of g[1].split('\n')) {
      const f = line.split('|')[0].replace(/^(File|Image):/i, '').trim();
      if (/\.(png|gif|jpe?g|webp)$/i.test(f)) out.push(normName(f));
    }
  return out;
}

/**
 * Wikitext → texte brut lisible. `tpl` permet de rendre certains templates en ligne
 * (ex. {{CI}} → « Coral Island »), les autres sont supprimés.
 */
export function plain(s: string, tpl: (t: Template) => string | null = defaultInline): string {
  if (!s) return '';
  let out = '';
  let i = 0;
  while (i < s.length) {
    if (s.startsWith('<!--', i)) {
      const e = s.indexOf('-->', i);
      i = e < 0 ? s.length : e + 3;
      continue;
    }
    if (s.startsWith('<ref', i)) {
      const op = skipOpaque(s, i);
      if (op > 0) {
        i = op;
        continue;
      }
    }
    if (s.startsWith('<gallery', i)) {
      const op = skipOpaque(s, i);
      i = op > 0 ? op : i + 1;
      continue;
    }
    if (s.startsWith('{{', i) && !s.startsWith('{{{', i)) {
      const t = parseTemplateAt(s, i);
      if (t) {
        out += tpl(t) ?? '';
        i = t.end;
        continue;
      }
    }
    out += s[i++];
  }
  return out
    .replace(/\[\[(?:File|Image|Category):[^\]]*\]\]/gi, '')
    .replace(/\[\[([^\]|]+)\|([^\]]*)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, (_, a) => a.replace(/#.*/, ''))
    .replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, '$1')
    .replace(/'''?/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(span|div|small|big|center|sup|sub|u|s|i|b|font)[^>]*>/gi, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

export function defaultInline(t: Template): string | null {
  const n = t.name.toLowerCase();
  if (n === 'ci' || n === 'coral island') return 'Coral Island';
  if (/^(i|icon|item|il|link|ilink|item link|name|n)$/.test(n)) return t.params.text ?? t.params['2'] ?? t.params['1'] ?? '';
  if (n === 'gold' || n === 'coins' || n === 'price' || n === 'g') return `${t.params['1'] ?? ''} or`;
  if (n === 'season' || n === 's') return t.params['1'] ?? '';
  if (n === 'tooltip' || n === 'abbr') return t.params['1'] ?? '';
  return null;
}

/** Sections « ==Titre== » → { titre: contenu }. Niveau 2 uniquement, sous-sections incluses. */
export function sections(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /^==([^=].*?)==\s*$/gm;
  const heads = [...s.matchAll(re)];
  out[''] = s.slice(0, heads[0]?.index ?? s.length);
  heads.forEach((h, k) => {
    const end = heads[k + 1]?.index ?? s.length;
    out[h[1].trim()] = s.slice(h.index! + h[0].length, end);
  });
  return out;
}

/** Sous-sections de niveau 3. */
export function subsections(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  const heads = [...s.matchAll(/^===([^=].*?)===\s*$/gm)];
  out[''] = s.slice(0, heads[0]?.index ?? s.length);
  heads.forEach((h, k) => {
    const end = heads[k + 1]?.index ?? s.length;
    out[h[1].trim()] = s.slice(h.index! + h[0].length, end);
  });
  return out;
}

/** Tableaux wikitext {| … |} → lignes de cellules brutes. */
export function tables(s: string): string[][][] {
  const out: string[][][] = [];
  for (const m of s.matchAll(/^\{\|[\s\S]*?^\|\}/gm)) {
    const rows: string[][] = [];
    for (const r of m[0].split(/^\|-.*$/m).slice(1)) {
      const cells: string[] = [];
      for (const line of r.split('\n')) {
        const l = line.trim();
        if (!l || l === '|}' ) continue;
        if (l.startsWith('|') || l.startsWith('!')) {
          for (const c of l.slice(1).split(/\|\||!!/)) cells.push(stripCellAttr(c));
        } else if (cells.length) cells[cells.length - 1] += '\n' + l;
      }
      if (cells.length) rows.push(cells);
    }
    out.push(rows);
  }
  return out;
}

function stripCellAttr(c: string): string {
  // « style="…"|contenu » → contenu (attention aux liens [[a|b]])
  let dL = 0;
  let dT = 0;
  for (let i = 0; i < c.length; i++) {
    if (c.startsWith('[[', i)) dL++;
    else if (c.startsWith(']]', i)) dL--;
    else if (c.startsWith('{{', i)) dT++;
    else if (c.startsWith('}}', i)) dT--;
    else if (c[i] === '|' && dL === 0 && dT === 0 && /=/.test(c.slice(0, i))) return c.slice(i + 1).trim();
  }
  return c.trim();
}

/** Découpe une liste « A; B, C • D » en éléments. */
export function splitList(s: string): string[] {
  return s
    .split(/\s*(?:;|•|<br\s*\/?>|\n|,(?![^\[]*\]\]))\s*/i)
    .map((x) => x.trim())
    .filter(Boolean);
}
