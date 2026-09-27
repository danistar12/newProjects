import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const publicPaths = ["/login", "/register", "/api/auth"];
  const protectedPrefixes = ["/dashboard", "/calendar", "/classes", "/study"];

  const isPublicPath = publicPaths.some((path) =>
    pathname === path || pathname.startsWith(`${path}/`),
  );

  const isProtectedPath = protectedPrefixes.some((path) =>
    pathname === path || pathname.startsWith(`${path}/`),
  );

  if (isPublicPath) {
    return NextResponse.next();
  }

  if (!isProtectedPath) {
    return NextResponse.next();
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/calendar/:path*",
    "/classes/:path*",
    "/study/:path*",
    "/login",
    "/register",
    "/api/auth/:path*",
  ],
};
