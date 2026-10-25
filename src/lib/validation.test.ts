import { describe, expect, it } from 'vitest';
import { estimateCost, normalizePhone, normalizeText, parseServiceVillages, validateOwner } from './validation';
import type { OwnerFormData } from '../types';

const ok: OwnerFormData = {
  owner_name: 'Ramesh', owner_phone: '9876543210', owner_village: 'Hosur', owner_district: 'Mandya',
  machine_name: 'Paddy Harvester', supported_crops: ['paddy'], other_crop_name: '',
  service_villages_text: '', pricing_type: 'per_acre', price: '1500', pin: '1234',
};

describe('validation', () => {
  it('normalizes village text', () => expect(normalizeText('  Hosur   Kote ')).toBe('hosur kote'));
  it('normalizes phones', () => {
    expect(normalizePhone('+91 98765 43210')).toBe('9876543210');
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('5876543210')).toBeNull();
  });
  it('dedupes service villages', () => expect(parseServiceVillages('A, a ,B\nb')).toEqual(['A', 'B']));
  it('estimates per-acre only', () => {
    expect(estimateCost({ pricing_type: 'per_acre', price: 1500 }, 3)).toBe(4500);
    expect(estimateCost({ pricing_type: 'per_hour', price: 800 }, 3)).toBeNull();
    expect(estimateCost({ pricing_type: 'per_day', price: 5000 }, 3)).toBeNull();
  });
  it('accepts valid owner form', () => expect(validateOwner(ok, null)).toEqual({}));
  it('rejects bad owner form', () => {
    const e = validateOwner({ ...ok, owner_phone: '1', price: '0', supported_crops: [] }, null);
    expect(e.owner_phone).toBe('errPhone');
    expect(e.price).toBe('errPrice');
    expect(e.crops).toBe('errCrops');
  });
  it('requires a 4-digit PIN', () => {
    expect(validateOwner({ ...ok, pin: '12' }, null).pin).toBe('errPin');
    expect(validateOwner({ ...ok, pin: 'abcd' }, null).pin).toBe('errPin');
  });
  it('requires other crop name', () =>
    expect(validateOwner({ ...ok, supported_crops: ['other'] }, null).other).toBe('errOther'));
  it('rejects wrong photo type/size', () => {
    expect(validateOwner(ok, new File(['x'], 'a.gif', { type: 'image/gif' })).photo).toBe('errImgType');
    const big = { type: 'image/png', size: 4 * 1024 * 1024 } as File;
    expect(validateOwner(ok, big).photo).toBe('errImgSize');
  });
});
