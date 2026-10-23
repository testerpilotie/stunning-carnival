import { useEffect } from 'react';
import type { Kind } from './db/schema';
import { requestPersistence } from './db/db';
import { useData } from './lib/data';
import { useRoute } from './lib/router';
import { IconChart, IconCog, IconHome, IconList, IconWallet } from './components/Icons';
import { Bankroll } from './screens/Bankroll';
import { Done } from './screens/Done';
import { History } from './screens/History';
import { Home } from './screens/Home';
import { Live } from './screens/Live';
import { SessionEdit } from './screens/SessionEdit';
import { Settings } from './screens/Settings';
import { StartSession } from './screens/StartSession';
import { Stats } from './screens/Stats';

const TABS = [
  { path: '', label: 'Home', Icon: IconHome },
  { path: 'history', label: 'History', Icon: IconList },
  { path: 'stats', label: 'Stats', Icon: IconChart },
  { path: 'bankroll', label: 'Bankroll', Icon: IconWallet },
  { path: 'settings', label: 'Settings', Icon: IconCog },
];

const asKind = (k?: string): Kind => (k === 'tournament' ? 'tournament' : 'cash');

function Screen({ route }: { route: string[] }) {
  const [a, b] = route;
  switch (a) {
    case undefined:
      return <Home />;
    case 'new':
      return <StartSession key={b} kind={asKind(b)} />;
    case 'live':
      return <Live id={Number(b)} />;
    case 'done':
      return <Done id={Number(b)} />;
    case 'session':
      return <SessionEdit key={b} id={Number(b)} />;
    case 'add':
      return <SessionEdit key={`add-${b}`} kind={asKind(b)} />;
    case 'history':
      return <History />;
    case 'stats':
      return <Stats />;
    case 'bankroll':
      return <Bankroll />;
    case 'settings':
      return <Settings />;
    default:
      return <Home />;
  }
}

export function App() {
  const route = useRoute();
  const { settings } = useData();

  useEffect(() => {
    requestPersistence();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  const current = route[0] ?? '';
  return (
    <>
      <main className="app">
        <Screen route={route} />
      </main>
      <div className="tabs">
        <nav>
          {TABS.map(({ path, label, Icon }) => (
            <a key={label} href={`#/${path}`} aria-current={current === path ? 'page' : undefined}>
              <Icon />
              {label}
            </a>
          ))}
        </nav>
      </div>
    </>
  );
}
