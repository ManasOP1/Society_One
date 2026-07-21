import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../types/roles';
import { AuthUser, IS_PUBLIC_KEY, ROLES_KEY } from '../decorators/auth.decorators';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;
    if (!user) throw new UnauthorizedException();

    if (!required.includes(user.role)) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}

/** Ensures society-scoped users only access their own societyId path/query/body. */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      user?: AuthUser;
      params: Record<string, string>;
      query: Record<string, string>;
      body: Record<string, unknown>;
    }>();
    const user = request.user;
    if (!user) throw new UnauthorizedException();
    if (user.role === Role.SUPER_ADMIN) return true;
    if (!user.societyId) throw new ForbiddenException('Missing society scope');

    const claimed =
      request.params.societyId ||
      request.query.societyId ||
      (typeof request.body?.societyId === 'string' ? request.body.societyId : undefined);

    if (claimed && claimed !== user.societyId) {
      throw new ForbiddenException('Cross-tenant access denied');
    }
    return true;
  }
}
