import type { BhkType } from "@/data/societies";
import type { SocietySettings } from "@/types";

export const BHK_OPTIONS: { value: BhkType; label: string }[] = [
  { value: "ONE_BHK", label: "1 BHK" },
  { value: "TWO_BHK", label: "2 BHK" },
  { value: "THREE_BHK", label: "3 BHK" },
];

export function bhkLabel(bhkType?: BhkType): string {
  return BHK_OPTIONS.find((o) => o.value === bhkType)?.label ?? "—";
}

export function defaultAmountForBhk(
  settings: SocietySettings | null | undefined,
  bhkType?: BhkType
): number {
  if (!settings || !bhkType) return settings?.maintenanceAmount ?? 0;
  if (bhkType === "ONE_BHK") {
    return settings.maintenanceAmount1Bhk || settings.maintenanceAmount;
  }
  if (bhkType === "TWO_BHK") {
    return settings.maintenanceAmount2Bhk || settings.maintenanceAmount;
  }
  return settings.maintenanceAmount3Bhk || settings.maintenanceAmount;
}
