/**
 * Strips sensitive fields from a database user row before serializing to a
 * JSON response. Apply to every response that includes a User object.
 *
 * Removed fields:
 *   - passwordHash   : bcrypt hash – must never reach the browser
 *   - adminNotes     : internal moderation notes
 *   - accountSource  : internal account-origin metadata
 */
type AnyUser = Record<string, unknown>;

export function safeUser(user: AnyUser | null | undefined): AnyUser | null {
  if (!user) return null;
  const { passwordHash: _pw, adminNotes: _an, accountSource: _as, ...safe } = user;
  return safe;
}

/** Sanitise an array of user rows (e.g. admin user-list responses). */
export function safeUsers(users: AnyUser[]): AnyUser[] {
  return users.map(safeUser).filter(Boolean) as AnyUser[];
}
