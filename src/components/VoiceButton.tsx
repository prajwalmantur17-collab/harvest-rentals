import { useState } from 'react';
import { useI18n, type Lang } from '../i18n';

interface Recognizer {
  lang: string; interimResults: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onerror: () => void; onend: () => void; start: () => void;
}
type Ctor = new () => Recognizer;
const LOCALE: Record<Lang, string> = { en: 'en-IN', kn: 'kn-IN', hi: 'hi-IN' };

function getCtor(): Ctor | undefined {
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/** Mic button using the browser's built-in speech recognition. Hidden if the browser lacks it. */
export default function VoiceButton({ onText }: { onText: (text: string) => void }) {
  const { lang, t } = useI18n();
  const [state, setState] = useState<'idle' | 'listening' | 'fail'>('idle');
  const Rec = getCtor();
  if (!Rec) return null;

  const start = () => {
    const r = new Rec();
    r.lang = LOCALE[lang];
    r.interimResults = false;
    let heard = false;
    r.onresult = (e) => { heard = true; onText(e.results[0][0].transcript); };
    r.onerror = () => setState('fail');
    r.onend = () => setState((s) => (s === 'fail' || !heard ? 'fail' : 'idle'));
    setState('listening');
    try { r.start(); } catch { setState('fail'); }
  };

  return (
    <div className="voice">
      <button type="button" className="btn big mint" onClick={start} disabled={state === 'listening'}>
        🎤 {state === 'listening' ? t('voiceListening') : t('voiceTap')}
      </button>
      <span className="hint">{t('voiceHint')}</span>
      {state === 'fail' && <span className="error" role="alert">{t('voiceFail')}</span>}
    </div>
  );
}
