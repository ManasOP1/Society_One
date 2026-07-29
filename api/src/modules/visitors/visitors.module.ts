import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../infrastructure/supabase/supabase.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PublicGateController, VisitorsController } from './visitors.controller';
import { VisitorsService } from './visitors.service';

@Module({
  imports: [SupabaseModule, NotificationsModule],
  controllers: [VisitorsController, PublicGateController],
  providers: [VisitorsService],
  exports: [VisitorsService],
})
export class VisitorsModule {}
