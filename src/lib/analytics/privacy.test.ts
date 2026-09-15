import { describe, expect, it } from "vitest";
import { safePath, sanitizeEvent } from "./privacy";
describe("analytics privacy", () => {
  it("removes capabilities, search parameters, hashes and unknown paths", () => {
    expect(safePath("/reports/private-secret?token=secret#name")).toBe(
      "/reports/:token",
    );
    expect(safePath("/gear-lab?character=Alice")).toBe("/gear-lab");
    expect(safePath("/unknown/private-name")).toBe("/other");
    expect(safePath("/pt-br")).toBe("/pt-br");
  });
  it("drops unknown events and properties, including SDK person profiles", () => {
    expect(sanitizeEvent("$autocapture", {})).toBeNull();
    expect(
      sanitizeEvent("pro_dialog_opened", {
        source: "header",
        character: "Alice",
        $set: { email: "private" },
        $current_url: "https://munigan.app/reports/secret?token=private",
        $referrer: "https://example.com/private?secret=yes",
      }),
    ).toEqual({
      source: "header",
      $current_url: "https://munigan.app/reports/:token",
      $referrer: "https://example.com/",
    });
  });
});

it("preserves the public ingestion token required by the SDK", () => {
  expect(sanitizeEvent("$pageview", { token: "phc_public" })).toEqual({
    token: "phc_public",
  });
});
