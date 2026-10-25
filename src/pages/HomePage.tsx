import defaultImg from '../assets/default-machine.svg';
import { useI18n } from '../i18n';

export default function HomePage({ go }: { go: (p: 'owner' | 'find' | 'manage') => void }) {
  const { t } = useI18n();
  return (
    <>
      <section className="hero">
        <div className="heroText">
          <h1>{t('tagline')}</h1>
          <button className="btn big mint" onClick={() => go('find')}>{t('find')}</button>
          <button className="btn big ghost" onClick={() => go('owner')}>{t('rent')}</button>
        </div>
        <img className="heroArt" src={defaultImg} alt="" />
        <ul className="trust">
          <li>✓ {t('trust1')}</li>
          <li>✓ {t('trust2')}</li>
          <li>✓ English · ಕನ್ನಡ · हिन्दी</li>
        </ul>
      </section>
      <p className="center"><button className="linkbtn" onClick={() => go('manage')}>{t('manage')}</button></p>
    </>
  );
}
