/**
 * Society settings — backed by GET/PATCH /society/settings on the Nest API.
 */

import { settingsApi, apiErrorMessage, notifyDataUpdated } from "@/lib/api-client";
import type { SocietySettings } from "@/types";
import { auditService } from "@/services/audit.service";
import { cacheKey, readAdminCache, writeAdminCache } from "@/lib/admin-cache";

const cache = new Map<string, SocietySettings>();

function defaultSettings(societyId: string): SocietySettings {
  return {
    societyId,
    societyName: "Society",
    address: "",
    logoText: "LOGO",
    logoDataUrl: "",
    registrationNo: "",
    panNumber: "",
    bankName: "",
    bankAccount: "",
    bankIfsc: "",
    upiId: "",
    invoicePrefix: "INV",
    receiptPrefix: "REC",
    maintenanceAmount: 0,
    maintenanceAmount1Bhk: 0,
    maintenanceAmount2Bhk: 0,
    maintenanceAmount3Bhk: 0,
    lateFeeAmount: 500,
    dueDay: 10,
    gstNote: "",
    municipalDues: 0,
    adminExpenses: 0,
    sinkingFunds: 0,
    buildingMaintenance: 0,
    parkingCharges: 0,
    nonOccupancyCharges: 0,
    interestNote: "",
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapApiSettings(raw: any, societyId: string): SocietySettings {
  return {
    societyId,
    societyName: String(raw?.societyName ?? "Society"),
    address: String(raw?.address ?? ""),
    logoText: String(raw?.logoText ?? "LOGO"),
    logoDataUrl: String(raw?.logoDataUrl ?? raw?.logoUrl ?? ""),
    registrationNo: String(raw?.registrationNo ?? ""),
    panNumber: String(raw?.panNumber ?? ""),
    bankName: String(raw?.bankName ?? ""),
    bankAccount: String(raw?.bankAccount ?? ""),
    bankIfsc: String(raw?.bankIfsc ?? ""),
    upiId: String(raw?.upiId ?? ""),
    invoicePrefix: String(raw?.invoicePrefix ?? "INV"),
    receiptPrefix: String(raw?.receiptPrefix ?? "REC"),
    maintenanceAmount: Number(raw?.maintenanceAmount) || 0,
    maintenanceAmount1Bhk: Number(raw?.maintenanceAmount1Bhk) || 0,
    maintenanceAmount2Bhk: Number(raw?.maintenanceAmount2Bhk) || 0,
    maintenanceAmount3Bhk: Number(raw?.maintenanceAmount3Bhk) || 0,
    lateFeeAmount: Number(raw?.lateFeeAmount) || 0,
    dueDay: Number(raw?.dueDay) || 10,
    gstNote: String(raw?.gstNote ?? ""),
    municipalDues: Number(raw?.municipalDues) || 0,
    adminExpenses: Number(raw?.adminExpenses) || 0,
    sinkingFunds: Number(raw?.sinkingFunds) || 0,
    buildingMaintenance: Number(raw?.buildingMaintenance) || 0,
    parkingCharges: Number(raw?.parkingCharges) || 0,
    nonOccupancyCharges: Number(raw?.nonOccupancyCharges) || 0,
    interestNote: String(raw?.interestNote ?? ""),
  };
}

function toApiPatch(patch: Partial<SocietySettings>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (patch.societyName !== undefined) body.societyName = patch.societyName;
  if (patch.address !== undefined) body.address = patch.address;
  if (patch.registrationNo !== undefined) body.registrationNo = patch.registrationNo;
  if (patch.panNumber !== undefined) body.panNumber = patch.panNumber;
  if (patch.logoText !== undefined) body.logoText = patch.logoText;
  if (patch.logoDataUrl !== undefined) body.logoUrl = patch.logoDataUrl || null;
  if (patch.bankName !== undefined) body.bankName = patch.bankName;
  if (patch.bankAccount !== undefined) body.bankAccount = patch.bankAccount;
  if (patch.bankIfsc !== undefined) body.bankIfsc = patch.bankIfsc;
  if (patch.upiId !== undefined) body.upiId = patch.upiId;
  if (patch.invoicePrefix !== undefined) body.invoicePrefix = patch.invoicePrefix;
  if (patch.receiptPrefix !== undefined) body.receiptPrefix = patch.receiptPrefix;
  if (patch.maintenanceAmount !== undefined) body.maintenanceAmount = patch.maintenanceAmount;
  if (patch.maintenanceAmount1Bhk !== undefined) {
    body.maintenanceAmount1Bhk = patch.maintenanceAmount1Bhk;
  }
  if (patch.maintenanceAmount2Bhk !== undefined) {
    body.maintenanceAmount2Bhk = patch.maintenanceAmount2Bhk;
  }
  if (patch.maintenanceAmount3Bhk !== undefined) {
    body.maintenanceAmount3Bhk = patch.maintenanceAmount3Bhk;
  }
  if (patch.lateFeeAmount !== undefined) body.lateFeeAmount = patch.lateFeeAmount;
  if (patch.dueDay !== undefined) body.dueDay = patch.dueDay;
  if (patch.gstNote !== undefined) body.gstNote = patch.gstNote;
  if (patch.municipalDues !== undefined) body.municipalDues = patch.municipalDues;
  if (patch.adminExpenses !== undefined) body.adminExpenses = patch.adminExpenses;
  if (patch.sinkingFunds !== undefined) body.sinkingFunds = patch.sinkingFunds;
  if (patch.buildingMaintenance !== undefined) body.buildingMaintenance = patch.buildingMaintenance;
  if (patch.parkingCharges !== undefined) body.parkingCharges = patch.parkingCharges;
  if (patch.nonOccupancyCharges !== undefined) body.nonOccupancyCharges = patch.nonOccupancyCharges;
  if (patch.interestNote !== undefined) body.interestNote = patch.interestNote;
  return body;
}

export type SettingsUpdateResult = SocietySettings & { invoicesSynced?: number };

export const settingsService = {
  /** Last fetched settings, or safe defaults for sync callers (invoices, receipts). */
  get(societyId: string): SocietySettings {
    if (!cache.has(societyId)) {
      const persisted = readAdminCache<SocietySettings>(cacheKey("settings", societyId));
      if (persisted) cache.set(societyId, persisted);
    }
    return cache.get(societyId) ?? defaultSettings(societyId);
  },

  async fetch(societyId: string, opts?: { silent?: boolean }): Promise<SocietySettings> {
    try {
      const raw = await settingsApi.get(societyId);
      const mapped = mapApiSettings(raw, societyId);
      cache.set(societyId, mapped);
      writeAdminCache(cacheKey("settings", societyId), mapped);
      if (!opts?.silent) notifyDataUpdated("settings");
      return mapped;
    } catch (e) {
      throw new Error(apiErrorMessage(e));
    }
  },

  async update(
    societyId: string,
    patch: Partial<SocietySettings>,
    actor: string
  ): Promise<SettingsUpdateResult> {
    try {
      const raw = await settingsApi.update(toApiPatch(patch), societyId);
      auditService.log({
        societyId,
        action: "Settings Updated",
        entityType: "settings",
        entityId: societyId,
        details: "Society settings saved",
        actor,
      });
      const mapped = mapApiSettings(raw, societyId);
      cache.set(societyId, mapped);
      writeAdminCache(cacheKey("settings", societyId), mapped);
      notifyDataUpdated("settings");
      return {
        ...mapped,
        invoicesSynced: Number(raw?.invoicesSynced) || 0,
      };
    } catch (e) {
      throw new Error(apiErrorMessage(e));
    }
  },
};
