import type { CropKey } from '../types';

const WORDS: Record<Exclude<CropKey, 'other'>, string[]> = {
  paddy: ['paddy', 'rice', 'ಭತ್ತ', 'ಅಕ್ಕಿ', 'धान', 'चावल'],
  wheat: ['wheat', 'ಗೋಧಿ', 'गेहूं', 'गेहूँ'],
  maize: ['maize', 'corn', 'ಮೆಕ್ಕೆಜೋಳ', 'मक्का'],
  sugarcane: ['sugarcane', 'ಕಬ್ಬು', 'गन्ना'],
  soybean: ['soybean', 'soya', 'ಸೋಯಾಬೀನ್', 'सोयाबीन'],
  jowar: ['jowar', 'sorghum', 'ಜೋಳ', 'ज्वार'],
  ragi: ['ragi', 'ರಾಗಿ', 'रागी'],
};

export interface VoiceResult { village: string; crop?: CropKey; acres?: string }

/** Turns "Hosur, paddy, 3 acres" (or the Kannada/Hindi equivalent) into form values. */
export function parseVoice(raw: string): VoiceResult {
  let s = raw.normalize('NFC').toLowerCase();
  let crop: CropKey | undefined;
  for (const [key, words] of Object.entries(WORDS) as [CropKey, string[]][]) {
    if (crop) break;
    for (const w of words) {
      const re = /^[a-z]+$/.test(w) ? new RegExp(`\\b${w}\\b`) : new RegExp(w);
      if (re.test(s)) { crop = key; s = s.replace(re, ' '); break; }
    }
  }
  let acres: string | undefined;
  const m = s.match(/(\d+(?:\.\d+)?)/);
  if (m) { acres = m[1]; s = s.replace(m[0], ' '); }
  s = s.replace(/acres?|ಎಕರೆ|एकड़|एकड|village|ಗ್ರಾಮ|गाँव|गांव|\b(in|at|for|of|need|and)\b|[,.]/g, ' ');
  return { village: s.replace(/\s+/g, ' ').trim(), crop, acres };
}
