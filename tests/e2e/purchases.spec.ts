import { expect, test, type Page, type Locator } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { selectOption } from "./select-option";

const artifacts = ".artifacts/gear-lab-purchases";
const player = JSON.parse(
  readFileSync("tests/fixtures/sim/warrior.request.json", "utf8"),
).raid.parties[0].players[0];
const draft = (page: Page) =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem("wow-droptimizer.top-gear.v1")!),
  );
async function ready(page: Page) {
  await expect(page.locator(".set-count")).not.toContainText("Calculating", {
    timeout: 60000,
  });
  await expect(
    page.getByRole("button", { name: "Run Gear Lab", exact: true }),
  ).toBeEnabled({ timeout: 60000 });
}
async function add(page: Page, quantity: string, tier = 10, quality = "Base") {
  await page.getByRole("button", { name: "Add resource", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add a token or currency" });
  await dialog
    .getByRole("button", { name: `Tier ${tier}`, exact: true })
    .click();
  await dialog
    .getByRole("radio", { name: new RegExp(`^${quality} ·`) })
    .check();
  await dialog.getByRole("spinbutton", { name: "Quantity" }).fill(quantity);
  await dialog
    .getByRole("button", { name: "Add resource", exact: true })
    .click();
}
test.beforeEach(async ({ page }) => {
  test.setTimeout(120000);
  mkdirSync(artifacts, { recursive: true });
  await page.goto("/gear-lab");
  await page.getByLabel("Character export", { exact: true }).fill(
    JSON.stringify({
      name: "Aldren",
      class: "warrior",
      race: "human",
      level: 80,
      talents: player.talentsString,
      professions: [{ name: "Engineering" }, { name: "Jewelcrafting" }],
      gear: player.equipment,
    }),
  );
  await page
    .getByLabel("Bag export", { exact: true })
    .fill(JSON.stringify({ items: [{ id: 40528, enchant: 0, gems: [] }] }));
  await page.getByRole("button", { name: "Review import" }).click();
  await selectOption(page.getByLabel("DPS preset"), {
    label: "Fury (19/52/0)",
  });
  await page.getByRole("button", { name: "Select gear", exact: true }).click();
});

test("real worker derives mixed-tier gear, replaces balances, restores exclusions and submits only purchase inputs", async ({
  page,
}) => {
  let workers = 0;
  page.on("worker", () => workers++);
  await page.screenshot({ path: `${artifacts}/board-01-wallet-empty.png` });
  await add(page, "100");
  await add(page, "1", 9, "Heroic");
  await ready(page);
  await expect(page.locator(".resource-wallet-review")).toContainText(
    "10 compatible purchases included",
  );
  // These verified Alliance Warrior DPS rewards require Protector Regalia,
  // so Frost-derived rows alone cannot satisfy the mixed-tier acceptance case.
  const regaliaRows = [48381, 48382, 48383, 48384, 48385].map((itemId) =>
    page.locator(
      `.inventory-row[data-source="purchase"][data-instance-id="purchase-original-${itemId}"]`,
    ),
  );
  for (const row of regaliaRows) {
    await expect(row).toContainText("258");
    await expect(row.getByRole("checkbox")).toBeChecked();
  }
  const frostShoulder = page.locator(
    '.inventory-row[data-source="purchase"][data-instance-id="purchase-original-50082"]',
  );
  await expect(frostShoulder).toContainText("251");
  await expect(frostShoulder.getByRole("checkbox")).toBeChecked();
  const regaliaQuantity = page.getByRole("spinbutton", {
    name: "Regalia of the Grand Protector quantity",
    exact: true,
  });
  // One token exposes all five alternatives. Removing that token removes its
  // rewards without removing Frost options; final-set token bounds have domain tests.
  await regaliaQuantity.fill("0");
  await ready(page);
  for (const row of regaliaRows) await expect(row).toHaveCount(0);
  await expect(page.locator(".resource-wallet-review")).toContainText(
    "5 compatible purchases included",
  );
  await expect(frostShoulder.getByRole("checkbox")).toBeChecked();
  await regaliaQuantity.fill("1");
  await ready(page);
  for (const row of regaliaRows)
    await expect(row.getByRole("checkbox")).toBeChecked();
  const original = await draft(page);
  expect(original.purchases.balances).toEqual({
    frost: 100,
    "regalia:protector": 1,
  });
  expect(
    original.snapshot.inventory.some(
      (i: { source: string }) => i.source === "purchase",
    ),
  ).toBe(false);
  writeFileSync(
    `${artifacts}/final-fix-wallet-desktop.png`,
    await page.screenshot({
      path: `${artifacts}/board-01-populated-desktop.png`,
    }),
  );
  await page
    .getByRole("button", { name: "Edit Emblems of Frost", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("spinbutton", { name: "Quantity" })
    .fill("99");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save resource" })
    .click();
  expect((await draft(page)).purchases.balances.frost).toBe(99);
  await add(page, "100");
  await expect(
    page.getByRole("spinbutton", {
      name: "Emblems of Frost quantity",
      exact: true,
    }),
  ).toHaveCount(1);
  expect((await draft(page)).purchases.balances.frost).toBe(100);
  await ready(page);
  await page
    .getByRole("button", { name: "Review purchases", exact: true })
    .click();
  const group = page
    .locator(".purchase-review-group")
    .filter({ has: page.locator("summary").filter({ hasText: "251" }) });
  await group.locator("summary").click();
  const reward = page.locator('[data-purchase-id="50082"]');
  const shoulders = await group
    .locator('[data-purchase-id="50082"], [data-purchase-id="50846"]')
    .evaluateAll((rows) =>
      rows.map((row) => row.getAttribute("data-purchase-id")),
    );
  expect(shoulders).toEqual(["50082", "50846"]);
  await reward.getByRole("checkbox").uncheck();
  await expect(reward.getByRole("checkbox")).not.toBeChecked();
  writeFileSync(
    `${artifacts}/final-fix-purchase-review.png`,
    await page.screenshot({
      path: `${artifacts}/board-04-purchase-review.png`,
    }),
  );
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Review purchases", exact: true }),
  ).toBeFocused();
  await expect(page.locator(".resource-wallet-review")).toContainText(
    "9 compatible purchases included",
  );
  const excluded = await draft(page);
  expect(excluded.purchases.excludedItemIds.original).toContain(50082);
  await page.reload();
  await page.getByRole("button", { name: /Restore draft/ }).click();
  await ready(page);
  expect((await draft(page)).purchases).toEqual(excluded.purchases);
  await expect(
    page
      .locator('[data-instance-id="purchase-original-50082"]')
      .getByRole("checkbox"),
  ).not.toBeChecked();
  let submitted: unknown;
  await page.route("**/api/top-gear/jobs", async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({
      status: 503,
      json: { error: "Purchase inputs received for testing." },
    });
  });
  await page.getByRole("button", { name: "Run Gear Lab", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Purchase inputs received" }),
  ).toBeVisible();
  expect(submitted).toMatchObject({
    purchases: excluded.purchases,
    snapshot: { inventory: original.snapshot.inventory },
  });
  expect(
    Object.keys((submitted as { purchases: object }).purchases).sort(),
  ).toEqual([
    "balances",
    "excludedItemIds",
    "gearVariant",
    "itemEnhancements",
    "recipeRevision",
    "version",
  ]);
  expect(workers).toBeGreaterThan(0);
});

test("resource dialog matches shared controls across desktop, breakpoint, mobile and short screens", async ({
  page,
}) => {
  for (const [width, height, label] of [
    [1440, 900, "desktop"],
    [900, 900, "breakpoint"],
    [390, 844, "mobile"],
    [390, 440, "short"],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page
      .getByRole("button", { name: "Add custom item to Head", exact: true })
      .click();
    const custom = page.getByRole("dialog", { name: "Add custom items" });
    await expect(custom.getByRole("searchbox")).toBeFocused();
    await page.screenshot({ path: `${artifacts}/custom-${label}.png` });
    const customTitle = await custom
      .locator(".custom-picker-title")
      .evaluate((el) => ({
        size: getComputedStyle(el).fontSize,
        lineHeight: getComputedStyle(el).lineHeight,
      }));
    const customPadding = await custom
      .locator(".custom-picker-header")
      .evaluate((el) => getComputedStyle(el).paddingLeft);
    const customActionHeight = (await custom
      .getByRole("button", { name: "Add items", exact: true })
      .boundingBox())!.height;
    const shared = await custom.evaluate((el) => ({
      font: getComputedStyle(el).fontFamily,
      background: getComputedStyle(el).backgroundColor,
      borderRadius: getComputedStyle(el).borderRadius,
    }));
    await page.keyboard.press("Escape");
    const trigger = page.getByRole("button", {
      name: "Add resource",
      exact: true,
    });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", {
      name: "Add a token or currency",
    });
    expect(
      await dialog.evaluate((el) => ({
        font: getComputedStyle(el).fontFamily,
        background: getComputedStyle(el).backgroundColor,
        borderRadius: getComputedStyle(el).borderRadius,
      })),
    ).toEqual({
      ...shared,
      borderRadius: width < 640 ? "0px" : shared.borderRadius,
    });
    expect(
      await dialog.locator(".resource-dialog-title").evaluate((el) => ({
        size: getComputedStyle(el).fontSize,
        lineHeight: getComputedStyle(el).lineHeight,
      })),
    ).toEqual(customTitle);
    expect(
      await dialog
        .locator(".resource-dialog-header")
        .evaluate((el) => getComputedStyle(el).paddingLeft),
    ).toEqual(customPadding);
    expect(
      (await dialog
        .getByRole("button", { name: "Add resource", exact: true })
        .boundingBox())!.height,
    ).toBe(customActionHeight);
    const dimensions = await dialog.boundingBox();
    expect(dimensions!.width).toBe(width < 640 ? width : 720);
    writeFileSync(
      `${artifacts}/dialog-${label}-computed.json`,
      JSON.stringify(
        { shared, customTitle, customPadding, customActionHeight, dimensions },
        null,
        2,
      ),
    );
    await page.screenshot({ path: `${artifacts}/board-02-t10-${label}.png` });
    await dialog.getByRole("button", { name: "Tier 9", exact: true }).focus();
    await page.keyboard.press("Enter");
    await dialog.getByRole("radio", { name: /^Heroic ·/ }).focus();
    await page.keyboard.press("Space");
    await expect(
      dialog.getByRole("radio", { name: /^Heroic ·/ }),
    ).toBeChecked();
    await page.screenshot({ path: `${artifacts}/board-03-t9-${label}.png` });
    for (const radio of await dialog.getByRole("radio").all()) {
      await radio.scrollIntoViewIfNeeded();
      await expect(radio).toBeInViewport();
    }
    const action = dialog.getByRole("button", {
      name: "Add resource",
      exact: true,
    });
    await action.scrollIntoViewIfNeeded();
    await expect(action).toBeInViewport({ ratio: 1 });
    expect(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await page.screenshot({
      path: `${artifacts}/board-07-resource-${label}-footer.png`,
    });
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("keyboard wallet editing and removal remain usable in Portuguese mobile", async ({
  page,
}) => {
  await add(page, "100");
  await add(page, "1", 10, "Normal");
  await ready(page);
  await page
    .getByRole("button", { name: "Review purchases", exact: true })
    .click();
  const normal = page
    .locator(".purchase-review-group")
    .filter({ has: page.locator("summary").filter({ hasText: "264" }) });
  await normal.locator("summary").click();
  await expect(normal.locator(".purchase-review-path").first()).toContainText(
    "60 Emblems of Frost",
  );
  await page.screenshot({ path: `${artifacts}/board-09-prerequisite.png` });
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${artifacts}/board-06-wallet-mobile.png` });
  await page
    .context()
    .addCookies([
      { name: "munigan.locale", value: "pt-BR", url: "http://127.0.0.1:3100" },
    ]);
  await page.reload();
  await page.getByRole("button", { name: /Restaurar/ }).click();
  await expect(page.locator(".resource-wallet")).toContainText(
    "Emblemas de Gelo",
  );
  await page
    .getByRole("button", { name: "Editar Emblemas de Gelo", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  const quantity = dialog.getByRole("spinbutton", {
    name: "Quantidade",
    exact: true,
  });
  await quantity.focus();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("60");
  const save = dialog.getByRole("button", {
    name: "Salvar recurso",
    exact: true,
  });
  await save.focus();
  await page.keyboard.press("Enter");
  expect((await draft(page)).purchases.balances.frost).toBe(60);
  await page.screenshot({ path: `${artifacts}/portuguese-mobile.png` });
  await page
    .getByRole("button", { name: "Remover Emblemas de Gelo", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  expect((await draft(page)).purchases.balances.frost).toBeUndefined();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("missing normal prerequisite leaves unrelated gear available and unsaved edits cancel", async ({
  page,
}) => {
  await add(page, "100");
  await add(page, "1", 10, "Heroic");
  await ready(page);
  const saved = await draft(page);
  await page
    .getByRole("button", { name: "Edit Emblems of Frost", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByRole("spinbutton", { name: "Quantity" }),
  ).toHaveValue("100");
  await page
    .getByRole("dialog")
    .getByRole("spinbutton", { name: "Quantity" })
    .fill("1");
  await page.screenshot({ path: `${artifacts}/board-09-edit-resource.png` });
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Edit Emblems of Frost", exact: true }),
  ).toBeFocused();
  expect((await draft(page)).purchases).toEqual(saved.purchases);
  await page
    .getByRole("button", { name: "Review purchases", exact: true })
    .click();
  const heroic = page
    .locator(".purchase-review-group")
    .filter({ has: page.locator("summary").filter({ hasText: "277" }) });
  await heroic.locator("summary").click();
  const shoulder = heroic.locator('[data-purchase-id="51229"]');
  await expect(shoulder).toContainText("Unavailable");
  await expect(shoulder).toContainText("51210");
  await expect(shoulder).toContainText("Protector’s Mark of Sanctification");
  await shoulder.scrollIntoViewIfNeeded();
  await shoulder.screenshot({
    path: `${artifacts}/board-09-missing-prerequisite.png`,
  });
  await page.keyboard.press("Escape");
  await expect(
    page
      .locator('[data-instance-id="purchase-original-50082"]')
      .getByRole("checkbox"),
  ).toBeEnabled();
  await ready(page);
});

test("adds a new resource using only keyboard navigation, quantity entry and save", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const before = await draft(page);
  expect(before.purchases).toBeUndefined();
  async function tabTo(target: Locator) {
    for (let step = 0; step < 40; step++) {
      if (await target.evaluate((el) => el === document.activeElement)) break;
      await page.keyboard.press("Tab");
    }
    await expect(target).toBeFocused();
  }
  const trigger = page.getByRole("button", {
    name: "Add resource",
    exact: true,
  });
  await tabTo(trigger);
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Add a token or currency" });
  await expect(dialog).toBeVisible();
  const tier = dialog.getByRole("button", { name: "Tier 10", exact: true });
  await tabTo(tier);
  await page.keyboard.press("Enter");
  const frost = dialog.getByRole("radio", { name: /^Base · 251/ });
  await tabTo(frost);
  await page.keyboard.press("Space");
  await expect(frost).toBeChecked();
  const quantity = dialog.getByRole("spinbutton", {
    name: "Quantity",
    exact: true,
  });
  await tabTo(quantity);
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("60");
  await expect(quantity).toHaveValue("60");
  expect((await draft(page)).purchases).toBeUndefined();
  const save = dialog.getByRole("button", {
    name: "Add resource",
    exact: true,
  });
  await tabTo(save);
  await expect(save).toBeInViewport({ ratio: 1 });
  await page.screenshot({
    path: `${artifacts}/keyboard-new-resource-save.png`,
  });
  await page.keyboard.press("Enter");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await ready(page);
  expect((await draft(page)).purchases.balances).toEqual({ frost: 60 });
  expect((await draft(page)).snapshot.inventory).toEqual(
    before.snapshot.inventory,
  );
});
