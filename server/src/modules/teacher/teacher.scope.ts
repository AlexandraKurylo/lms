import type { AuthUser } from '../auth/auth.types.js';

/**
 * Обмеження власника: яку умову додати до WHERE, щоб користувач бачив лише «своє».
 *   admin   → {}                (нічого не додаємо: бачить усе)
 *   teacher → { teacherId: id } (лише власні курси)
 * Єдине місце, де записано правило «хто чий власник». Усі запити викладацького кабінету
 * беруть умову звідси, тому забути її в окремому маршруті складніше.
 */
export interface OwnerScope {
  teacherId?: number;
}

export function scopeFor(user: AuthUser): OwnerScope {
  return user.role === 'admin' ? {} : { teacherId: user.id };
}
