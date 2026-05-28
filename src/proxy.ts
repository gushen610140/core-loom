import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AUTH_USER = process.env.DASHBOARD_USER || 'admin';
const AUTH_PASS = process.env.DASHBOARD_PASS || 'coreloom';

export function proxy(req: NextRequest) {
  const authHeader = req.headers.get('authorization');

  if (authHeader) {
    const base64 = authHeader.replace('Basic ', '');
    const decoded = Buffer.from(base64, 'base64').toString('utf8');
    const [user, pass] = decoded.split(':');
    if (user === AUTH_USER && pass === AUTH_PASS) {
      return NextResponse.next();
    }
  }

  return new NextResponse('Unauthorized', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Core of the Loom"' },
  });
}

export const config = {
  matcher: ['/((?!_next/static|favicon.ico).*)'],
};
