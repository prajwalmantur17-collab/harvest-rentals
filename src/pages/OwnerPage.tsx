import { useState, type FormEvent } from 'react';
import CropPicker from '../components/CropPicker';
import Field from '../components/Field';
import PhotoPreview from '../components/PhotoPreview';
import { useI18n, type Dict } from '../i18n';
import { ApiError, submitMachine } from '../lib/api';
import { isConfigured } from '../lib/supabase';
import { validateOwner, type OwnerErrors } from '../lib/validation';
import type { OwnerFormData, PricingType } from '../types';

const empty: OwnerFormData = {
  owner_name: '', owner_phone: '', owner_village: '', owner_district: '', machine_name: '',
  supported_crops: [], other_crop_name: '', service_villages_text: '', pricing_type: 'per_acre', price: '', pin: '',
};
const PRICING: { v: PricingType; label: keyof Dict; price: keyof Dict }[] = [
  { v: 'per_acre', label: 'perAcre', price: 'priceAcre' },
  { v: 'per_hour', label: 'perHour', price: 'priceHour' },
  { v: 'per_day', label: 'perDay', price: 'priceDay' },
];

export default function OwnerPage({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  const [f, setF] = useState<OwnerFormData>(empty);
  const [photo, setPhoto] = useState<File | null>(null);
  const [errs, setErrs] = useState<OwnerErrors>({});
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState('');
  const [done, setDone] = useState(false);

  const set = <K extends keyof OwnerFormData>(k: K, v: OwnerFormData[K]) => setF((p) => ({ ...p, [k]: v }));
  const err = (k: keyof OwnerErrors) => (errs[k] ? t(errs[k] as keyof Dict) : undefined);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFail('');
    const v = validateOwner(f, photo);
    setErrs(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    try {
      await submitMachine(f, photo);
      setDone(true);
    } catch (x) {
      if (x instanceof ApiError && x.code === 'not_configured') setFail(t('notConfigured'));
      else if (x instanceof ApiError && x.code === 'rate_limited') setFail(t('rateLimited'));
      else setFail(t('saveFail'));
    } finally { setBusy(false); }
  };

  if (done) {
    return (
      <section className="banner ok">
        <h2>✓ {t('successTitle')}</h2>
        <p>{t('successMsg')}</p>
        <button className="btn big primary" onClick={() => { setF(empty); setPhoto(null); setDone(false); }}>{t('addAnother')}</button>
        <button className="btn big secondary" onClick={onBack}>{t('back')}</button>
      </section>
    );
  }

  const cur = PRICING.find((p) => p.v === f.pricing_type) ?? PRICING[0];
  return (
    <section>
      <button className="linkbtn back" onClick={onBack}>← {t('back')}</button>
      <h2>{t('ownerTitle')}</h2>
      <p className="note">{t('ownerIntro')}</p>
      {!isConfigured && <p className="banner error">{t('notConfigured')}</p>}
      <form className="panel" onSubmit={submit} noValidate>
        <h3>{t('aboutYou')}</h3>
        <Field label={t('ownerName')} error={err('owner_name')}>
          <input value={f.owner_name} maxLength={80} autoComplete="name" onChange={(e) => set('owner_name', e.target.value)} />
        </Field>
        <Field label={t('phone')} hint={t('phoneEx')} error={err('owner_phone')}>
          <input type="tel" inputMode="tel" value={f.owner_phone} maxLength={16} autoComplete="tel"
            onChange={(e) => set('owner_phone', e.target.value)} />
        </Field>
        <Field label={t('village')} error={err('owner_village')}>
          <input value={f.owner_village} maxLength={80} onChange={(e) => set('owner_village', e.target.value)} />
        </Field>
        <Field label={t('district')} error={err('owner_district')}>
          <input value={f.owner_district} maxLength={80} onChange={(e) => set('owner_district', e.target.value)} />
        </Field>

        <h3>{t('aboutMachine')}</h3>
        <Field label={t('machineName')} hint={t('machineEx')} error={err('machine_name')}>
          <input value={f.machine_name} maxLength={80} onChange={(e) => set('machine_name', e.target.value)} />
        </Field>
        <Field label={t('photo')} hint={t('photoHelp')} error={err('photo')}>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
        </Field>
        <PhotoPreview file={errs.photo ? null : photo} />

        <div className="field">
          <span className="label">{t('crops')}</span>
          <CropPicker multiple value={f.supported_crops} onChange={(v) => set('supported_crops', v)} />
          {err('crops') && <span className="error" role="alert">{err('crops')}</span>}
        </div>
        {f.supported_crops.includes('other') && (
          <Field label={t('otherCrop')} error={err('other')}>
            <input value={f.other_crop_name} maxLength={60} onChange={(e) => set('other_crop_name', e.target.value)} />
          </Field>
        )}

        <div className="field">
          <span className="label">{t('pricing')}</span>
          <div className="chips">
            {PRICING.map((p) => (
              <button type="button" key={p.v} className={f.pricing_type === p.v ? 'chip on' : 'chip'}
                aria-pressed={f.pricing_type === p.v} onClick={() => set('pricing_type', p.v)}>{t(p.label)}</button>
            ))}
          </div>
        </div>
        <Field label={t(cur.price)} hint={t('priceEx')} error={err('price')}>
          <input type="number" inputMode="decimal" min="0" step="any" value={f.price} onChange={(e) => set('price', e.target.value)} />
        </Field>
        <Field label={t('service')} hint={t('serviceHelp')}>
          <input value={f.service_villages_text} maxLength={400} onChange={(e) => set('service_villages_text', e.target.value)} />
        </Field>

        <Field label={t('pin')} hint={t('pinHelp')} error={err('pin')}>
          <input type="password" inputMode="numeric" value={f.pin} maxLength={4} autoComplete="off"
            onChange={(e) => set('pin', e.target.value.replace(/\D/g, ''))} />
        </Field>

        {fail && <p className="banner error" role="alert">{fail}</p>}
        <button className="btn big primary" disabled={busy}>{busy ? t('adding') : t('addMachine')}</button>
      </form>
    </section>
  );
}
