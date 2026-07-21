import { Inject, Injectable, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  NotificationChannel,
  NotificationStatus,
} from '../../common/types/roles';
import {
  NotificationJob,
  QUEUE_NOTIFICATIONS,
} from '../../infrastructure/queue/queue.constants';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export type QueueNotificationInput = {
  societyId: string;
  channel: 'EMAIL' | 'WHATSAPP';
  recipient: string;
  subject?: string;
  body: string;
  metadata?: Record<string, unknown>;
};

type QueueLike = {
  add: (name: string, data: NotificationJob) => Promise<unknown>;
};

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(QUEUE_NOTIFICATIONS)
    private readonly queue?: QueueLike,
  ) {}

  /** Create a Notification row and optionally enqueue for worker processing. */
  async queueNotification(input: QueueNotificationInput) {
    const channel =
      input.channel === 'EMAIL'
        ? NotificationChannel.EMAIL
        : NotificationChannel.WHATSAPP;
    const tenantId = await this.prisma.getSocietyTenantId(input.societyId);

    const log = await this.prisma.notification.create({
      data: {
        tenantId,
        societyId: input.societyId,
        channelCode: channel,
        recipient: input.recipient,
        subject: input.subject,
        body: input.body,
        statusCode: NotificationStatus.QUEUED,
        metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });

    if (this.queue) {
      await this.queue.add('send', {
        societyId: input.societyId,
        channel: input.channel,
        recipient: input.recipient,
        subject: input.subject,
        body: input.body,
        metadata: { ...input.metadata, notificationId: log.id },
      });
    }

    return log;
  }

  queueEmail(
    societyId: string,
    recipient: string,
    subject: string,
    body: string,
    metadata?: Record<string, unknown>,
  ) {
    return this.queueNotification({
      societyId,
      channel: 'EMAIL',
      recipient,
      subject,
      body,
      metadata,
    });
  }

  queueWhatsApp(
    societyId: string,
    recipient: string,
    body: string,
    metadata?: Record<string, unknown>,
  ) {
    return this.queueNotification({
      societyId,
      channel: 'WHATSAPP',
      recipient,
      body,
      metadata,
    });
  }

  listLogs(
    societyId: string,
    opts?: { channel?: NotificationChannel; take?: number; skip?: number },
  ) {
    return this.prisma.notification.findMany({
      where: {
        societyId,
        ...(opts?.channel ? { channelCode: opts.channel } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: opts?.take ?? 50,
      skip: opts?.skip ?? 0,
    });
  }
}
