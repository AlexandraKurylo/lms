import type { AuthUser } from '../auth/auth.types.js';

export interface OwnerScope {
  teacherId?: number;
}

export function scopeFor(user: AuthUser): OwnerScope {
  return user.role === 'admin' ? {} : { teacherId: user.id };
}
