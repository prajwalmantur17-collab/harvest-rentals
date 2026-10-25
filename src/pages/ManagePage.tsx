import { useState } from 'react';
import Field from '../components/Field';
import { useI18n } from '../i18n';
import { ApiError, manageListing } from '../lib/api';
import { isPin, normalizePhone } from '../lib/validation';

export default function ManagePage({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [until, setUntil] = useState('');
  const [errs, setErrs] = useState<{ phone?: string; pin?: string }>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (op: 'hide' | 'busy', date: string | null) => {
    const p = normalizePhone(phone);
    const e = { phone: p ? undefined : t('errPhone'), pin: isPin(pin) ? undefined : t('errPin') };
    setErrs(e); setMsg(null);
    if (!p || !isPin(pin) || (op === 'busy' && date === '')) return;
    setBusy(true);
    try {
      await manageListing(p, pin, op, date);
      setMsg({ ok: true, text: t('manageDone') });
    } catch (x) {
      const code = x instanceof ApiError ? x.code : 'failed';
      setMsg({ ok: false, text: code === 'wrong_pin' ? t('wrongPin') : code === 'rate_limited' ? t('tooMany')
        : code === 'not_configured' ? t('notConfigured') : t('manageFail') });
    } finally { setBusy(false); }
  };

  return (
    <section>
      <button className="linkbtn back" onClick={onBack}>← {t('back')}</button>
      <h2>{t('manageTitle')}</h2>
      <p className="note">{t('manageIntro')}</p>
      <div className="panel">
        <Field label={t('phone')} error={errs.phone}>
          <input type="tel" inputMode="tel" value={phone} maxLength={16} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label={t('pin')} error={errs.pin}>
          <input type="password" inputMode="numeric" value={pin} maxLength={4} autoComplete="off"
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
        </Field>
        <Field label={t('busyUntil')}>
          <input type="date" value={until} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setUntil(e.target.value)} />
        </Field>
        <button className="btn big primary" disabled={busy || !until} onClick={() => run('busy', until)}>{t('setBusy')}</button>
        <button className="btn big secondary" disabled={busy} onClick={() => run('busy', null)}>{t('setFree')}</button>
        <button className="btn big danger" disabled={busy} onClick={() => run('hide', null)}>{t('removeMine')}</button>
        {msg && <p className={msg.ok ? 'banner ok' : 'banner error'} role="alert">{msg.text}</p>}
      </div>
    </section>
  );
}
