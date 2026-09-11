import { selectOption } from "./select-option";
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const fixture = JSON.parse(
  readFileSync("tests/fixtures/sim/warrior.request.json", "utf8"),
);
const player = fixture.raid.parties[0].players[0];
const character = JSON.stringify({
  name: "Aldren",
  class: "warrior",
  race: "human",
  level: 80,
  talents: player.talentsString,
  gear: player.equipment,
  professions: [
    { name: "Engineering", level: 408 },
    { name: "Jewelcrafting", level: 440 },
  ],
});

test("corrects a malformed bag export without losing character data and imports the reviewed gear", async ({
  page,
}) => {
  await page.goto("/gear-lab");
  await page.getByLabel("Character export", { exact: true }).fill(character);
  await page.getByLabel("Bag export", { exact: true }).fill("{broken");
  await page.getByRole("button", { name: "Review import" }).click();
  await expect(page.getByLabel("Bag export", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(
    page.getByLabel("Character export", { exact: true }),
  ).not.toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByLabel("Character export", { exact: true }),
  ).toHaveValue(character);
  const bags = {
    items: [
      { id: 40528, enchant: 3817, gems: [41285, 39996] },
      { id: 9999999 },
    ],
  };
  await page
    .getByLabel("Bag export", { exact: true })
    .fill(JSON.stringify(bags));
  await page.getByRole("button", { name: "Review import" }).click();
  await selectOption(page.getByLabel("DPS preset"), {
    label: "Fury (19/52/0)",
  });
  const supportedBags = page.getByRole("list", { name: "Supported bag items" });
  await expect(supportedBags.getByRole("listitem")).toHaveCount(1);
  await expect(supportedBags.locator('[href*="item=40528"]')).toHaveAttribute(
    "data-item-enhancements",
    "ench=3817&gems=41285:39996",
  );
  await expect(supportedBags.locator('[href*="item=9999999"]')).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Aldren" })).toBeVisible();
  await expect(page.getByText("408 / 450")).toBeVisible();
  await expect(page.getByText("440 / 450")).toBeVisible();
  await expect(page.getByLabel("Bag compatibility")).toContainText(
    "1 supported · 1 unsupported",
  );
  await expect(
    page
      .locator(".import-setting-sources > div")
      .filter({ hasText: "Talents" }),
  ).toContainText("Imported");
  await expect(
    page
      .locator(".import-setting-sources > div")
      .filter({ hasText: "Consumables" }),
  ).toContainText("Preset default");
  await page.getByRole("button", { name: "Back to import" }).click();
  await expect(
    page.getByLabel("Character export", { exact: true }),
  ).toHaveValue(character);
  await expect(page.getByLabel("Bag export", { exact: true })).toHaveValue(
    JSON.stringify(bags),
  );
  await page.getByRole("button", { name: "Review import" }).click();
  await selectOption(page.getByLabel("DPS preset"), {
    label: "Fury (19/52/0)",
  });
  await page.getByRole("button", { name: "Select gear" }).click();
  await expect(
    page.getByRole("heading", { name: "Your equipment" }),
  ).toBeVisible();
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("wow-droptimizer.top-gear.v1")!),
  );
  expect(
    stored.snapshot.inventory
      .filter((item: { source: string }) => item.source === "equipped")
      .map((item: { itemId: number; enchantId: number; gemIds: number[] }) => ({
        id: item.itemId,
        enchant: item.enchantId,
        gems: item.gemIds,
      })),
  ).toEqual(
    player.equipment.items.map(
      (item: { id: number; enchant?: number; gems?: number[] }) => ({
        id: item.id,
        enchant: item.enchant ?? 0,
        gems: item.gems ?? [],
      }),
    ),
  );
  expect(
    stored.snapshot.inventory.filter(
      (item: { source: string }) => item.source === "bag",
    ),
  ).toHaveLength(2);
  expect(stored.snapshot.professionLevels).toEqual({ "4": 408, "7": 440 });
  expect(stored.snapshot.settings.player.talentsString).toBe(
    player.talentsString,
  );
  expect(stored.snapshot.itemVersion).toBe("original");
  expect(stored.snapshot.provenance["player.talentsString"]).toBe("imported");
  expect(stored.selection.selectedInstanceIds).toEqual(
    stored.snapshot.inventory
      .filter((item: { source: string }) => item.source === "equipped")
      .map((item: { instanceId: string }) => item.instanceId),
  );
});

