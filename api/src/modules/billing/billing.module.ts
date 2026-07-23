import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { BillingController, PublicBillingController } from './billing.controller';
import { BillingSchedulerService } from './billing.scheduler';
import { BillingService } from './billing.service';

@Module({
  imports: [NotificationsModule],
  controllers: [BillingController, PublicBillingController],
  providers: [BillingService, BillingSchedulerService],
  exports: [BillingService],
})
export class BillingModule {}
