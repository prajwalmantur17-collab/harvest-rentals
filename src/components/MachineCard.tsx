import { useState } from 'react';
import defaultImg from '../assets/default-machine.svg';
import { useI18n, type Dict } from '../i18n';
import { reportMachine } from '../lib/api';
import { estimateCost } from '../lib/validation';
import type { MachineResult } from '../types';

const inr = (n: number) => '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n);
const UNIT: Record<MachineResult['pricing_type'], keyof Dict> = { per_acre: 'unitAcre', per_hour: 'unitHour', per_day: 'unitDay' };
const today = () => new Date().toISOString().slice(0, 10);

export default function MachineCard({ m, acres }: { m: MachineResult; acres: number }) {
  const { t } = useI18n();
  const [report, setReport] = useState<'idle' | 'sent' | 'fail'>('idle');
  const est = estimateCost(m, acres);
  const busy = m.busy_until && m.busy_until >= today() ? m.busy_until : null;
  const crops = m.supported_crops
    .map((c) => (c === 'other' ? m.other_crop_name || t('crop_other') : t(`crop_${c}`)));

  const sendReport = async () => {
    try { await reportMachine(m.id); setReport('sent'); } catch { setReport('fail'); }
  };

  return (
    <article className="card">
      <div className="photo">
        <img src={m.machine_photo_url || defaultImg} alt={m.machine_name} loading="lazy"
          onError={(e) => { e.currentTarget.src = defaultImg; }} />
        <span className="tag forhire">{busy ? t('busyTag', { date: busy }) : t('forHire')}</span>
        <span className="tag pricetag">{inr(Number(m.price))} {t(UNIT[m.pricing_type])}</span>
      </div>
      <div className="body">
        <h3>{m.machine_name}</h3>
        <div className="crops">{crops.map((c) => <span key={c} className="crop">{c}</span>)}</div>
        <p>{m.owner_name} · {m.owner_village}{m.match_level === 'district' && <b className="near"> · {t('matchDistrict')}</b>}</p>
        <div className="estimate">
          {est !== null ? (
            <><b>{t('estimate', { acres })}: {inr(est)}</b><small>{t('estimateNote')}</small></>
          ) : <b>{t('contactPrice')}</b>}
        </div>
        <a className="btn big call" href={`tel:+91${m.owner_phone}`}>📞 {t('call')} · {m.owner_phone}</a>
        {report === 'idle' && <button className="linkbtn" onClick={sendReport}>{t('report')}</button>}
        {report === 'sent' && <small>{t('reported')}</small>}
        {report === 'fail' && <small className="error">{t('reportFail')}</small>}
      </div>
    </article>
  );
}
