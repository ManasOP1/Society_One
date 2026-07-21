import { Global, Module } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { DocumentPdfJobsService } from './document-pdf-jobs.service';

@Global()
@Module({
  providers: [PdfService, DocumentPdfJobsService],
  exports: [PdfService, DocumentPdfJobsService],
})
export class PdfModule {}
