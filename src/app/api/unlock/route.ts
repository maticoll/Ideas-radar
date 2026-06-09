import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  isGateEnabled,
  getAppPassword,
  createSessionValue,
  safeEqual,
} from "@/lib/gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/unlock  body: { password: string }
// Validates the shared password and, on success, sets the signed session cookie.
export async function POST(req: Request) {
  if (!isGateEnabled()) {
    return NextResponse.json(
      { error: "Acceso sin clave: APP_PASSWORD no está configurada." },
      { status: 400 },
    );
  }

  let body: { password?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body -> treated as wrong password */
  }
  const password = typeof body.password === "string" ? body.password : "";

  if (!password || !safeEqual(password, getAppPassword())) {
    return NextResponse.json({ error: "Clave incorrecta." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}

// DELETE /api/unlock -> clear the session cookie ("lock" the app again).
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
