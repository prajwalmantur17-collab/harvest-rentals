// Controlled public submission: validates, rate-limits, uploads the photo, inserts the listing.
// Uses the service-role key that Supabase injects into Edge Functions. It never reaches the browser.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CROPS = ['paddy', 'wheat', 'maize', 'sugarcane', 'soybean', 'jowar', 'ragi', 'other'];
const PRICING = ['per_acre', 'per_hour', 'per_day'];
const MAX_PHOTO = 3 * 1024 * 1024;
const PER_IP_PER_HOUR = 5;
const GLOBAL_PER_HOUR = 300;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const clean = (v: unknown, max: number): string =>
  typeof v === 'string'
    ? v.normalize('NFC').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max)
    : '';

function sniffImage(b: Uint8Array): { ext: string; type: string } | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', type: 'image/jpeg' };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: 'png', type: 'image/png' };
  const tag = (o: number, s: string) => [...s].every((c, i) => b[o + i] === c.charCodeAt(0));
  if (tag(0, 'RIFF') && tag(8, 'WEBP')) return { ext: 'webp', type: 'image/webp' };
  return null;
}

async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  // 1. Parse
  // Count + record an attempt under a key; true if the key is over its hourly limit.
  const limited = async (key: string, max: number): Promise<boolean> => {
    const since = new Date(Date.now() - 3600_000).toISOString();
    const r = await db.from('submission_log').select('id', { count: 'exact', head: true }).eq('ip_hash', key).gte('created_at', since);
    if (r.error || (r.count ?? 0) >= max) return true;
    await db.from('submission_log').insert({ ip_hash: key });
    return false;
  };
  const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  const salt = Deno.env.get('RATE_SALT') ?? 'hr';
  const ipHash = await sha256(ip + salt);
  const pinHash = (phone: string, pin: string) => sha256(`${phone}:${pin}:${salt}`);
  const normPhone = (v: unknown) => clean(v, 20).replace(/[\s-]/g, '').replace(/^(\+91|91|0)(?=\d{10}$)/, '');

  let raw: Record<string, unknown>;
  let photo: File | null = null;
  try {
    const form = await req.formData();
    raw = JSON.parse(String(form.get('payload') ?? '{}'));
    const p = form.get('photo');
    if (p instanceof File && p.size > 0) photo = p;
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  // 2. Validate (mirrors the client; the database re-checks everything too)
  // Owner management: remove listings or set busy-until, proven by phone + 4-digit PIN.
  if (raw.action === 'manage') {
    const phone = normPhone(raw.owner_phone);
    const pin = String(raw.pin ?? '');
    if (!/^[6-9]\d{9}$/.test(phone) || !/^\d{4}$/.test(pin)) return json({ error: 'invalid' }, 400);
    if ((await limited('m:' + ipHash, 10)) || (await limited('p:' + (await sha256(phone)), 10))) return json({ error: 'rate_limited' }, 429);
    const hash = await pinHash(phone, pin);
    let patch: Record<string, unknown>;
    if (raw.op === 'hide') patch = { is_active: false };
    else if (raw.op === 'busy') {
      const d = raw.busy_until === null ? null : String(raw.busy_until);
      if (d !== null && !/^\d{4}-\d{2}-\d{2}$/.test(d)) return json({ error: 'invalid' }, 400);
      patch = { busy_until: d };
    } else return json({ error: 'invalid' }, 400);
    const up = await db.from('machines').update(patch).eq('owner_phone', phone).eq('pin_hash', hash).select('id');
    if (up.error) return json({ error: 'server_error' }, 500);
    if (!up.data || up.data.length === 0) return json({ error: 'wrong_pin' }, 403);
    return json({ updated: up.data.length });
  }

  const phoneDigits = normPhone(raw.owner_phone);
  const crops = Array.isArray(raw.supported_crops)
    ? [...new Set(raw.supported_crops.filter((c): c is string => typeof c === 'string' && CROPS.includes(c)))]
    : [];
  const villages = Array.isArray(raw.service_villages)
    ? [...new Set(raw.service_villages.map((v) => clean(v, 80)).filter((v) => v.length >= 2))].slice(0, 20)
    : [];
  const price = Number(raw.price);
  const row = {
    owner_name: clean(raw.owner_name, 80),
    owner_phone: phoneDigits,
    owner_village: clean(raw.owner_village, 80),
    owner_district: clean(raw.owner_district, 80),
    machine_name: clean(raw.machine_name, 80),
    supported_crops: crops,
    other_crop_name: crops.includes('other') ? clean(raw.other_crop_name, 60) : null,
    service_villages: villages,
    pricing_type: String(raw.pricing_type),
    price,
    machine_photo_url: null as string | null,
    pin_hash: '',
  };
  const pin = String(raw.pin ?? '');
  const bad: string[] = [];
  if (row.owner_name.length < 2) bad.push('owner_name');
  if (!/^[6-9]\d{9}$/.test(row.owner_phone)) bad.push('owner_phone');
  if (row.owner_village.length < 2) bad.push('owner_village');
  if (row.owner_district.length < 2) bad.push('owner_district');
  if (row.machine_name.length < 2) bad.push('machine_name');
  if (crops.length === 0) bad.push('supported_crops');
  if (crops.includes('other') && (row.other_crop_name ?? '').length < 2) bad.push('other_crop_name');
  if (!/^\d{4}$/.test(pin)) bad.push('pin');
  if (!PRICING.includes(row.pricing_type)) bad.push('pricing_type');
  if (!Number.isFinite(price) || price <= 0 || price > 1_000_000) bad.push('price');
  let img: { ext: string; type: string } | null = null;
  let bytes: Uint8Array | null = null;
  if (photo) {
    if (photo.size > MAX_PHOTO) bad.push('photo_size');
    else {
      bytes = new Uint8Array(await photo.arrayBuffer());
      img = sniffImage(bytes);
      if (!img) bad.push('photo_type');
    }
  }
  if (bad.length) return json({ error: 'invalid', fields: bad }, 400);

  // 3. Rate limit (per hashed IP + a global ceiling)
  const since = new Date(Date.now() - 3600_000).toISOString();
  const all = await db.from('submission_log').select('id', { count: 'exact', head: true }).gte('created_at', since);
  if (all.error) return json({ error: 'server_error' }, 500);
  if ((all.count ?? 0) >= GLOBAL_PER_HOUR || (await limited(ipHash, PER_IP_PER_HOUR))) return json({ error: 'rate_limited' }, 429);
  row.pin_hash = await pinHash(row.owner_phone, pin);

  let path: string | null = null;
  if (bytes && img) {
    path = `${crypto.randomUUID()}.${img.ext}`;
    const up = await db.storage.from('machine-photos').upload(path, bytes, { contentType: img.type, upsert: false });
    if (up.error) return json({ error: 'upload_failed' }, 500);
    row.machine_photo_url = db.storage.from('machine-photos').getPublicUrl(path).data.publicUrl;
  }

  // 5. Insert; if it fails, remove the uploaded photo so nothing is left half-done
  const ins = await db.from('machines').insert(row).select('id').single();
  if (ins.error) {
    if (path) await db.storage.from('machine-photos').remove([path]);
    return json({ error: 'insert_failed' }, 500);
  }
  return json({ id: ins.data.id }, 201);
});
