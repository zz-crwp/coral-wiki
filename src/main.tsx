import { render } from 'preact';
import { lazy, Suspense } from 'preact/compat';
import { useEffect } from 'preact/hooks';
import './design/tokens.css';
import './design/base.css';
import './styles.css';
import './design/components.css';
import { go, route } from './app/router.ts';
import { TabBar } from './app/components.tsx';
import { TodayPage } from './app/pages/Today.tsx';
import { initStore, ready } from './app/store.ts';
import { entry, loadEntries } from './app/data.ts';
import { ClockSheet } from './ui/Clock.tsx';
import { ContextMenu, Toaster } from './ui/feedback.tsx';
import { FicheSheet } from './ui/Overlays.tsx';
import { WhatsNew } from './ui/WhatsNew.tsx';
import { applyPrefs } from './app/prefs.ts';

const SearchPage = lazy(() => import('./app/pages/Search.tsx').then((m) => m.SearchPage));
const DomainPage = lazy(() => import('./app/pages/Domain.tsx').then((m) => m.DomainPage));
const CollectionsPage = lazy(() => import('./app/pages/Trackers.tsx').then((m) => m.TrackersPage));
const TrackerPage = lazy(() => import('./app/pages/Trackers.tsx').then((m) => m.TrackerPage));
const QuickEntryPage = lazy(() => import('./app/pages/Trackers.tsx').then((m) => m.QuickEntryPage));
const CalendarPage = lazy(() => import('./app/pages/Calendar.tsx').then((m) => m.CalendarPage));
const SettingsPage = lazy(() => import('./app/pages/Misc.tsx').then((m) => m.MorePage));
const CreditsPage = lazy(() => import('./app/pages/Misc.tsx').then((m) => m.CreditsPage));
const RankPage = lazy(() => import('./app/pages/Special.tsx').then((m) => m.RankPage));
const MinesPage = lazy(() => import('./app/pages/Special.tsx').then((m) => m.MinesPage));
const TemplePage = lazy(() => import('./app/pages/Temple.tsx').then((m) => m.TemplePage));
const DesignPage = lazy(() => import('./app/pages/Design.tsx').then((m) => m.DesignPage));

/** Anciennes adresses (avant la refonte) → nouvelles, en remplaçant l'historique. */
function Redirect({ to, q }: { to: string; q?: Record<string, string | undefined> }) {
  useEffect(() => go(to, q, true), [to]);
  return null;
}
/** Lien profond vers une fiche : liste du domaine, ligne dépliée et sheet ouverte. */
function FicheRedirect({ id }: { id: string }) {
  useEffect(() => {
    loadEntries().then(() => {
      const e = entry(id);
      go(e ? (e.dom === 'pnj' ? '/habitants' : `/chercher/${e.dom}`) : '/chercher', e ? { open: id, f: id } : undefined, true);
    });
  }, [id]);
  return null;
}

function Page() {
  if (!ready.value) return null;
  const [a, b, c] = route.value.path;
  const q = Object.fromEntries(route.value.query);
  switch (a) {
    case 'chercher':
      if (!b) return <SearchPage />;
      if (b === 'rang') return <RankPage />;
      if (b === 'mines') return <MinesPage />;
      return <DomainPage key={b} dom={b} />;
    case 'collections':
      if (b === 'temple') return <TemplePage />;
      if (b && c === 'saisie') return <QuickEntryPage key={b} id={b} />;
      return b ? <TrackerPage key={b} id={b} /> : <CollectionsPage />;
    case 'habitants':
      return <DomainPage key="habitants" dom="pnj" root />;
    case 'calendrier':
      return <CalendarPage />;
    case 'reglages':
      return <SettingsPage />;
    case 'credits':
      return <CreditsPage />;
    case 'design':
      return <DesignPage />;
    // Anciennes adresses (v1) : redirigées sans casser les favoris du navigateur
    case 'fiche':
      return <FicheRedirect id={b} />;
    case 'explorer':
    case 'encyclo':
      if (b === 'pnj') return <Redirect to="/habitants" q={q} />;
      if (b === 'ameliorations') return <Redirect to={q.magasin ? '/chercher/lieux' : '/chercher'} q={q.magasin ? { f: q.magasin } : undefined} />;
      return <Redirect to={b ? `/chercher/${b}` : '/chercher'} q={q} />;
    case 'progression':
    case 'trackers':
      return <Redirect to={b ? `/collections/${b}` : '/collections'} q={q} />;
    case 'temple':
    case 'musee':
      return <Redirect to={`/collections/${a}`} />;
    case 'ameliorations':
      return <Redirect to="/chercher" />;
    case 'rang':
    case 'mines':
      return <Redirect to={`/chercher/${a}`} />;
    case 'outils':
      return <Redirect to={b === 'cultures' ? '/chercher/cultures' : '/habitants'} q={b === 'cadeaux' && c ? { f: c } : undefined} />;
    case 'session':
    case 'favoris':
      return <Redirect to="/" />;
    case 'plus':
      return <Redirect to="/reglages" />;
    case 'recherche':
      return <Redirect to="/chercher" q={q} />;
    default:
      return <TodayPage />;
  }
}

function App() {
  return (
    <div class="app">
      <a class="skip" href="#main" onClick={(e) => { e.preventDefault(); const m = document.getElementById('main'); m?.setAttribute('tabindex', '-1'); m?.focus(); }}>
        Aller au contenu
      </a>
      <Suspense fallback={null}>
        <Page />
        <FicheSheet />
      </Suspense>
      <TabBar />
      <WhatsNew />
      <ClockSheet />
      <ContextMenu />
      <Toaster />
    </div>
  );
}

// Clavier virtuel : hauteur exposée en --kb pour que les sheets restent au-dessus
if (window.visualViewport) {
  const vv = window.visualViewport;
  const upd = () => document.documentElement.style.setProperty('--kb', `${Math.max(0, window.innerHeight - vv.height - vv.offsetTop)}px`);
  vv.addEventListener('resize', upd);
  vv.addEventListener('scroll', upd);
}

applyPrefs();
render(<App />, document.getElementById('app')!);
initStore().then(() => import('./app/sync.ts').then((m) => m.loadGistConf()));

// Index chargé quand le navigateur est libre (recherche instantanée ensuite)
(window.requestIdleCallback ?? ((f: () => void) => setTimeout(f, 300)))(() => loadEntries());

// Service worker (production uniquement)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }));
}

// Nouvelle version déployée pendant la session : un ancien chunk a disparu → rechargement.
// Au plus un toutes les 10 s (évite une boucle si le chunk manque vraiment), mais pas une seule fois par session :
// une app installée reste ouverte des jours et voit passer plusieurs déploiements.
function reloadForNewVersion() {
  try {
    if (Date.now() - Number(sessionStorage.getItem('cw-reload') ?? 0) < 10_000) return false;
    sessionStorage.setItem('cw-reload', String(Date.now()));
  } catch {
    return false; // stockage bloqué : impossible de limiter les rechargements, on n'en tente aucun
  }
  location.reload();
  return true;
}
window.addEventListener('vite:preloadError', (e) => {
  if (reloadForNewVersion()) e.preventDefault();
});
// L'aide de préchargement de Vite ne signale que ses dépendances : l'échec du chunk de la page lui-même arrive ici
window.addEventListener('unhandledrejection', (e) => {
  if (/dynamically imported module|Importing a module script failed/.test(String(e.reason?.message ?? e.reason)) && reloadForNewVersion()) e.preventDefault();
});
