import { test, expect } from "@playwright/test";

test("legacy Top Gear URLs permanently redirect while preserving paths and queries", async ({
  request,
}) => {
  for (const suffix of [
    "",
    "?restore=1",
    "/saved/example?restore=1&source=bookmark",
  ]) {
    const response = await request.get(`/top-gear${suffix}`, {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(308);
    expect(response.headers().location).toBe(`/gear-lab${suffix}`);
  }
  const destination = await request.get("/gear-lab?restore=1", {
    maxRedirects: 0,
  });
  expect(destination.status()).toBe(200);
  expect(await destination.text()).toContain("Gear Lab · munigan.app");
});
