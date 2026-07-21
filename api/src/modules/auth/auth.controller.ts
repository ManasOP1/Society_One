import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { AuthService } from './auth.service';
import { CurrentUser, Public, type AuthUser } from '../../common/decorators/auth.decorators';

const LoginSchema = z
  .object({
    email: z.string().email().optional(),
    societyId: z.string().uuid().optional(),
    wing: z.string().min(1).optional(),
    flatNo: z.string().min(1).optional(),
    password: z.string().min(6),
  })
  .superRefine((data, ctx) => {
    const emailLogin = !!data.email;
    const residentLogin = !!(data.societyId && data.wing && data.flatNo);
    if (emailLogin === residentLogin) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Provide either email+password (admin) or societyId+wing+flatNo+password (resident)',
      });
    }
  });
class LoginDto extends createZodDto(LoginSchema) {}

const RefreshSchema = z.object({
  refreshToken: z.string().min(20),
});
class RefreshDto extends createZodDto(RefreshSchema) {}

const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});
class ForgotPasswordDto extends createZodDto(ForgotPasswordSchema) {}

const ResetPasswordSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(6),
});
class ResetPasswordDto extends createZodDto(ResetPasswordSchema) {}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Get('societies')
  listSocieties() {
    return this.auth.listSocietiesForLogin();
  }

  @Public()
  @Get('societies/:societyId/wings')
  listWings(@Param('societyId') societyId: string) {
    return this.auth.listWingsForLogin(societyId);
  }

  @Public()
  @Post('login')
  login(@Body() body: LoginDto) {
    if (body.email) {
      return this.auth.login(body.email, body.password);
    }
    return this.auth.loginResident(
      body.societyId!,
      body.wing!,
      body.flatNo!,
      body.password,
    );
  }

  @Public()
  @Post('refresh')
  refresh(@Body() body: RefreshDto) {
    return this.auth.refresh(body.refreshToken);
  }

  @Public()
  @Post('forgot-password')
  forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.auth.forgotPassword(body.email);
  }

  @Public()
  @Post('reset-password')
  resetPassword(@Body() body: ResetPasswordDto) {
    return this.auth.resetPassword(body.token, body.password);
  }

  @ApiBearerAuth()
  @Post('logout')
  async logout(@CurrentUser() user: AuthUser, @Body() body: Partial<RefreshDto>) {
    await this.auth.logout(user.id, body.refreshToken);
    return { success: true };
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }
}
