import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async registerToken(
    userId: string,
    societyId: string | null,
    expoToken: string,
    platform?: string,
  ) {
    if (!expoToken.startsWith('ExponentPushToken[')) return;
    await this.prisma.devicePushToken.upsert({
      where: { userId_expoToken: { userId, expoToken } },
      create: { userId, societyId, expoToken, platform },
      update: { societyId, platform },
    });
  }

  async removeToken(userId: string, expoToken: string) {
    await this.prisma.devicePushToken.deleteMany({ where: { userId, expoToken } });
  }

  /** Notify all resident app users in a society (notices, events, billing). */
  async notifySocietyResidents(societyId: string, payload: PushPayload) {
    const tokens = await this.prisma.devicePushToken.findMany({
      where: {
        societyId,
        user: { isActive: true, deletedAt: null, memberId: { not: null } },
      },
      select: { expoToken: true },
    });
    await this.sendExpo(tokens.map((t) => t.expoToken), payload);
  }

  /** Notify a single user (e.g. their invoice is ready). */
  async notifyUser(userId: string, payload: PushPayload) {
    const tokens = await this.prisma.devicePushToken.findMany({
      where: { userId },
      select: { expoToken: true },
    });
    await this.sendExpo(tokens.map((t) => t.expoToken), payload);
  }

  private async sendExpo(tokens: string[], payload: PushPayload) {
    const unique = [...new Set(tokens.filter(Boolean))];
    if (!unique.length) return;

    for (let i = 0; i < unique.length; i += 100) {
      const batch = unique.slice(i, i + 100);
      const messages = batch.map((to) => ({
        to,
        sound: 'default',
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
        priority: 'high',
        channelId: 'societyone-alerts',
      }));

      try {
        const res = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(messages),
        });
        if (!res.ok) {
          this.logger.warn(`Expo push failed: ${res.status} ${await res.text()}`);
        }
      } catch (error) {
        this.logger.warn(
          `Expo push error: ${error instanceof Error ? error.message : 'unknown'}`,
        );
      }
    }
  }
}
