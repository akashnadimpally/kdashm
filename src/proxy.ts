import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "./lib/auth";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Paths that are fully public (do not require login)
  const isPublicAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/api/auth/login"); // Login endpoint itself

  if (isPublicAsset) {
    return NextResponse.next();
  }

  const sessionCookie = req.cookies.get("kdashm_session")?.value;
  const payload = sessionCookie ? await verifySessionToken(sessionCookie) : null;
  const isAuthenticated = !!payload;

  // Handle Login Page
  if (pathname === "/login") {
    if (isAuthenticated) {
      // Already logged in, redirect to home page
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  // If not authenticated, redirect/reject
  if (!isAuthenticated) {
    // If it's an API route (other than auth login), return 401 Unauthorized
    if (pathname.startsWith("/api/")) {
      return new NextResponse(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // For any UI page, redirect to the login screen
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  // Enforce read-only constraint for Reader role at the middleware level
  if (payload.role === "reader") {
    const isMutationMethod = ["POST", "PUT", "DELETE", "PATCH"].includes(req.method);
    const isProtectedApi = pathname.startsWith("/api/") && 
                           !pathname.startsWith("/api/auth/logout") && 
                           !pathname.startsWith("/api/agent"); // Let the agent API handle its own constraints/refusal

    if (isMutationMethod && isProtectedApi) {
      return new NextResponse(
        JSON.stringify({ error: "Forbidden: Readers are not permitted to mutate resources" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  return NextResponse.next();
}

// Config to specify matching paths
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
