import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, isGateEnabled, verifySession } from "@/lib/gate";

// Paths that must stay reachable while the app is locked.
const PUBLIC_PATHS = ["/unlock", "/api/unlock"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function middleware(req: NextRequest) {
  // No password configured -> gate disabled, app open.
  if (!isGateEnabled()) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  // Valid unlock cookie -> allow.
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySession(cookie)) return NextResponse.next();

  // Server-to-server endpoints (cron/seed/admin) carry their own bearer secret;
  // let those through so the gate never breaks GitHub Actions / Vercel Cron.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") === `Bearer ${secret}`) {
    return NextResponse.next();
  }

  // Locked: APIs get a 401, pages get redirected to /unlock.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "locked" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/unlock";
  url.search = "";
  url.searchParams.set("from", pathname);
  return NextResponse.redirect(url);
}

// Run on everything except Next internals and static assets.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
