import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DocumentPdfJobsService } from '../pdf/document-pdf-jobs.service';
import { QUEUE_PDF, type PdfJob } from './queue.constants';

@Processor(QUEUE_PDF)
export class PdfProcessor extends WorkerHost {
  private readonly logger = new Logger(PdfProcessor.name);

  constructor(private readonly pdfJobs: DocumentPdfJobsService) {
    super();
  }

  async process(job: Job<PdfJob>) {
    this.logger.log(`PDF job ${job.id} type=${job.data.type}`);
    if (job.data.type === 'invoice') {
      await this.pdfJobs.generateAndStoreInvoicePdf(job.data.invoiceId);
      return;
    }
    await this.pdfJobs.generateAndStoreReceiptPdf(job.data.receiptId);
  }
}
