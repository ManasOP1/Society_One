import { SocietySettings } from '@prisma/client';
import { toNumber } from '../utils/decimal.util';

export const BHK_TYPES = ['ONE_BHK', 'TWO_BHK', 'THREE_BHK'] as const;
export type BhkType = (typeof BHK_TYPES)[number];

export const BHK_LABELS: Record<BhkType, string> = {
  ONE_BHK: '1 BHK',
  TWO_BHK: '2 BHK',
  THREE_BHK: '3 BHK',
};

export function isBhkType(value: string): value is BhkType {
  return (BHK_TYPES as readonly string[]).includes(value);
}

export function defaultMaintenanceForBhk(
  settings: SocietySettings,
  bhkType?: string | null,
): number | undefined {
  if (!bhkType) return undefined;
  if (bhkType === 'ONE_BHK') return toNumber(settings.maintenanceAmount1Bhk);
  if (bhkType === 'TWO_BHK') return toNumber(settings.maintenanceAmount2Bhk);
  if (bhkType === 'THREE_BHK') return toNumber(settings.maintenanceAmount3Bhk);
  return undefined;
}

export function resolveFlatMaintenanceAmount(
  settings: SocietySettings,
  flat: { maintenanceAmount?: unknown; bhkType?: string | null } | null | undefined,
): number {
  if (flat?.maintenanceAmount != null) {
    return toNumber(flat.maintenanceAmount as { toString(): string });
  }
  const bhkDefault = defaultMaintenanceForBhk(settings, flat?.bhkType);
  if (bhkDefault != null && bhkDefault > 0) return bhkDefault;
  return toNumber(settings.maintenanceAmount);
}
