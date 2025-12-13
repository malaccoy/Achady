import { NextRequest, NextResponse } from 'next/server';

/**
 * Paths that should NEVER require authentication and should never redirect to /login.
 * These include legal pages required by Facebook/Meta and static assets.
 */
const PUBLIC_PATHS = [
  '/politica-de-privacidade',
  '/termos',
  '/exclusao-de-dados',
];

/**
 * Patterns for paths that should be excluded from any auth checks.
 * Includes Next.js internal routes and static files.
 */
const EXCLUDED_PATH_PATTERNS = [
  /^\/_next\//,      // Next.js static files and chunks
  /^\/favicon\.ico/, // Favicon
  /^\/api\//,        // API routes (handled separately)
  /\.(ico|png|jpg|jpeg|svg|gif|webp|css|js|woff|woff2|ttf|eot)$/, // Static assets
];

/**
 * Check if a path matches any of the excluded patterns
 */
function isExcludedPath(pathname: string): boolean {
  return EXCLUDED_PATH_PATTERNS.some(pattern => pattern.test(pathname));
}

/**
 * Check if a path is in the public allowlist
 */
function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow excluded paths (static assets, Next.js internals)
  if (isExcludedPath(pathname)) {
    return NextResponse.next();
  }

  // Always allow public legal pages - never require auth
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // For all other paths, continue with normal request handling
  // (auth logic can be added here in the future if needed)
  return NextResponse.next();
}

export const config = {
  /*
   * Match all request paths except:
   * - _next/static (static files)
   * - _next/image (image optimization files)
   * - favicon.ico (favicon file)
   */
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
