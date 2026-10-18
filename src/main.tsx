import { render } from 'preact';
import { lazy, Suspense } from 'preact/compat';
import { useEffect } from 'preact/hooks';
import './design/tokens.css';
import './design/base.css';
import './styles.css';
import './design/components.css';
import fredoka from '@fontsource-variable/fredoka/files/fredoka-latin-wght-normal.woff2?url';
import { go, route, searchOpen, searchSeed } from './app/router.ts';
import { TabBar } from './app/components.tsx';
import { TodayPage } from './app/pages/Today.tsx';
import { initStore, ready } from './app/store.ts';
import { entry, loadEntries } from './app/data.ts';
import { ClockSheet } from './ui/Clock.tsx';
import { ContextMenu, Toaster } from './ui/feedback.tsx';
import { FicheSheet, SearchSheet } from './ui/Overlays.tsx';
import { applyPrefs } from './app/prefs.ts';

const ExplorerPage = lazy(() => import('./app/pages/Explorer.tsx').then((m) => m.ExplorerPage));
const DomainPage = lazy(() => import('./app/pages/Domain.tsx').then((m) => m.DomainPage));
const ProgressionPage = lazy(() => import('./app/pages/Trackers.tsx').then((m) => m.TrackersPage));
const TrackerPage = lazy(() => import('./app/pages/Trackers.tsx').then((m) => m.TrackerPage));
const SessionPage = lazy(() => import('./app/pages/Session.tsx').then((m) => m.SessionPage));
const CalendarPage = lazy(() => import('./app/pages/Calendar.tsx').then((m) => m.CalendarPage));
const SettingsPage = lazy(() => import('./app/pages/Misc.tsx').then((m) => m.MorePage));
const CreditsPage = lazy(() => import('./app/pages/Misc.tsx').then((m) => m.CreditsPage));
const CropCalcPage = lazy(() => import('./app/pages/Tools.tsx').then((m) => m.CropCalcPage));
const GiftPlannerPage = lazy(() => import('./app/pages/Tools.tsx').then((m) => m.GiftPlannerPage));
const GiftNpcPage = lazy(() => import('./app/pages/Tools.tsx').then((m) => m.GiftNpcPage));
const UpgradesPage = lazy(() => import('./app/pages/Special.tsx').then((m) => m.UpgradesPage));
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
      go(e ? `/explorer/${e.dom}` : '/explorer', e ? { open: id, f: id } : undefined, true);
    });
  }, [id]);
  return null;
}

function Page() {
  if (!ready.value) return null;
  const [a, b, c] = route.value.path;
  const q = Object.fromEntries(route.value.query);
  switch (a) {
    case 'explorer':
      if (!b) return <ExplorerPage />;
      if (b === 'ameliorations') return <UpgradesPage />;
      if (b === 'rang') return <RankPage />;
      if (b === 'mines') return <MinesPage />;
      return <DomainPage key={b} dom={b} />;
    case 'progression':
      if (b === 'temple') return <TemplePage />;
      return b ? <TrackerPage key={b} id={b} /> : <ProgressionPage />;
    case 'session':
      return <SessionPage />;
    case 'calendrier':
      return <CalendarPage />;
    case 'reglages':
      return <SettingsPage />;
    case 'credits':
      return <CreditsPage />;
    case 'design':
      return <DesignPage />;
    case 'outils':
      return b === 'cultures' ? <CropCalcPage /> : c ? <GiftNpcPage key={c} id={c} /> : <GiftPlannerPage />;
    // Anciennes adresses
    case 'fiche':
      return <FicheRedirect id={b} />;
    case 'encyclo':
      return <Redirect to={b ? `/explorer/${b}` : '/explorer'} q={q} />;
    case 'trackers':
      return <Redirect to={b ? `/progression/${b}` : '/progression'} q={q} />;
    case 'temple':
    case 'musee':
      return <Redirect to={`/progression/${a}`} />;
    case 'ameliorations':
    case 'rang':
    case 'mines':
      return <Redirect to={`/explorer/${a}`} q={q} />;
    case 'favoris':
      return <Redirect to="/session" />;
    case 'plus':
      return <Redirect to="/reglages" />;
    case 'recherche':
      searchSeed.value = q.q ?? '';
      searchOpen.value = true;
      return <Redirect to="/" />;
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
      <SearchSheet />
      <ClockSheet />
      <ContextMenu />
      <Toaster />
    </div>
  );
}

// Police des grands titres : Fredoka, embarquée (fonctionne hors ligne)
if ('fonts' in document) {
  const f = new FontFace('Fredoka', `url(${fredoka}) format('woff2')`, { weight: '300 700', display: 'swap' });
  f.load().then((ff) => document.fonts.add(ff)).catch(() => {});
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

// Nouvelle version déployée pendant la session : un ancien chunk a disparu → rechargement unique.
window.addEventListener('vite:preloadError', (e) => {
  try {
    if (sessionStorage.getItem('cw-reload')) return;
    sessionStorage.setItem('cw-reload', '1');
  } catch {}
  e.preventDefault();
  location.reload();
});
