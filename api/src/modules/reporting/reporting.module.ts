import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUE_REPORTING } from '../../infrastructure/queue/queue.constants';
import { ReportingProcessor } from './reporting.processor';
import { ReportingService } from './reporting.service';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_REPORTING })],
  providers: [ReportingService, ReportingProcessor],
  exports: [ReportingService],
})
export class ReportingModule {}
