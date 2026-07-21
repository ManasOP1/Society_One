import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import {
  NotificationChannel,
  NotificationStatus,
} from '../../common/types/roles';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUE_NOTIFICATIONS, type NotificationJob } from './queue.constants';

@Processor(QUEUE_NOTIFICATIONS)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async process(job: Job<NotificationJob>) {
    const tenantId = await this.prisma.getSocietyTenantId(job.data.societyId);
    const log = await this.prisma.notification.create({
      data: {
        tenantId,
        societyId: job.data.societyId,
        channelCode:
          job.data.channel === 'EMAIL'
            ? NotificationChannel.EMAIL
            : NotificationChannel.WHATSAPP,
        recipient: job.data.recipient,
        subject: job.data.subject,
        body: job.data.body,
        statusCode: NotificationStatus.QUEUED,
        metadata: job.data.metadata as object | undefined,
      },
    });

    try {
      if (job.data.channel === 'EMAIL') {
        await this.sendEmail(job.data);
      } else {
        await this.sendWhatsApp(job.data);
      }
      await this.prisma.notification.update({
        where: { id: log.id },
        data: { statusCode: NotificationStatus.SENT, sentAt: new Date() },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'send failed';
      this.logger.error(message);
      await this.prisma.notification.update({
        where: { id: log.id },
        data: { statusCode: NotificationStatus.FAILED, error: message },
      });
      throw error;
    }
  }

  private async sendEmail(job: NotificationJob) {
    const host = this.config.get<string>('SMTP_HOST');
    if (!host) {
      this.logger.warn(`SMTP not configured â€” email to ${job.recipient} logged only`);
      return;
    }
    const transporter = nodemailer.createTransport({
      host,
      port: this.config.get<number>('SMTP_PORT') ?? 587,
      secure: false,
      auth: {
        user: this.config.get<string>('SMTP_USER'),
        pass: this.config.get<string>('SMTP_PASS'),
      },
    });
    await transporter.sendMail({
      from: this.config.get<string>('SMTP_FROM') ?? 'noreply@societyone.app',
      to: job.recipient,
      subject: job.subject ?? 'SocietyOne notification',
      text: job.body,
    });
  }

  private async sendWhatsApp(job: NotificationJob) {
    const url = this.config.get<string>('WHATSAPP_API_URL');
    const token = this.config.get<string>('WHATSAPP_API_TOKEN');
    if (!url || !token) {
      this.logger.warn(`WhatsApp not configured â€” message to ${job.recipient} logged only`);
      return;
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to: job.recipient, body: job.body }),
    });
    if (!res.ok) {
      throw new Error(`WhatsApp API ${res.status}: ${await res.text()}`);
    }
  }
}
