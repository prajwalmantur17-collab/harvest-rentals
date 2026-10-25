import type { CropKey, Machine, OwnerFormData } from '../types';

export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export type ErrKey =
  | 'errRequired' | 'errPhone' | 'errPrice' | 'errCrops' | 'errOther'
  | 'errPin' | 'errImgType' | 'errImgSize' | 'errAcres' | 'errCrop';

/** Lowercase, trim and collapse spaces. Must match the SQL trigger in the migration. */
export const normalizeText = (s: string): string => s.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();

/** Returns a 10-digit Indian mobile number, or null if invalid. */
export function normalizePhone(s: string): string | null {
  const d = s.replace(/[\s-]/g, '').replace(/^(\+91|91|0)(?=\d{10}$)/, '');
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}

export function parseServiceVillages(s: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of s.split(/[,\n]/)) {
    const v = part.normalize('NFC').trim().replace(/\s+/g, ' ');
    const k = normalizeText(v);
    if (v && !seen.has(k)) { seen.add(k); out.push(v); }
  }
  return out.slice(0, 20);
}

/** Only per-acre prices can be estimated. Hours/days are never guessed. */
export function estimateCost(m: Pick<Machine, 'pricing_type' | 'price'>, acres: number): number | null {
  if (m.pricing_type !== 'per_acre' || !(acres > 0)) return null;
  return Math.round(acres * Number(m.price) * 100) / 100;
}

export type OwnerErrors = Partial<Record<
  'owner_name' | 'owner_phone' | 'owner_village' | 'owner_district' | 'machine_name' | 'crops' | 'other' | 'price' | 'photo' | 'pin',
  ErrKey>>;

export const isPin = (s: string): boolean => /^\d{4}$/.test(s);

export function validatePhoto(file: File | null): ErrKey | undefined {
  if (!file) return undefined;
  if (!PHOTO_TYPES.includes(file.type)) return 'errImgType';
  if (file.size > MAX_PHOTO_BYTES) return 'errImgSize';
  return undefined;
}

export function validateOwner(f: OwnerFormData, photo: File | null): OwnerErrors {
  const e: OwnerErrors = {};
  const len = (s: string) => s.trim().length;
  if (len(f.owner_name) < 2) e.owner_name = 'errRequired';
  if (!normalizePhone(f.owner_phone)) e.owner_phone = 'errPhone';
  if (len(f.owner_village) < 2) e.owner_village = 'errRequired';
  if (len(f.owner_district) < 2) e.owner_district = 'errRequired';
  if (len(f.machine_name) < 2) e.machine_name = 'errRequired';
  if (f.supported_crops.length === 0) e.crops = 'errCrops';
  if (f.supported_crops.includes('other' as CropKey) && len(f.other_crop_name) < 2) e.other = 'errOther';
  const p = Number(f.price);
  if (!f.price.trim() || !Number.isFinite(p) || p <= 0 || p > 1_000_000) e.price = 'errPrice';
  if (!isPin(f.pin)) e.pin = 'errPin';
  const pe = validatePhoto(photo);
  if (pe) e.photo = pe;
  return e;
}
