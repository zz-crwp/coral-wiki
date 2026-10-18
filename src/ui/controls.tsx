// Contrôles de base : contrôle segmenté, puces de filtre, pastilles d'état, pastilles de saison, anneau de progression.
import type { ComponentChildren } from 'preact';
import { SEASON_FR, type Season } from '../app/data.ts';
import { GIcon } from '../app/components.tsx';
import { Icon } from '../app/icons.tsx';

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: [T, ComponentChildren][]; onChange: (v: T) => void; label: string }) {
  return (
    <div class="segmented" role="group" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={v} aria-pressed={value === v} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}

/** Rangée de puces de filtre défilante (bascule ou choix unique). */
export function Filters({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <div class="filters" role="group" aria-label={label}>
      {children}
    </div>
  );
}
export function FChip({ on, onClick, children, n }: { on: boolean; onClick: () => void; children: ComponentChildren; n?: number }) {
  return (
    <button class="fchip" aria-pressed={on} onClick={onClick}>
      {children}
      {n != null && <span class="n">{n}</span>}
    </button>
  );
}

export type PillKind = 'ok' | 'ko' | 'warn' | 'live' | 'tint' | Season | undefined;
export function Pill({ kind, icon, gicon, children, title }: { kind?: PillKind; icon?: string; gicon?: string; children?: ComponentChildren; title?: string }) {
  return (
    <span class={`pill${kind ? ` ${kind}` : ''}`} title={title}>
      {gicon ? <GIcon k={gicon} size={13} /> : icon ? <Icon name={icon} /> : null}
      {children}
    </span>
  );
}

const ORDER: Season[] = ['spring', 'summer', 'fall', 'winter'];
const ABBR: Record<Season, string> = { spring: 'Print.', summer: 'Été', fall: 'Aut.', winter: 'Hiver' };
/** Saisons en pastilles colorées ; « Toute l'année » si les quatre. */
export function SeasonPills({ seasons, short = false }: { seasons: Season[]; short?: boolean }) {
  if (!seasons.length) return null;
  if (seasons.length === 4) return <Pill>Toute l'année</Pill>;
  return (
    <>
      {ORDER.filter((s) => seasons.includes(s)).map((s) => (
        <Pill key={s} kind={s} title={SEASON_FR[s]}>
          {short ? ABBR[s] : SEASON_FR[s]}
        </Pill>
      ))}
    </>
  );
}

/** Anneau de progression façon Fitness : chiffre au centre, couleur au choix. */
export function Ring({ value, total, size = 64, stroke = 8, color = 'var(--tint)', label, children }: { value: number; total: number; size?: number; stroke?: number; color?: string; label: string; children?: ComponentChildren }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = total ? Math.min(1, value / total) : 0;
  return (
    <span class="ring" role="img" aria-label={`${label} : ${value} sur ${total} (${Math.round(p * 100)} %)`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle class="track" cx={size / 2} cy={size / 2} r={r} fill="none" stroke-width={stroke} />
        <circle class="val" cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} stroke-width={stroke} stroke-linecap="round" stroke-dasharray={c} stroke-dashoffset={c * (1 - p)} />
      </svg>
      {children !== undefined ? <b>{children}</b> : <b>{Math.round(p * 100)}%</b>}
    </span>
  );
}
