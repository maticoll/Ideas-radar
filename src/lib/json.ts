// Helpers to encode/decode array & object fields stored as JSON strings.
// Keeps the schema portable across SQLite and PostgreSQL.

export function toJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return "null";
  }
}

export function fromJson<T>(value: string | null | undefined, fallback: T): T {
  if (value == null) return fallback;
  try {
    const parsed = JSON.parse(value);
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}
