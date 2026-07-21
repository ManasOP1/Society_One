import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CurrentUser, type AuthUser } from '../../common/decorators/auth.decorators';

/** Mobile-compatible alias for GET /me */
@ApiTags('Auth')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(private readonly auth: AuthService) {}

  @Get()
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }
}
