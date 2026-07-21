import { Injectable } from '@nestjs/common';
import { Prisma, SocietySettings, Society } from '@prisma/client';
import { AuthUser } from '../../common/decorators/auth.decorators';
import { toNumber } from '../../common/utils/decimal.util';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BillingService } from '../billing/billing.service';

type SettingsWithSociety = SocietySettings & { society?: Society };

export type UpdateSettingsInput = {
  societyName?: string;
  address?: string;
  registrationNo?: string | null;
  panNumber?: string | null;
  logoText?: string;
  logoUrl?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  bankIfsc?: string | null;
  upiId?: string | null;
  invoicePrefix?: string;
  receiptPrefix?: string;
  maintenanceAmount?: number;
  maintenanceAmount1Bhk?: number;
  maintenanceAmount2Bhk?: number;
  maintenanceAmount3Bhk?: number;
  lateFeeAmount?: number;
  dueDay?: number;
  municipalDues?: number;
  adminExpenses?: number;
  sinkingFunds?: number;
  buildingMaintenance?: number;
  parkingCharges?: number;
  nonOccupancyCharges?: number;
  gstNote?: string | null;
  interestNote?: string | null;
  razorpayKeyId?: string | null;
};

function serializeSettings(s: SettingsWithSociety) {
  const { society, ...rest } = s;
  return {
    ...rest,
    // Mobile/admin clients need society branding alongside billing settings —
    // these live on the Society row, joined in here for convenience.
    societyName: society?.name ?? '',
    address: society?.address ?? '',
    registrationNo: society?.registrationNo ?? '',
    panNumber: society?.panNumber ?? '',
    // `logoDataUrl` alias kept for the mobile app's existing field name.
    logoDataUrl: s.logoUrl ?? '',
    maintenanceAmount: toNumber(s.maintenanceAmount),
    maintenanceAmount1Bhk: toNumber(s.maintenanceAmount1Bhk),
    maintenanceAmount2Bhk: toNumber(s.maintenanceAmount2Bhk),
    maintenanceAmount3Bhk: toNumber(s.maintenanceAmount3Bhk),
    lateFeeAmount: toNumber(s.lateFeeAmount),
    municipalDues: toNumber(s.municipalDues),
    adminExpenses: toNumber(s.adminExpenses),
    sinkingFunds: toNumber(s.sinkingFunds),
    buildingMaintenance: toNumber(s.buildingMaintenance),
    parkingCharges: toNumber(s.parkingCharges),
    nonOccupancyCharges: toNumber(s.nonOccupancyCharges),
  };
}

