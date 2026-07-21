import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { ConnectionOptions } from 'bullmq';
import {
  QUEUE_BILLING,
  QUEUE_NOTIFICATIONS,
  QUEUE_PDF,
  QUEUE_REMINDERS,
} from './queue.constants';
import { PdfProcessor } from './pdf.processor';
import { NotificationProcessor } from './notification.processor';
import { BillingProcessor, RemindersProcessor } from './billing.processor';

function redisConnection(config: ConfigService): ConnectionOptions {
  const url = config.get<string>('REDIS_URL');
  if (url) {
    return {
      url,
      maxRetriesPerRequest: null,
    };
  }

  const tls = config.get<boolean>('REDIS_TLS') ?? false;
  return {
    host: config.get<string>('REDIS_HOST') ?? '127.0.0.1',
    port: config.get<number>('REDIS_PORT') ?? 6379,
    password: config.get<string>('REDIS_PASSWORD') || undefined,
    ...(tls ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
  };
}

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: redisConnection(config),
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
