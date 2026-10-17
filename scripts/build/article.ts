// Wikitext → blocs légers rendus par l'app (titres, paragraphes, listes, tableaux).
// Les liens internes sont encodés « [[id|libellé]] », résolus vers les fiches.
import { parseTemplateAt, type Template } from '../lib/wikitext.ts';
import type { Ctx } from './ctx.ts';
import { clean } from './norm.ts';

export type Block =
  | { t: 'h'; l: number; x: string }
  | { t: 'p'; x: string }
  | { t: 'ul'; i: string[] }
  | { t: 'tb'; h: string[]; r: string[][]; c?: string };

/** Templates supprimés (données déjà structurées, navigation, méta). */
const DROP = /^(infobox.*|navbox.*|navboxtools|stub|character tabs|gifted item|gift prefs|shop availability|offering need|reward availability|chest availability|loot availability|gift availability|shop usage|artisan product by .*|cooked dishes by .*|recipes by .*|crafting recipes by .*|crops by .*|items by .*|scavengeables by .*|common .* uses desc|calendar crops|dialogue start|dialogue end|chat|quote|see group|main|see also|about|clr|reflist|cols|column|collapsible|upcoming|bugged|unsynced|removed|delete|transclude|display journal|heart events by character|hangout events by character|letter|heart event|hangout event|schedule|mainpage.*|limited availability|ks ref|cutscene|mail|#dpl:.*|map:.*|fullurl:.*|tabber|#.*)$/i;

export class ArticleRenderer {
  private ctx: Ctx;
  constructor(ctx: Ctx) {
    this.ctx = ctx;
  }

  link(target: string, label?: string): string {
    const t = target.replace(/^:/, '').trim();
    const txt = (label ?? t.replace(/#.*/, '')).trim();
    if (/^(file|image|category|fichier|catégorie):/i.test(t)) return '';
    const id = t.startsWith('#') ? null : this.ctx.ref(t, false);
    return id ? `[[${id}|${txt}]]` : txt;
  }

  inlineTpl(t: Template): string | null {
    const n = t.name.toLowerCase();
    const p = t.params;
    if (DROP.test(n)) return '';
    if (n === 'ci' || n === 'coral island') return 'Coral Island';
    if (n === 'pagename') return '';
    if (n === 'g' || n === 'gold' || n === 'coins') return p['1'] ? `${p['1']} or` : 'or';
    if (n === 'm' || n === 'money') return `${p['1'] ?? ''} or`;
    if (n === 'icon' || n === 'i' || n === 'item' || n === 'name' || n === 'npc' || n === 'skill') {
      const name = p['1'] ?? '';
      if (/^(true|1)$/.test(p.notext ?? '') || /\bskill$|\bmastery$|icon$/i.test(name)) return '';
      const qty = p['2'] && /^\d+$/.test(p['2']) ? ` ×${p['2']}` : '';
      return this.link(name, p.text ?? name) + qty;
    }
    if (n === 'icon list') return (p['1'] ?? '').split(/\s*;\s*/).filter(Boolean).map((x) => { const [a, q] = x.split('*'); return this.link(a, a) + (q ? ` ×${q}` : ''); }).join(', ');
    if (n === 'quest') return `« ${p['1'] ?? ''} »`;
    if (n === 'badge') return `succès « ${p['1'] ?? ''} »`;
    if (n === 'point') return `points ${p['1'] ?? ''}`;
    if (n === 'mastery') return `${this.link(p['1'] ?? '')} niv. ${p['2'] ?? ''}`.trim();
    if (n === 'time') return `${p['1'] ?? ''}h – ${p['2'] ?? ''}h`;
    if (n === 'q') return p['1'] ?? '';
    if (n === 'h' || n === 'heart' || n === 'heart2') return `${p['1'] ?? ''} cœur(s)`;
    if (n === 'tooltip' || n === 'abbr') return p['1'] ?? '';
    if (n === 'season' || n === 's') return p['1'] ?? '';
    return '';
  }

  /** Texte wikitext → ligne inline avec liens encodés. */
  inline(s: string): string {
    let out = '';
    let i = 0;
    while (i < s.length) {
      if (s.startsWith('<!--', i)) { const e = s.indexOf('-->', i); i = e < 0 ? s.length : e + 3; continue; }
      if (s.startsWith('{{', i) && !s.startsWith('{{{', i)) {
        const t = parseTemplateAt(s, i);
        if (t) { out += this.inlineTpl(t) ?? ''; i = t.end; continue; }
      }
      if (s.startsWith('[[', i)) {
        let depth = 0; let j = i;
        for (; j < s.length; j++) { if (s.startsWith('[[', j)) { depth++; j++; } else if (s.startsWith(']]', j)) { depth--; j++; if (depth === 0) break; } }
        const inner = s.slice(i + 2, j - 1);
        const bar = inner.indexOf('|');
        out += bar < 0 ? this.link(inner) : this.link(inner.slice(0, bar), clean(inner.slice(bar + 1)));
        i = j + 1;
        continue;
      }
      out += s[i++];
    }
    return out
      .replace(/<ref[^>]*\/>|<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
      .replace(/<br\s*\/?>/gi, ' · ')
      .replace(/<\/?[a-z][^>]*>/gi, '')
      .replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, '$1')
      .replace(/'''?/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/__[A-Z]+__/g, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/^\s*·\s*|\s*·\s*$/g, '')
      .trim();
  }

  /** Templates « tableau » rendus en bloc. */
  blockTpl(t: Template): Block[] | null {
    const n = t.name.toLowerCase();
    const p = t.params;
    const rows = Object.entries(p).filter(([k]) => /^\d+$/.test(k)).map(([, v]) => v.split(/\s*;\s*/));
    const cols = p.cols ? p.cols.split(/\s*;\s*/) : [];
    if (n === 'shop') return [{ t: 'tb', c: 'shop', h: ['Objet', 'Prix', ...cols], r: rows.map((r) => [this.link(r[0].replace(/\{.*?\}/g, '').trim()), `${clean(r[1])} ${p.currency && p.currency !== 'Coin' ? p.currency : 'or'}`, ...r.slice(2).map((x) => this.inline(x))]) }];
    if (n === 'reward') return [{ t: 'tb', h: ['Récompense', 'Condition', ...cols], r: rows.map((r) => [r[0] ? this.link(r[0].trim()) : '', this.inline(r[1] ?? ''), ...r.slice(2).map((x) => this.inline(x))]) }];
    if (n === 'loot' || n === 'chest') return [{ t: 'tb', h: ['Objet', 'Chance', ...cols], r: rows.map((r) => [this.link(r[0].trim()), clean(r[1]), ...r.slice(2).map((x) => this.inline(x))]) }];
    if (n === 'recipe') return [{ t: 'ul', i: (p.items ?? '').split(/\s*;\s*/).filter(Boolean).map((x) => { const [a, q] = x.split('*'); return `${this.link(a.trim())}${q ? ` ×${q.trim()}` : ''}`; }) }];
    if (n === 'mastery unlocks') return [{ t: 'tb', h: ['Niveau', 'Recettes débloquées'], r: Object.entries(p).filter(([k]) => /^l\d+$/.test(k)).map(([k, v]) => [k.slice(1), v.split(/\s*,\s*/).filter(Boolean).map((x) => this.link(x)).join(', ')]) }];
    if (n === 'offering') {
      const r: string[][] = [];
      for (let i = 1; p[`${i}_name`]; i++) r.push([clean(p[`${i}_name`]), (p[`${i}_items`] ?? '').split(/\s*;\s*/).filter(Boolean).map((x) => { const [a, q] = x.split('*'); return `${this.link(a.trim())}${q ? ` ×${q.split('/')[0]}` : ''}`; }).join(', '), (p[`${i}_reward`] ?? '').split(/\s*;\s*/).filter(Boolean).map((x) => { const [a, q] = x.split('*'); return `${this.link(a.trim())}${q ? ` ×${q}` : ''}`; }).join(', ')]);
      return [{ t: 'tb', c: 'offering', h: ['Offrande', 'Objets', 'Récompense'], r }];
    }
    return null;
  }

  render(content: string): Block[] {
    const blocks: Block[] = [];
    let s = content
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\{\{Dialogue start[\s\S]*?\{\{Dialogue end\}\}/gi, '')
      .replace(/<gallery[\s\S]*?<\/gallery>/gi, '')
      .replace(/<\/?(table-progress-tracking|tabber|div|center)[^>]*>/gi, '')
      .replace(/^\|-\|([^=\n]+)=\s*$/gm, '===$1===')
      .replace(/\[\[(?:File|Image|Category):[^\]]*\]\]/gi, (m) => (m.includes('[[') && m.split('[[').length > 2 ? '' : ''));
    let para: string[] = [];
    let ul: string[] = [];
    const flush = () => {
      if (para.length) { const x = this.inline(para.join(' ')); if (x) blocks.push({ t: 'p', x }); para = []; }
      if (ul.length) { blocks.push({ t: 'ul', i: ul }); ul = []; }
    };
    let i = 0;
    const lines: string[] = [];
    // Extraire les templates « bloc » et tableaux sur plusieurs lignes en jetons uniques
    const tokens: (Block[] | null)[] = [];
    let buf = '';
    while (i < s.length) {
      if (s.startsWith('{{', i) && !s.startsWith('{{{', i)) {
        const t = parseTemplateAt(s, i);
        if (t) {
          const b = this.blockTpl(t);
          if (b) { tokens.push(b); buf += `\n\u0000${tokens.length - 1}\u0000\n`; i = t.end; continue; }
          if (DROP.test(t.name) && !/^(icon|i|g|m|ci)$/i.test(t.name)) { i = t.end; continue; }
        }
      }
      if ((i === 0 || s[i - 1] === '\n') && s.startsWith('{|', i)) {
        const e = s.indexOf('\n|}', i);
        const end = e < 0 ? s.length : e + 3;
        tokens.push([this.table(s.slice(i, end))]);
        buf += `\n\u0000${tokens.length - 1}\u0000\n`;
        i = end;
        continue;
      }
      buf += s[i++];
    }
    lines.push(...buf.split('\n'));
    for (const raw of lines) {
      const line = raw.trimEnd();
      const tok = /^\u0000(\d+)\u0000$/.exec(line.trim());
      if (tok) { flush(); blocks.push(...(tokens[Number(tok[1])] ?? [])); continue; }
      const h = /^(={2,5})\s*(.+?)\s*\1\s*$/.exec(line);
      if (h) {
        flush();
        if (/^(navigation|gallery|galerie|references|trivia gallery)$/i.test(h[2].trim())) { blocks.push({ t: 'h', l: 0, x: '__STOP__' }); continue; }
        blocks.push({ t: 'h', l: h[1].length, x: this.inline(h[2]) });
        continue;
      }
      if (/^[*#]+/.test(line)) { if (para.length) { const x = this.inline(para.join(' ')); if (x) blocks.push({ t: 'p', x }); para = []; } const x = this.inline(line.replace(/^[*#]+\s*/, '')); if (x) ul.push(`${'  '.repeat(Math.max(0, /^[*#]+/.exec(line)![0].length - 1))}${x}`); continue; }
      if (/^[;:]/.test(line)) { flush(); const x = this.inline(line.replace(/^[;:]+\s*/, '')); if (x) blocks.push({ t: 'p', x }); continue; }
      if (!line.trim()) { flush(); continue; }
      if (ul.length) flush();
      para.push(line);
    }
    flush();
    // Coupe à « Navigation » / « Galerie », retire les titres vides
    const stop = blocks.findIndex((b) => b.t === 'h' && b.x === '__STOP__');
    // Paragraphes d'annonce vides (« … can be bought in these shops: ») laissés par les listes DPL supprimées
    const trimmed = (stop >= 0 ? blocks.slice(0, stop) : blocks).filter((b, k, arr) => !(b.t === 'p' && /:\s*$/.test(b.x) && (!arr[k + 1] || arr[k + 1].t === 'h')));
    const out = trimmed.filter((b, k, arr) => !(b.t === 'h' && (!b.x || (arr[k + 1]?.t === 'h' && (arr[k + 1] as any).l <= b.l) || k === arr.length - 1)));
    return out;
  }

  table(src: string): Block {
    const head: string[] = [];
    const rows: string[][] = [];
    let cur: string[] | null = null;
    let caption: string | undefined;
    let headDone = false;
    const pushCells = (l: string, isHead: boolean) => {
      const parts = l.slice(1).split(isHead ? /!!|\|\|/ : /\|\|/);
      for (const c of parts) {
        const cell = this.inline(stripAttr(c));
        if (isHead && !headDone) head.push(cell);
        else (cur ??= []).push(cell);
      }
    };
    for (const raw of src.split('\n')) {
      const l = raw.trim();
      if (l.startsWith('{|') || l === '|}') continue;
      if (l.startsWith('|+')) { caption = this.inline(l.slice(2)); continue; }
      if (l.startsWith('|-')) { if (head.length) headDone = true; if (cur?.length) rows.push(cur); cur = []; continue; }
      if (l.startsWith('!')) { pushCells(l, true); continue; }
      if (l.startsWith('|')) { headDone = true; pushCells(l, false); continue; }
      if (cur?.length) cur[cur.length - 1] += ' ' + this.inline(l);
    }
    if (cur?.length) rows.push(cur);
    return { t: 'tb', h: head, r: rows.filter((r) => r.some((c) => c)), ...(caption ? { c: caption } : {}) } as Block;
  }
}

function stripAttr(c: string): string {
  let dL = 0, dT = 0;
  for (let i = 0; i < c.length; i++) {
    if (c.startsWith('[[', i)) dL++;
    else if (c.startsWith(']]', i)) dL--;
    else if (c.startsWith('{{', i)) dT++;
    else if (c.startsWith('}}', i)) dT--;
    else if (c[i] === '|' && dL === 0 && dT === 0 && /=|^\s*(style|class|colspan|rowspan|align|width)/.test(c.slice(0, i))) return c.slice(i + 1).trim();
  }
  return c.trim();
}
