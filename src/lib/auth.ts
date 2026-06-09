// Shared authorization for privileged endpoints (cron, seed, admin).
// Fail-closed in production: if CRON_SECRET is unset, deny.
// In non-production (local dev) an unset secret stays open for convenience.
export function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

// The dashboard "Actualizar datos" button calls /api/admin/refresh from the
// browser, where it cannot send the secret. By default that is allowed only in
// dev or with a valid bearer. To expose the public refresh button on a hosted
// demo, set ALLOW_PUBLIC_REFRESH=true (accepting the abuse/DoS tradeoff).
export function refreshAllowed(req: Request): boolean {
  if (process.env.ALLOW_PUBLIC_REFRESH === "true") return true;
  return isAuthorized(req);
}
