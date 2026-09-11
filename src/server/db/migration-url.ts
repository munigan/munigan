/** Migration advisory locks need one direct PostgreSQL session. */
export function migrationDatabaseUrl(env: {
  DATABASE_URL_UNPOOLED?: string;
  DATABASE_URL?: string;
}): string {
  const value = env.DATABASE_URL_UNPOOLED || env.DATABASE_URL;
  const message =
    "Configure a direct PostgreSQL DATABASE_URL_UNPOOLED for migrations";
  if (!value) throw new Error(message);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(message);
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    /-pooler\./i.test(url.hostname)
  )
    throw new Error(message);
  return value;
}
