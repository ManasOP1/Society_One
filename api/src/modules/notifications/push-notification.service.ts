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

  /** Notify residents linked to a specific flat (visitor gate check-in). */
  async notifyFlatResidents(
    societyId: string,
    flatId: string,
    payload: PushPayload,
  ) {
    const memberFlats = await this.prisma.memberFlat.findMany({
      where: { societyId, flatId, deletedAt: null },
      select: { memberId: true },
    });
    const memberIds = [...new Set(memberFlats.map((m) => m.memberId))];
    if (!memberIds.length) return;

    const tokens = await this.prisma.devicePushToken.findMany({
      where: {
        societyId,
        user: {
          memberId: { in: memberIds },
          isActive: true,
          deletedAt: null,
        },
      },
      select: { expoToken: true },
    });
    await this.sendExpo(
      tokens.map((t) => t.expoToken),
      payload,
    );
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
      // High-priority Expo push — delivered to tray even when app is killed
      // (same pattern as food-delivery apps), as long as device token is registered.
      const messages = batch.map((to) => ({
        to,
        sound: 'default' as const,
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
        priority: 'high' as const,
        channelId: 'societyone-alerts',
        ttl: 60 * 60 * 24 * 7,
        _contentAvailable: true,
      }));

      try {
        const res = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate',
          },
          body: JSON.stringify(messages),
        });
        if (!res.ok) {
          this.logger.warn(`Expo push failed: ${res.status} ${await res.text()}`);
          continue;
        }
        const json = (await res.json()) as {
          data?: Array<{ status?: string; message?: string; details?: unknown }>;
        };
        const tickets = Array.isArray(json.data) ? json.data : [];
        for (const ticket of tickets) {
          if (ticket.status === 'error') {
            this.logger.warn(
              `Expo push ticket error: ${ticket.message ?? 'unknown'} ${JSON.stringify(ticket.details ?? {})}`,
            );
          }
        }
      } catch (error) {
        this.logger.warn(
          `Expo push error: ${error instanceof Error ? error.message : 'unknown'}`,
        );
      }
    }
  }
}
