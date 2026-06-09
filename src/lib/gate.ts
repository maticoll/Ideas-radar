// Single-user access gate.
//
// The whole app sits behind one shared password (APP_PASSWORD). Submitting it on
// /unlock sets a signed, httpOnly cookie; middleware checks that cookie on every
// request. This is intentionally NOT a multi-user auth system — it's a personal
// lock so the deployed demo isn't world-open.
//
// Edge- and Node-safe: uses Web Crypto (crypto.subtle) only, so the same helpers
// run inside middleware (edge runtime) and route handlers (node runtime).
//
// If APP_PASSWORD is unset the gate is DISABLED (app stays open) — mirroring the
// "works without keys" philosophy of the collectors, and avoiding a deploy that
// bricks itself with no way to unlock. Set APP_PASSWORD to turn protection on.

export const SESSION_COOKIE = "ir_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, in seconds

// Cookies are signed with a dedicated secret if provided, else derived from the
// password itself (HMAC is one-way, so the cookie never leaks the password).
function gateSecret(): string {
  return process.env.APP_SESSION_SECRET || process.env.APP_PASSWORD || "";
}

export function isGateEnabled(): boolean {
  return !!process.env.APP_PASSWORD;
}

export function getAppPassword(): string {
  return process.env.APP_PASSWORD || "";
}

// Constant-time comparison. Length is not treated as secret here.
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacHex(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Cookie value: "<expEpochSeconds>.<hmacHex>". The signature covers the expiry,
// so the cookie self-expires and can't be extended without the secret.
export async function createSessionValue(maxAgeSeconds = SESSION_MAX_AGE): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + maxAgeSeconds;
  const sig = await hmacHex(String(exp), gateSecret());
  return `${exp}.${sig}`;
}

export async function verifySession(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  const secret = gateSecret();
  if (!secret) return false;
  const dot = value.indexOf(".");
  if (dot < 0) return false;
  const expPart = value.slice(0, dot);
  const sigPart = value.slice(dot + 1);
  const exp = Number(expPart);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
  const expected = await hmacHex(expPart, secret);
  return safeEqual(expected, sigPart);
}
