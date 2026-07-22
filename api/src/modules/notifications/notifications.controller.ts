import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NotificationChannel, Role } from '../../common/types/roles';
import {
  CurrentUser,
  Roles,
  type AuthUser,
} from '../../common/decorators/auth.decorators';
import { RolesGuard, TenantGuard } from '../../common/guards/rbac.guards';
import { resolveSocietyId } from '../../common/utils/tenant.util';
import { NotificationsService } from './notifications.service';
import { PushNotificationService } from './push-notification.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(RolesGuard, TenantGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly push: PushNotificationService,
  ) {}

  @Post('register-device')
  @Roles(Role.RESIDENT, Role.SOCIETY_ADMIN, Role.COMMITTEE_MEMBER)
  registerDevice(
    @CurrentUser() user: AuthUser,
    @Body() body: { expoToken: string; platform?: string },
  ) {
    return this.push.registerToken(user.id, user.societyId, body.expoToken, body.platform);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.SOCIETY_ADMIN)
  list(
    @CurrentUser() user: AuthUser,
    @Query('societyId') societyId?: string,
    @Query('channel') channel?: NotificationChannel,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.notifications.listLogs(resolveSocietyId(user, societyId), {
      channel,
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
    });
  }
}
