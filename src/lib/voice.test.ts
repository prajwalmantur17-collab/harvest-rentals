import { describe, expect, it } from 'vitest';
import { parseVoice } from './voice';

describe('parseVoice', () => {
  it('parses English', () =>
    expect(parseVoice('Hosur, paddy, 3 acres')).toEqual({ village: 'hosur', crop: 'paddy', acres: '3' }));
  it('does not treat a village containing a crop word as a crop', () =>
    expect(parseVoice('Ragihalli wheat 2.5 acres')).toEqual({ village: 'ragihalli', crop: 'wheat', acres: '2.5' }));
  it('parses Kannada crop and acres words', () =>
    expect(parseVoice('ಹೊಸೂರು ಭತ್ತ 4 ಎಕರೆ')).toEqual({ village: 'ಹೊಸೂರು', crop: 'paddy', acres: '4' }));
  it('handles missing parts', () => expect(parseVoice('Indi')).toEqual({ village: 'indi', crop: undefined, acres: undefined }));
});
