import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Role } from '../../common/types/roles';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { BillingService } from './billing.service';

/** Runs on the 1st of every month at 06:00 IST (00:30 UTC). */
@Injectable()
export class BillingSchedulerService {
  private readonly logger = new Logger(BillingSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
  ) {}

  @Cron('30 0 1 * *', { timeZone: 'UTC' })
  async generateMonthlyForAllSocieties() {
    const month = new Date().toISOString().slice(0, 7);
    const societies = await this.prisma.society.findMany({
      where: { deletedAt: null, statusCode: 'ACTIVE' },
      select: { id: true, name: true },
    });

    for (const society of societies) {
      try {
        const admin = await this.prisma.user.findFirst({
          where: {
            societyId: society.id,
            isActive: true,
            deletedAt: null,
            roles: { some: { roleCode: Role.SOCIETY_ADMIN, deletedAt: null } },
          },
          select: { id: true },
        });
        if (!admin) continue;

        await this.billing.generateMonthly(society.id, month, {
          id: admin.id,
          email: '',
          role: Role.SOCIETY_ADMIN,
          tenantId: null,
          societyId: society.id,
          memberId: null,
          name: 'System',
        });
      } catch (error) {
        this.logger.warn(
          `Monthly billing failed for ${society.id}: ${error instanceof Error ? error.message : 'unknown'}`,
        );
      }
    }
  }
}
