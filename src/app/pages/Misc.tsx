import { useEffect, useState } from 'preact/hooks';
import { DOMAINS, entry, loadEntries, meta, SEASON_FR, type Entry } from '../data.ts';
import { Empty, GameImg, TopBar } from '../components.tsx';
import { Icon } from '../icons.tsx';
import { active, createProfile, deleteProfile, profiles, renameProfile, switchProfile, toggleFav } from '../store.ts';
import { connect, disconnect, exportFile, gist, importFile, setAuto, syncNow, syncState } from '../sync.ts';

type Theme = 'system' | 'light' | 'dark';
function readTheme(): Theme {
  try {
    const t = localStorage.getItem('cw-theme');
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
}

const Link = ({ href, icon, label, sub }: { href: string; icon: string; label: string; sub?: string }) => (
  <a class="setting link" href={href}>
    <Icon name={icon} class="set-ic" />
    <span class="set-t">
      {label}
      {sub && <small>{sub}</small>}
    </span>
    <Icon name="chevron" class="chev" />
  </a>
);

export function MorePage() {
  const [theme, setTheme] = useState<Theme>(readTheme());
  const apply = (t: Theme) => {
    setTheme(t);
    try {
      if (t === 'system') localStorage.removeItem('cw-theme');
      else localStorage.setItem('cw-theme', t);
    } catch {}
    if (t === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
  };
  const p = active.value;
  return (
    <>
      <TopBar title="Plus" />
      <main class="page" id="main">
        <h2 class="section-title">Outils</h2>
        <div class="card">
          <Link href="#/outils/cultures" icon="cultures" label="Rentabilité des cultures" sub="Bénéfice selon le jour de plantation" />
          <Link href="#/outils/cadeaux" icon="cake" label="Planificateur de cadeaux" sub="Anniversaires, cadeaux de la semaine, préférences" />
          <Link href="#/ameliorations" icon="outils" label="Améliorations par magasin" sub="Forge, labo, charpentier, sac… : or et matériaux" />
          <Link href="#/calendrier" icon="festivals" label="Calendrier" sub="Festivals et anniversaires" />
          <Link href="#/favoris" icon="star" label="Favoris" sub={`${p?.favs.length ?? 0} fiche${(p?.favs.length ?? 0) > 1 ? 's' : ''}`} />
        </div>
        <Profiles />
        <Backup />
        <GistSync />
        <h2 class="section-title">Affichage</h2>
        <div class="card">
          <div class="setting">
            <span id="theme-l">Thème</span>
            <div class="seg" role="group" aria-labelledby="theme-l">
              {(['system', 'light', 'dark'] as Theme[]).map((t) => (
                <button key={t} aria-pressed={theme === t} onClick={() => apply(t)}>
                  {{ system: 'Auto', light: 'Clair', dark: 'Sombre' }[t]}
                </button>
              ))}
            </div>
          </div>
        </div>
        <h2 class="section-title">À propos</h2>
        <div class="card">
          <Link href="#/credits" icon="info" label="Crédits et licences" />
          <div class="setting">
            <span>Version du jeu couverte</span>
            <strong>{meta.game_version}</strong>
          </div>
          <div class="setting">
            <span>Données du wiki</span>
            <span class="note">{new Date(meta.fandom_fetched_at).toLocaleDateString('fr-FR')}</span>
          </div>
        </div>
      </main>
    </>
  );
}

function Profiles() {
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const list = profiles.value;
  const cur = active.value?.id;
  const commit = async () => {
    const n = name.trim();
    if (n) {
      if (editing) await renameProfile(editing, n);
      else await createProfile(n);
    }
    setEditing(null);
    setAdding(false);
    setName('');
  };
  const form = (
    <form class="setting" onSubmit={(e) => { e.preventDefault(); commit(); }}>
      <label class="sr-only" for="pname">Nom du profil</label>
      <input id="pname" class="text-in" value={name} maxLength={40} placeholder="Nom de la partie" onInput={(e) => setName((e.target as HTMLInputElement).value)} autoFocus />
      <button class="btn" type="submit">OK</button>
      <button class="btn ghost" type="button" onClick={() => { setEditing(null); setAdding(false); }}>Annuler</button>
    </form>
  );
  return (
    <>
      <h2 class="section-title">Profils (parties)</h2>
      <div class="card" role="radiogroup" aria-label="Profil actif">
        {list.map((p) =>
          editing === p.id ? (
            <div key={p.id}>{form}</div>
          ) : (
            <div key={p.id} class="setting profile">
              <button class="radio" role="radio" aria-checked={p.id === cur} onClick={() => switchProfile(p.id)}>
                <span class="dot" aria-hidden="true" />
                <span class="set-t">
                  {p.name}
                  <small>
                    {Object.keys(p.checks).length} coche{Object.keys(p.checks).length > 1 ? 's' : ''} · {SEASON_FR[p.date.season]} {p.date.day}, an {p.date.year}
                  </small>
                </span>
              </button>
              <button class="icon-btn" aria-label={`Renommer ${p.name}`} onClick={() => { setEditing(p.id); setName(p.name); }}>
                <Icon name="edit" />
              </button>
              {list.length > 1 && (
                <button class="icon-btn" aria-label={`Supprimer ${p.name}`} onClick={() => confirm(`Supprimer le profil « ${p.name} » et toute sa progression ?`) && deleteProfile(p.id)}>
                  <Icon name="trash" />
                </button>
              )}
            </div>
          ),
        )}
        {adding ? form : (
          <button class="setting link add" onClick={() => { setAdding(true); setName(''); }}>
            <Icon name="plus" class="set-ic" />
            <span class="set-t">Nouveau profil</span>
          </button>
        )}
      </div>
    </>
  );
}

function Backup() {
  const [msg, setMsg] = useState<{ t: string; err?: boolean } | null>(null);
  const [replace, setReplace] = useState(false);
  const onFile = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    if (replace && !confirm('Remplacer tous les profils de cet appareil par ceux du fichier ?')) return;
    try {
      const n = await importFile(f, replace);
      setMsg({ t: `${n} profil${n > 1 ? 's' : ''} importé${n > 1 ? 's' : ''} (${replace ? 'remplacement' : 'fusion'}).` });
    } catch (err) {
      setMsg({ t: (err as Error).message, err: true });
    }
  };
  return (
    <>
      <h2 class="section-title">Sauvegarde</h2>
      <div class="card">
        <button class="setting link" onClick={() => exportFile().then(() => setMsg({ t: 'Fichier de sauvegarde téléchargé.' }))}>
          <Icon name="download" class="set-ic" />
          <span class="set-t">
            Exporter (fichier JSON)
            <small>Tous les profils, coches, dates et favoris</small>
          </span>
        </button>
        <label class="setting link">
          <Icon name="upload" class="set-ic" />
          <span class="set-t">
            Importer un fichier
            <small>{replace ? 'Remplace les profils de cet appareil' : 'Fusionne : la version la plus récente de chaque profil est gardée'}</small>
          </span>
          <input type="file" accept="application/json,.json" class="sr-only" onChange={onFile} />
        </label>
        <div class="setting">
          <span id="imp-l">Mode d'import</span>
          <div class="seg" role="group" aria-labelledby="imp-l">
            <button aria-pressed={!replace} onClick={() => setReplace(false)}>Fusion</button>
            <button aria-pressed={replace} onClick={() => setReplace(true)}>Remplacer</button>
          </div>
        </div>
        {msg && <p class={`note pad${msg.err ? ' err' : ''}`} role="status">{msg.t}</p>}
      </div>
    </>
  );
}

function GistSync() {
  const c = gist.value;
  const st = syncState.value;
  const [token, setToken] = useState('');
  const [auto, setAutoLocal] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: Event) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await connect(token, auto);
      setToken('');
    } catch (x) {
      setErr((x as Error).message);
    }
    setBusy(false);
  };
  return (
    <>
      <h2 class="section-title">Synchronisation (GitHub Gist)</h2>
      <div class="card">
        {c ? (
          <>
            <div class="setting">
              <span class="set-t">
                Connecté{c.login ? ` : ${c.login}` : ''}
                <small>{c.lastSync ? `Dernière synchro : ${new Date(c.lastSync).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}` : 'Jamais synchronisé'}</small>
              </span>
              <button class="btn" disabled={st.busy} onClick={() => syncNow().catch(() => {})}>
                {st.busy ? '…' : 'Synchroniser'}
              </button>
            </div>
            <label class="setting">
              <span class="set-t">
                Automatique
                <small>À l'ouverture et quand l'app passe en arrière-plan</small>
              </span>
              <input type="checkbox" class="switch" checked={!!c.auto} onChange={(e) => setAuto((e.target as HTMLInputElement).checked)} />
            </label>
            {st.msg && <p class={`note pad${st.error ? ' err' : ''}`} role="status">{st.msg}</p>}
            <button class="setting link danger" onClick={() => confirm('Désactiver la synchronisation et oublier le jeton sur cet appareil ?') && disconnect()}>
              <span class="set-t">Se déconnecter</span>
            </button>
          </>
        ) : (
          <form class="gist-form" onSubmit={submit}>
            <p class="note">
              Synchronise vos profils entre appareils via un Gist <strong>privé</strong> de votre compte GitHub. Créez un jeton <strong>classic</strong> avec uniquement le scope <code>gist</code> (les jetons « fine-grained » ne fonctionnent pas) :{' '}
              <a href="https://github.com/settings/tokens/new?scopes=gist&description=Coral%20Wiki" target="_blank" rel="noopener">
                créer un jeton
              </a>
              . Le jeton reste sur cet appareil et n'est envoyé qu'à api.github.com.
            </p>
            <label class="form-label" for="tok">Jeton GitHub (classic)</label>
            <input id="tok" class="text-in" type="password" autoComplete="off" spellcheck={false} value={token} onInput={(e) => setToken((e.target as HTMLInputElement).value)} placeholder="ghp_…" required />
            <label class="check-line">
              <input type="checkbox" checked={auto} onChange={(e) => setAutoLocal((e.target as HTMLInputElement).checked)} /> Synchroniser automatiquement
            </label>
            {err && <p class="note err" role="alert">{err}</p>}
            {st.msg && st.error && !err && <p class="note err" role="alert">{st.msg}</p>}
            <button class="btn" type="submit" disabled={busy || !token.trim()}>
              {busy ? 'Connexion…' : 'Connecter et synchroniser'}
            </button>
          </form>
        )}
      </div>
      <p class="note fine">Conflits : pour chaque profil, la version modifiée le plus récemment l'emporte. Faites un export avant la première synchronisation.</p>
    </>
  );
}

