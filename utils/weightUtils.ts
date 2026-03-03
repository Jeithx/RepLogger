export type WeightUnit = 'kg' | 'lbs';

const LBS_PER_KG = 2.20462;

export function kgToDisplay(kg: number, unit: WeightUnit): number {
  if (unit === 'lbs') return Math.round(kg * LBS_PER_KG * 10) / 10;
  return Math.round(kg * 10) / 10;
}

export function displayToKg(value: number, unit: WeightUnit): number {
  if (unit === 'lbs') return Math.round((value / LBS_PER_KG) * 1000) / 1000;
  return value;
}

export function formatWeight(kg: number, unit: WeightUnit): string {
  return `${kgToDisplay(kg, unit)} ${unit}`;
}

export function formatVolume(volumeKg: number, unit: WeightUnit): string {
  const vol = unit === 'lbs' ? volumeKg * LBS_PER_KG : volumeKg;
  if (vol >= 1000) return `${(vol / 1000).toFixed(1)}k ${unit}`;
  return `${Math.round(vol)} ${unit}`;
}