const MAINTENANCE_RULE_KEYS: (keyof UpdateSettingsInput)[] = [
  'maintenanceAmount',
  'maintenanceAmount1Bhk',
  'maintenanceAmount2Bhk',
  'maintenanceAmount3Bhk',
  'lateFeeAmount',
  'dueDay',
  'municipalDues',
  'adminExpenses',
  'sinkingFunds',
  'buildingMaintenance',
  'parkingCharges',
  'nonOccupancyCharges',
  'gstNote',
];

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly billing: BillingService,
  ) {}

  async get(societyId: string) {
    let settings = await this.prisma.societySettings.findUnique({
      where: { societyId },
      include: { society: true },
    });
    if (!settings) {
      const tenantId = await this.prisma.getSocietyTenantId(societyId);
      settings = await this.prisma.societySettings.create({
        data: { societyId, tenantId },
        include: { society: true },
      });
    }
    return serializeSettings(settings);
  }

  async update(societyId: string, input: UpdateSettingsInput, actor: AuthUser) {
    await this.get(societyId);

    const societyPatch: Prisma.SocietyUpdateInput = {};
    if (input.societyName !== undefined) societyPatch.name = input.societyName.trim();
    if (input.address !== undefined) societyPatch.address = input.address.trim();
    if (input.registrationNo !== undefined) societyPatch.registrationNo = input.registrationNo;
    if (input.panNumber !== undefined) societyPatch.panNumber = input.panNumber;
    if (Object.keys(societyPatch).length > 0) {
      await this.prisma.society.update({
        where: { id: societyId },
        data: societyPatch,
      });
    }

    const data: Prisma.SocietySettingsUpdateInput = {};
    if (input.logoText !== undefined) data.logoText = input.logoText;
    if (input.logoUrl !== undefined) data.logoUrl = input.logoUrl;
    if (input.bankName !== undefined) data.bankName = input.bankName;
    if (input.bankAccount !== undefined) data.bankAccount = input.bankAccount;
    if (input.bankIfsc !== undefined) data.bankIfsc = input.bankIfsc;
    if (input.upiId !== undefined) data.upiId = input.upiId;
    if (input.invoicePrefix !== undefined) data.invoicePrefix = input.invoicePrefix;
    if (input.receiptPrefix !== undefined) data.receiptPrefix = input.receiptPrefix;
    if (input.maintenanceAmount !== undefined) {
      data.maintenanceAmount = input.maintenanceAmount;
    }
    if (input.maintenanceAmount1Bhk !== undefined) {
      data.maintenanceAmount1Bhk = input.maintenanceAmount1Bhk;
    }
    if (input.maintenanceAmount2Bhk !== undefined) {
      data.maintenanceAmount2Bhk = input.maintenanceAmount2Bhk;
    }
    if (input.maintenanceAmount3Bhk !== undefined) {
      data.maintenanceAmount3Bhk = input.maintenanceAmount3Bhk;
    }
    if (input.lateFeeAmount !== undefined) data.lateFeeAmount = input.lateFeeAmount;
    if (input.dueDay !== undefined) data.dueDay = input.dueDay;
    if (input.municipalDues !== undefined) data.municipalDues = input.municipalDues;
    if (input.adminExpenses !== undefined) data.adminExpenses = input.adminExpenses;
    if (input.sinkingFunds !== undefined) data.sinkingFunds = input.sinkingFunds;
    if (input.buildingMaintenance !== undefined) {
      data.buildingMaintenance = input.buildingMaintenance;
    }
    if (input.parkingCharges !== undefined) data.parkingCharges = input.parkingCharges;
    if (input.nonOccupancyCharges !== undefined) {
      data.nonOccupancyCharges = input.nonOccupancyCharges;
    }
    if (input.gstNote !== undefined) data.gstNote = input.gstNote;
    if (input.interestNote !== undefined) data.interestNote = input.interestNote;
    if (input.razorpayKeyId !== undefined) data.razorpayKeyId = input.razorpayKeyId;

    const settings = await this.prisma.societySettings.update({
      where: { societyId },
      data,
      include: { society: true },
    });

    await this.audit.log({
      societyId,
      actorId: actor.id,
      action: 'SETTINGS_UPDATED',
      entityType: 'SocietySettings',
      entityId: settings.id,
    });

    let invoicesSynced = 0;
    const rulesChanged = MAINTENANCE_RULE_KEYS.some((key) => input[key] !== undefined);
    if (rulesChanged) {
      await this.syncFlatMaintenanceFromSettings(societyId, settings);
      invoicesSynced = await this.billing.syncOpenInvoicesFromSettings(societyId);
    }

    return {
      ...serializeSettings(settings),
      invoicesSynced,
    };
  }

  /** Push BHK default amounts from society settings onto matching flats. */
  private async syncFlatMaintenanceFromSettings(
    societyId: string,
    settings: SocietySettings,
  ): Promise<void> {
    const bhkAmounts: { bhkType: 'ONE_BHK' | 'TWO_BHK' | 'THREE_BHK'; amount: number }[] = [
      { bhkType: 'ONE_BHK', amount: toNumber(settings.maintenanceAmount1Bhk) },
      { bhkType: 'TWO_BHK', amount: toNumber(settings.maintenanceAmount2Bhk) },
      { bhkType: 'THREE_BHK', amount: toNumber(settings.maintenanceAmount3Bhk) },
    ];

    for (const { bhkType, amount } of bhkAmounts) {
      await this.prisma.flat.updateMany({
        where: { societyId, bhkType, deletedAt: null },
        data: { maintenanceAmount: amount },
      });
    }
  }
}
