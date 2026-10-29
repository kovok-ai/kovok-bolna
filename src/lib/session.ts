import { getSessionTokenFromCookie, validateSessionToken } from './auth';

export async function getCurrentSession() {
  const token = await getSessionTokenFromCookie();
  if (!token) return null;
  return await validateSessionToken(token);
}

export async function requireSession() {
  const session = await getCurrentSession();
  if (!session) {
    throw new Error('UNAUTHORIZED');
  }
  return session;
}

export async function requireRole(allowedRoles: string[]) {
  const session = await requireSession();
  if (!session.role || !allowedRoles.includes(session.role.name)) {
    throw new Error('FORBIDDEN: Insufficient role permissions');
  }
  return session;
}
