import { expect, it } from "vitest";
import { migrationDatabaseUrl } from "./migration-url";
it("prefers direct migration URL and preserves parameters", () => {
  const direct =
    "postgresql://user:password@ep-test.neon.tech/app?sslmode=require&channel_binding=require";
  expect(
    migrationDatabaseUrl({
      DATABASE_URL_UNPOOLED: direct,
      DATABASE_URL: "postgresql://user:password@ep-test-pooler.neon.tech/app",
    }),
  ).toBe(direct);
});
it("accepts explicit local direct fallback", () => {
  expect(
    migrationDatabaseUrl({
      DATABASE_URL: "postgresql://127.0.0.1:55435/wow_top_gear",
    }),
  ).toBe("postgresql://127.0.0.1:55435/wow_top_gear");
});
it("rejects pooled-only and missing configuration without revealing credentials", () => {
  expect(() =>
    migrationDatabaseUrl({
      DATABASE_URL: "postgresql://user:secret@ep-test-pooler.neon.tech/app",
    }),
  ).toThrow("direct PostgreSQL");
  expect(() => migrationDatabaseUrl({})).toThrow("direct PostgreSQL");
});
