import { useState, type FormEvent } from 'react';
import CropPicker from '../components/CropPicker';
import Field from '../components/Field';
import MachineCard from '../components/MachineCard';
import VoiceButton from '../components/VoiceButton';
import { useI18n } from '../i18n';
import { ApiError, searchMachines } from '../lib/api';
import { isConfigured } from '../lib/supabase';
import { parseVoice } from '../lib/voice';
import type { CropKey, MachineResult } from '../types';

export default function FindPage({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [village, setVillage] = useState('');
  const [district, setDistrict] = useState('');
  const [crop, setCrop] = useState<CropKey[]>([]);
  const [acres, setAcres] = useState('');
  const [needed, setNeeded] = useState('');
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [failMsg, setFailMsg] = useState('');
  const [results, setResults] = useState<MachineResult[] | null>(null);
  const [searchedAcres, setSearchedAcres] = useState(0);

  const onVoice = (text: string) => {
    const v = parseVoice(text);
    if (v.village) setVillage(v.village);
    if (v.crop) setCrop([v.crop]);
    if (v.acres) setAcres(v.acres);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const a = Number(acres);
    const next: Record<string, string> = {};
    if (village.trim().length < 2) next.village = t('errRequired');
    if (crop.length === 0) next.crop = t('errCrop');
    if (!acres.trim() || !Number.isFinite(a) || a <= 0 || a > 10000) next.acres = t('errAcres');
    setErrs(next); setFailMsg('');
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const list = await searchMachines(village, crop[0], district, needed);
      setSearchedAcres(a); setResults(list);
    } catch (err) {
      setResults(null);
      setFailMsg(err instanceof ApiError && err.code === 'not_configured' ? t('notConfigured') : t('searchFail'));
    } finally { setBusy(false); }
  };

  return (
    <section>
      <button className="linkbtn back" onClick={onBack}>← {t('back')}</button>
      <h2>{t('findTitle')}</h2>
      {!isConfigured && <p className="banner error">{t('notConfigured')}</p>}
      <form className="panel" onSubmit={submit} noValidate>
        <VoiceButton onText={onVoice} />
        <Field label={t('farmerName')}>
          <input value={name} maxLength={80} autoComplete="name" onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t('farmerVillage')} error={errs.village}>
          <input value={village} maxLength={80} placeholder={t('villagePh')} onChange={(e) => setVillage(e.target.value)} />
        </Field>
        <Field label={t('districtQ')} hint={t('districtHelp')}>
          <input value={district} maxLength={80} onChange={(e) => setDistrict(e.target.value)} />
        </Field>
        <div className="field">
          <span className="label">{t('cropQ')}</span>
          <CropPicker multiple={false} value={crop} onChange={setCrop} />
          {errs.crop && <span className="error" role="alert">{errs.crop}</span>}
        </div>
        <Field label={t('acresQ')} error={errs.acres}>
          <input type="number" inputMode="decimal" min="0" step="any" value={acres}
            placeholder={t('acresPh')} onChange={(e) => setAcres(e.target.value)} />
        </Field>
        <Field label={t('neededBy')} hint={t('neededHelp')}>
          <input type="date" value={needed} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setNeeded(e.target.value)} />
        </Field>
        <button className="btn big primary" disabled={busy}>{busy ? t('searching') : t('findMachines')}</button>
      </form>
      {failMsg && <p className="banner error" role="alert">{failMsg}</p>}
      {results && (
        <div className="results">
          {results.length === 0 ? (
            <div className="banner"><b>{t('none')}</b><p>{t('tryAgain')}</p></div>
          ) : (
            <>
              <h2>{name.trim() ? `${t('hello')}, ${name.trim()}. ` : ''}{t('found')}: {results.length}</h2>
              <p className="note">{t('notVerified')}</p>
              <div className="grid">{results.map((m) => <MachineCard key={m.id} m={m} acres={searchedAcres} />)}</div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
