import { supabase } from './supabase';
import { normalizePhone, parseServiceVillages } from './validation';
import type { CropKey, MachineResult, OwnerFormData } from '../types';

export class ApiError extends Error {
  constructor(public code: 'not_configured' | 'rate_limited' | 'wrong_pin' | 'failed', message = '') { super(message || code); }
}

export async function searchMachines(village: string, crop: CropKey, district: string, needed: string): Promise<MachineResult[]> {
  if (!supabase) throw new ApiError('not_configured');
  const { data, error } = await supabase.rpc('search_machines', {
    p_village: village, p_crop: crop, p_district: district.trim() || null, p_needed: needed || null,
  });
  if (error) throw new ApiError('failed', error.message);
  return (data ?? []) as MachineResult[];
}

async function callFunction(payload: Record<string, unknown>, photo: File | null): Promise<void> {
  if (!supabase) throw new ApiError('not_configured');
  const body = new FormData();
  body.append('payload', JSON.stringify(payload));
  if (photo) body.append('photo', photo);
  const { error } = await supabase.functions.invoke('submit-machine', { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const status = ctx && typeof ctx.status === 'number' ? ctx.status : 0;
    throw new ApiError(status === 429 ? 'rate_limited' : status === 403 ? 'wrong_pin' : 'failed', error.message);
  }
}

/** op 'hide' removes all of this owner's listings; 'busy' sets (or clears, with null) the busy-until date. */
export const manageListing = (phone: string, pin: string, op: 'hide' | 'busy', busyUntil: string | null) =>
  callFunction({ action: 'manage', owner_phone: phone, pin, op, busy_until: busyUntil }, null);

export async function submitMachine(f: OwnerFormData, photo: File | null): Promise<void> {
  await callFunction({
    action: 'create',
    owner_name: f.owner_name, owner_phone: normalizePhone(f.owner_phone), owner_village: f.owner_village,
    owner_district: f.owner_district, machine_name: f.machine_name, supported_crops: f.supported_crops,
    other_crop_name: f.supported_crops.includes('other') ? f.other_crop_name : null,
    service_villages: parseServiceVillages(f.service_villages_text),
    pricing_type: f.pricing_type, price: Number(f.price), pin: f.pin,
  }, photo);
}

export async function reportMachine(machineId: string): Promise<void> {
  if (!supabase) throw new ApiError('not_configured');
  const { error } = await supabase.from('reports').insert({ machine_id: machineId, reason: 'incorrect' });
  if (error) throw new ApiError('failed', error.message);
}