test("addon help shows the guided steps with a compact command and no copy action", async ({
  page,
}) => {
  await page.goto("/gear-lab");
  const guide = page.getByRole("complementary", {
    name: "How to get your exports",
  });
  await expect(guide).toBeVisible();
  await expect(guide.getByRole("listitem")).toHaveCount(3);
  await expect(guide.locator("code")).toHaveText("/wse");
  await expect(guide.getByRole("button")).toHaveCount(0);
  await expect(
    guide.getByRole("link", { name: "Get the exporter" }),
  ).toHaveAttribute(
    "href",
    "https://github.com/Poli93/wowsimsexporter-wotlk-335/archive/refs/heads/main.zip",
  );
});

test("replacement alert keeps the current character on desktop and mobile", async ({
  page,
}) => {
  await page.goto("/gear-lab");
  await page.getByLabel("Character export", { exact: true }).fill(character);
  await page.getByRole("button", { name: "Review import" }).click();
  await selectOption(page.getByLabel("DPS preset"), {
    label: "Fury (19/52/0)",
  });
  await page.getByRole("button", { name: "Select gear", exact: true }).click();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page
      .getByRole("button", { name: "Import character" })
      .first()
      .click();
    const notice = page
      .getByRole("status")
      .filter({ hasText: "Importing replaces this local selection" });
    await expect(notice).toBeVisible();
    await expect(
      notice.getByRole("button", { name: "Keep current character" }),
    ).toBeVisible();
    await notice.screenshot({ path: `/tmp/shared-alert-replace-${width}.png` });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await notice
      .getByRole("button", { name: "Keep current character" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Your equipment" }),
    ).toBeVisible();
  }
});

test("previews each export independently without starting review or simulation", async ({
  page,
}) => {
  let jobs = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/top-gear/jobs")) jobs++;
  });
  await page.goto("/gear-lab");
  const bags = page.getByLabel("Bag export", { exact: true });
  const preview = page.getByRole("region", { name: "Bag preview" });
  await bags.fill(
    JSON.stringify({
      items: [
        { id: 48493, enchant: 3817, gems: [41398, 49110] },
        { id: 48493, enchant: 0, gems: [] },
        { id: 1251 },
        { id: 9999999 },
      ],
    }),
  );
  await expect(preview.getByRole("listitem")).toHaveCount(4);
  await expect(preview.getByRole("button")).toHaveCount(0);
  await expect(preview.getByRole("checkbox")).toHaveCount(0);
  await expect(
    preview.locator('[data-item-enhancements="ench=3817&gems=41398:49110"]'),
  ).toHaveCount(1);
  await expect(
    preview.getByRole("img", { name: "Item 9999999", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Character export", { exact: true }).fill(character);
  const equipment = page.getByRole("region", { name: "Equipped gear preview" });
  await expect(equipment.locator(".import-equipped-icons > *")).toHaveCount(
    player.equipment.items.filter((item: { id: number }) => item.id).length,
  );
  await expect(
    page.getByRole("button", { name: "Review import" }),
  ).toBeVisible();
  await bags.fill("{broken");
  await expect(preview).toHaveCount(0);
  await expect(equipment).toBeVisible();
  await expect(page.locator("#content").getByRole("alert")).toHaveCount(0);
  await bags.fill(JSON.stringify({ items: [{ id: 1251 }] }));
  await expect(preview.getByRole("listitem")).toHaveCount(1);
  await page.getByLabel("Character export", { exact: true }).fill("");
  await expect(equipment).toHaveCount(0);
  await expect(preview).toBeVisible();
  await bags.fill("");
  await expect(preview).toHaveCount(0);
  expect(jobs).toBe(0);
});

test("bag preview stays bounded at the 200-item limit and rejects oversized exports", async ({
  page,
}) => {
  await page.goto("/gear-lab");
  const bags = page.getByLabel("Bag export", { exact: true });
  const preview = page.getByRole("region", { name: "Bag preview" });
  const items = Array.from({ length: 200 }, (_, index) => ({
    id: index % 2 ? 1251 : 45931,
  }));
  await bags.fill(JSON.stringify({ items }));
  await expect(preview.getByRole("listitem")).toHaveCount(200);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await preview
        .getByRole("list")
        .evaluate((list) => list.clientHeight <= 320),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await bags.fill(JSON.stringify({ items: [...items, { id: 1251 }] }));
  await expect(preview).toHaveCount(0);
  await bags.fill(JSON.stringify({ items: [] }));
  await expect(preview).toContainText("No bag items");
});
