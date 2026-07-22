import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { validateEnv } from './config/env';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { SupabaseModule } from './infrastructure/supabase/supabase.module';
import { RazorpayModule } from './infrastructure/razorpay/razorpay.module';
import { PdfModule } from './infrastructure/pdf/pdf.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { AuthModule } from './modules/auth/auth.module';
import { SocietiesModule } from './modules/societies/societies.module';
import { MembersModule } from './modules/members/members.module';
import { FlatsModule } from './modules/flats/flats.module';
import { BillingModule } from './modules/billing/billing.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ReceiptsModule } from './modules/receipts/receipts.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { VisitorsModule } from './modules/visitors/visitors.module';
import { ComplaintsModule } from './modules/complaints/complaints.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AuditModule } from './modules/audit/audit.module';
import { SettingsModule } from './modules/settings/settings.module';
import { CommunityModule } from './modules/community/community.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('THROTTLE_TTL_MS', 60_000),
          limit: config.get<number>('THROTTLE_LIMIT', 120),
        },
      ],
    }),
    PrismaModule,
    SupabaseModule,
    RazorpayModule,
    PdfModule,
    QueueModule,
    AuthModule,
    SocietiesModule,
    MembersModule,
    FlatsModule,
    BillingModule,
    PaymentsModule,
    ReceiptsModule,
    NotificationsModule,
    DocumentsModule,
    VisitorsModule,
    ComplaintsModule,
    ReportsModule,
    AuditModule,
    SettingsModule,
    CommunityModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
