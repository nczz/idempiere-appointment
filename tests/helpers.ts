/**
 * Helper: get a fresh iDempiere REST token for Playwright tests.
 */
const BASE = process.env.IDEMPIERE_URL || 'http://localhost:8080';

export async function getToken(): Promise<string> {
  const userName = process.env.IDEMPIERE_USER || 'GardenAdmin';
  const password = process.env.IDEMPIERE_PASS || 'GardenAdmin';
  const login = await fetch(`${BASE}/api/v1/auth/tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName, password }),
  });
  const { token: initToken } = await login.json();

  const ctx = await fetch(`${BASE}/api/v1/auth/tokens`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${initToken}` },
    body: JSON.stringify({ clientId: 11, roleId: 102, organizationId: 11, warehouseId: 103 }),
  });
  const { token } = await ctx.json();
  return token;
}

export function spaUrl(token: string): string {
  return `${BASE}/webui/appointments/index.html#token=${token}`;
}
