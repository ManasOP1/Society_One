import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  QUEUE_REPORTING,
  type RefreshReportingJob,
} from '../../infrastructure/queue/queue.constants';
import { ReportingService } from './reporting.service';

@Processor(QUEUE_REPORTING)
export class ReportingProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportingProcessor.name);

  constructor(private readonly reporting: ReportingService) {
    super();
  }

  async process(job: Job<RefreshReportingJob>) {
    this.logger.log(
      `Refreshing reporting caches society=${job.data.societyId ?? 'all'}`,
    );
    await this.reporting.refreshNow(job.data.societyId);
    return { ok: true };
  }
}
