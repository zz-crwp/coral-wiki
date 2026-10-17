import { render } from 'preact';
import { lazy, Suspense } from 'preact/compat';
import './styles.css';
import { route } from './app/router.ts';
import { TabBar } from './app/components.tsx';

import { TodayPage } from './app/pages/Today.tsx';
import { initStore, ready } from './app/store.ts';
import { loadEntries } from './app/data.ts';

const SearchPage = lazy(() => import('./app/pages/Search.tsx').then((m) => m.SearchPage));
const EncycloPage = lazy(() => import('./app/pages/Encyclo.tsx').then((m) => m.EncycloPage));
const DomainListPage = lazy(() => import('./app/pages/Encyclo.tsx').then((m) => m.DomainListPage));
const FichePage = lazy(() => import('./app/pages/Fiche.tsx').then((m) => m.FichePage));
const TemplePage = lazy(() => import('./app/pages/Special.tsx').then((m) => m.TemplePage));
const MuseumPage = lazy(() => import('./app/pages/Special.tsx').then((m) => m.MuseumPage));
const RankPage = lazy(() => import('./app/pages/Special.tsx').then((m) => m.RankPage));
const TrackersPage = lazy(() => import('./app/pages/Trackers.tsx').then((m) => m.TrackersPage));
const TrackerPage = lazy(() => import('./app/pages/Trackers.tsx').then((m) => m.TrackerPage));
const CalendarPage = lazy(() => import('./app/pages/Calendar.tsx').then((m) => m.CalendarPage));
const MorePage = lazy(() => import('./app/pages/Misc.tsx').then((m) => m.MorePage));
const CreditsPage = lazy(() => import('./app/pages/Misc.tsx').then((m) => m.CreditsPage));
const FavoritesPage = lazy(() => import('./app/pages/Misc.tsx').then((m) => m.FavoritesPage));
const CropCalcPage = lazy(() => import('./app/pages/Tools.tsx').then((m) => m.CropCalcPage));
const GiftPlannerPage = lazy(() => import('./app/pages/Tools.tsx').then((m) => m.GiftPlannerPage));
const GiftNpcPage = lazy(() => import('./app/pages/Tools.tsx').then((m) => m.GiftNpcPage));
const MinesPage = lazy(() => import('./app/pages/Special.tsx').then((m) => m.MinesPage));

function Page() {
  if (!ready.value) return null;
  const [a, b] = route.value.path;
  switch (a) {
    case 'recherche':
      return <SearchPage />;
    case 'encyclo':
      return b ? <DomainListPage dom={b} /> : <EncycloPage />;
    case 'fiche':
      return <FichePage key={b} id={b} />;
    case 'temple':
      return <TemplePage />;
    case 'musee':
      return <MuseumPage />;
    case 'rang':
      return <RankPage />;
    case 'mines':
      return <MinesPage />;
    case 'trackers':
      return b ? <TrackerPage key={b} id={b} /> : <TrackersPage />;
    case 'outils':
      return b === 'cultures' ? <CropCalcPage /> : route.value.path[2] ? <GiftNpcPage key={route.value.path[2]} id={route.value.path[2]} /> : <GiftPlannerPage />;
    case 'favoris':
      return <FavoritesPage />;
    case 'calendrier':
      return <CalendarPage />;
    case 'plus':
      return <MorePage />;
    case 'credits':
      return <CreditsPage />;
    default:
      return <TodayPage />;
  }
}

function App() {
  return (
    <div class="app">
      <a class="skip" href="#main" onClick={(e) => { e.preventDefault(); const m = document.getElementById("main"); m?.setAttribute("tabindex", "-1"); m?.focus(); }}>
        Aller au contenu
      </a>
      <Suspense fallback={null}>
        <Page />
      </Suspense>
      <TabBar />
    </div>
  );
}

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