export function FavoritesPage() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    loadEntries().then(() => setReady(true));
  }, []);
  const favs = active.value?.favs ?? [];
  const list = ready ? favs.map((id) => entry(id)).filter((e): e is Entry => !!e) : [];
  return (
    <>
      <TopBar title="Favoris" backTo="/plus" />
      <main class="page" id="main">
        {!ready ? (
          <Empty>Chargement…</Empty>
        ) : !list.length ? (
          <Empty icon="star">Aucun favori. Touchez l'étoile en haut d'une fiche pour l'ajouter ici.</Empty>
        ) : (
          <div class="card list">
            {list.map((e) => (
              <div key={e.id} class="row trow">
                <a class="trow-link" href={`#/fiche/${e.id}`}>
                  <GameImg src={e.img} dom={e.dom} size={44} />
                  <span class="txt">
                    <span class="name">{e.fr}</span>
                    <span class="sub">{DOMAINS[e.dom]} · {e.cat}</span>
                  </span>
                </a>
                <button class="icon-btn" aria-label={`Retirer ${e.fr} des favoris`} onClick={() => toggleFav(e.id)}>
                  <Icon name="close" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

export function CreditsPage() {
  return (
    <>
      <TopBar title="Crédits" backTo="/plus" />
      <main class="page" id="main">
        <div class="card prose" style={{ paddingTop: 16 }}>
          <p>
            <strong>Contenu</strong> : repris du{' '}
            <a href="https://coralisland.fandom.com" target="_blank" rel="noopener">
              Coral Island Wiki (Fandom)
            </a>{' '}
            et du{' '}
            <a href="https://coral-island.fandom.com/fr" target="_blank" rel="noopener">
              Wiki Coral Island FR
            </a>
            , sous licence{' '}
            <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener">
              CC BY-SA
            </a>
            . Chaque fiche renvoie vers sa page source. Les contributeurs des wikis en sont les auteurs.
          </p>
          <p>
            <strong>Recoupements</strong> : succès officiels Steam, guide Steam « NPC Birthdays & Loved Gifts », notes de mise à jour de Stairway Games, guides
            Gamerant, Screen Rant et ProGameGuides (voir les sources de chaque fiche).
          </p>
          <p>
            <strong>Images</strong> : © Stairway Games. Chargées depuis le CDN d'origine (Fandom, Steam), non redistribuées.
          </p>
          <p>
            <strong>Coral Island</strong> est une marque de Stairway Games. Coral Wiki est un projet de fan non officiel, sans affiliation.
          </p>
          <p class="note">Version du jeu couverte : {meta.game_version} ({meta.game_version_date}). {meta.upcoming}</p>
        </div>
      </main>
    </>
  );
}
