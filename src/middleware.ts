import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
  const authCookie = request.cookies.get("auth_session");

  // Exclude the root URL and other public URLs from the middleware check
  if (
    request.nextUrl.pathname === "/" ||
    request.nextUrl.pathname.startsWith("/public")
  ) {
    return NextResponse.next();
  }

  if (!authCookie?.value) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/cuentas/:path",
    "/entidades/:path",
    "/operaciones/:path",
    "/preferencias/:path",
  ],
};
