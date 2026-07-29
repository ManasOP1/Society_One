import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { QUEUE_NOTIFICATIONS, QUEUE_PDF } from '../../infrastructure/queue/queue.constants';
import { ReportingModule } from '../reporting/reporting.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_PDF }, { name: QUEUE_NOTIFICATIONS }),
    ReportingModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
