// Briques d'affichage des fiches : puces liées, sections, prix, frise horaire.
import { useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { entry, SEASON_FR, type Season } from '../data.ts';
import { GameImg, RichText } from '../components.tsx';
import { Icon } from '../icons.tsx';
import { QUALITY } from './labels.ts';

/** Lien vers une fiche, avec vignette (ou texte brut si l'id est inconnu). */
export function Chip({ id, note, size = 28 }: { id: string; note?: ComponentChildren; size?: number }) {
  const e = entry(id);
  if (!e) return <span class="xchip muted">{id}{note && <small>{note}</small>}</span>;
  return (
    <a class="xchip" href={`#/fiche/${id}`}>
      <GameImg src={e.img} dom={e.dom} size={size} />
      <span class="xchip-t">
        <span>{e.fr}</span>
        {note && <small>{note}</small>}
      </span>
    </a>
  );
}

/** Liste de puces, tronquée avec « Voir tout ». */
export function ChipList({ ids, limit = 18, notes }: { ids: string[]; limit?: number; notes?: Record<string, ComponentChildren> }) {
  const [all, setAll] = useState(false);
  const uniq = [...new Set(ids)];
  const shown = all ? uniq : uniq.slice(0, limit);
  return (
    <div class="xchips">
      {shown.map((id) => (
        <Chip key={id} id={id} note={notes?.[id]} />
      ))}
      {uniq.length > limit && (
        <button class="xchip more" onClick={() => setAll(!all)}>
          {all ? 'Réduire' : `+ ${uniq.length - limit} autres`}
        </button>
      )}
    </div>
  );
}

/** Section de fiche, repliable (ouverte par défaut). */
export function Section({ title, count, children, open = true, id }: { title: string; count?: number; children: ComponentChildren; open?: boolean; id?: string }) {
  return (
    <details class="fsec" open={open} id={id}>
      <summary>
        <h3>{title}</h3>
        {count != null && <span class="note">{count}</span>}
        <Icon name="chevron" class="fsec-chev" />
      </summary>
      <div class="fsec-body">{children}</div>
    </details>
  );
}

export function KV({ rows }: { rows: [string, ComponentChildren][] }) {
  const r = rows.filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== false);
  if (!r.length) return null;
  return (
    <dl class="kv">
      {r.map(([k, v]) => (
        <>
          <dt>{k}</dt>
          <dd>{typeof v === 'string' ? <RichText text={v} /> : v}</dd>
        </>
      ))}
    </dl>
  );
}

export function Prices({ prix }: { prix: Record<string, number | null | undefined> }) {
  return (
    <div class="qprices" role="table" aria-label="Prix de vente par qualité">
      {QUALITY.map((q) =>
        prix[q.key] != null ? (
          <div key={q.key} class="qp" role="row">
            <span class="qdot" style={{ background: q.color }} aria-hidden="true" />
            <span class="qlab" role="cell">{q.label}</span>
            <strong role="cell">{prix[q.key]}</strong>
          </div>
        ) : null,
      )}
    </div>
  );
}

export function SeasonChips({ seasons }: { seasons: string[] }) {
  if (!seasons.length) return null;
  if (seasons.length === 4) return <span class="badge">Toute l'année</span>;
  return (
    <span class="badges">
      {seasons.map((s) => (
        <span key={s} class={`badge ${s}`}>
          {SEASON_FR[s as Season]}
        </span>
      ))}
    </span>
  );
}

/** Frise 6h → 2h montrant les plages horaires. */
export function Timeline({ ranges }: { ranges: { from: number; to: number }[] }) {
  if (!ranges.length) return null;
  const start = 6;
  const span = 20;
  return (
    <div class="tl" aria-hidden="true">
      {ranges.map((r, i) => (
        <span key={i} class="tl-bar" style={{ left: `${((Math.max(r.from, start) - start) / span) * 100}%`, width: `${((Math.min(r.to, start + span) - Math.max(r.from, start)) / span) * 100}%` }} />
      ))}
      <span class="tl-ticks">
        {[6, 12, 18, 24].map((h) => (
          <span key={h} style={{ left: `${((h - start) / span) * 100}%` }}>{h % 24}h</span>
        ))}
      </span>
    </div>
  );
}

export function Hearts({ n }: { n: number | null | undefined }) {
  if (n == null) return null;
  return (
    <span class="hearts" aria-label={`${n} cœur${n > 1 ? 's' : ''}`}>
      {n}
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
        <path fill="currentColor" d="M12 21s-7.5-4.6-9.5-9.2C1 8.4 3.2 5 6.6 5c2 0 3.6 1.1 5.4 3 1.8-1.9 3.4-3 5.4-3 3.4 0 5.6 3.4 4.1 6.8C19.5 16.4 12 21 12 21z" />
      </svg>
    </span>
  );
}
