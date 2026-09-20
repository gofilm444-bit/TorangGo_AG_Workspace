import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolveClientConfig } from '@platform/config';

export interface ValidatedAdminSession {
  admin_id: string;
  email: string;
  username: string;
  status: string;
  roles: string[];
  permissions: string[];
}

/**
 * Server-side authoritative admin session validation for Next.js App Router.
 *
 * Enforces server-side authentication at the layout/route boundary:
 * 1. Reads incoming HttpOnly 'toranggo_admin_access' cookie.
 * 2. Authoritatively validates session against the backend /api/v1/auth/me.
 * 3. Enforces ADMIN_WEB audience isolation (mobile audience tokens are rejected).
 * 4. Ensures admin account is ACTIVE and session has not expired/been revoked.
 * 5. Server redirects to /login on missing, forged, expired, or revoked sessions.
 */
export async function requireServerAdminSession(): Promise<ValidatedAdminSession> {
  const cookieStore = await cookies();
  const token = cookieStore.get('toranggo_admin_access')?.value;

  if (!token) {
    redirect('/login');
  }

  const clientConfig = resolveClientConfig({ audience: 'ADMIN_WEB' });
  const backendUrl = clientConfig.apiBaseUrl.replace(/\/+$/, '');

  try {
    const res = await fetch(`${backendUrl}/api/v1/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Cookie: `toranggo_admin_access=${token}`,
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      redirect('/login');
    }

    const data = await res.json();

    // Authoritative verification:
    // - Must be ADMIN_WEB audience (mobile tokens cannot access Admin Web)
    // - Must be ADMIN principal type
    // - Must have ACTIVE status
    if (
      data.audience !== 'ADMIN_WEB' ||
      data.principal_type !== 'ADMIN' ||
      data.status !== 'ACTIVE'
    ) {
      redirect('/login');
    }

    return {
      admin_id: data.admin_id,
      email: data.email,
      username: data.username,
      status: data.status,
      roles: data.roles || [],
      permissions: data.permissions || [],
    };
  } catch (err: unknown) {
    if (
      (err as Error)?.message === 'NEXT_REDIRECT' ||
      (err as { digest?: string })?.digest?.startsWith('NEXT_REDIRECT')
    ) {
      throw err;
    }
    redirect('/login');
  }
}
