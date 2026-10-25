export const CROPS = ['paddy', 'wheat', 'maize', 'sugarcane', 'soybean', 'jowar', 'ragi', 'other'] as const;
export type CropKey = (typeof CROPS)[number];
export type PricingType = 'per_acre' | 'per_hour' | 'per_day';

export interface Machine {
  id: string;
  owner_name: string;
  owner_phone: string;
  owner_village: string;
  owner_district: string;
  machine_name: string;
  machine_photo_url: string | null;
  supported_crops: CropKey[];
  other_crop_name: string | null;
  service_villages: string[];
  pricing_type: PricingType;
  price: number;
  is_active: boolean;
  busy_until: string | null;
  created_at: string;
  updated_at: string;
}

export type MatchLevel = 'village' | 'district';
export type MachineResult = Machine & { match_level: MatchLevel };

export interface OwnerFormData {
  owner_name: string;
  owner_phone: string;
  owner_village: string;
  owner_district: string;
  machine_name: string;
  supported_crops: CropKey[];
  other_crop_name: string;
  service_villages_text: string;
  pricing_type: PricingType;
  price: string;
  pin: string;
}
