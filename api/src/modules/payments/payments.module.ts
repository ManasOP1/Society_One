import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { QUEUE_NOTIFICATIONS, QUEUE_PDF } from '../../infrastructure/queue/queue.constants';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_PDF }, { name: QUEUE_NOTIFICATIONS }),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
