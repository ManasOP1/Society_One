import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  QUEUE_BILLING,
  QUEUE_NOTIFICATIONS,
  QUEUE_PDF,
  QUEUE_REMINDERS,
} from './queue.constants';
import { PdfProcessor } from './pdf.processor';
import { NotificationProcessor } from './notification.processor';
import { BillingProcessor, RemindersProcessor } from './billing.processor';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST') ?? '127.0.0.1',
          port: config.get<number>('REDIS_PORT') ?? 6379,
          password: config.get<string>('REDIS_PASSWORD') || undefined,
        },
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUE_BILLING },
      { name: QUEUE_NOTIFICATIONS },
      { name: QUEUE_PDF },
      { name: QUEUE_REMINDERS },
    ),
  ],
  providers: [PdfProcessor, NotificationProcessor, BillingProcessor, RemindersProcessor],
  exports: [BullModule],
})
export class QueueModule {}
