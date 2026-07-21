import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Role } from '../types/roles';
import { AuthUser } from '../decorators/auth.decorators';

/** Resolve tenant societyId from JWT; SUPER_ADMIN may override via query. */
export function resolveSocietyId(
  user: AuthUser,
  querySocietyId?: string,
): string {
  if (user.role === Role.SUPER_ADMIN) {
    const id = querySocietyId ?? user.societyId;
    if (!id) {
      throw new BadRequestException('societyId query parameter is required');
    }
    return id;
  }
  if (!user.societyId) {
    throw new ForbiddenException('Missing society scope');
  }
  return user.societyId;
}

export function isAdminRole(role: Role): boolean {
  return role === Role.SUPER_ADMIN || role === Role.SOCIETY_ADMIN;
}
