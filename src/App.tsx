import { useState } from 'react';
import { LANGS, useI18n } from './i18n';
import HomePage from './pages/HomePage';
import OwnerPage from './pages/OwnerPage';
import FindPage from './pages/FindPage';
import ManagePage from './pages/ManagePage';

type Page = 'home' | 'owner' | 'find' | 'manage';

export default function App() {
  const [page, setPage] = useState<Page>('home');
  const { lang, setLang, t } = useI18n();
  return (
    <div className="app">
      <header className="top">
        <button className="brand" onClick={() => setPage('home')}>HARVEST RENTALS</button>
        <div className="langs" role="group" aria-label={t('language')}>
          {LANGS.map((l) => (
            <button key={l.code} className={l.code === lang ? 'lang on' : 'lang'}
              aria-pressed={l.code === lang} onClick={() => setLang(l.code)}>{l.label}</button>
          ))}
        </div>
      </header>
      <main>
        {page === 'home' && <HomePage go={setPage} />}
        {page === 'owner' && <OwnerPage onBack={() => setPage('home')} />}
        {page === 'manage' && <ManagePage onBack={() => setPage('home')} />}
        {page === 'find' && <FindPage onBack={() => setPage('home')} />}
      </main>
    </div>
  );
}
