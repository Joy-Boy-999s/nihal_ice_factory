import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/** Mark a route as accessible only to users with the given roles. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
