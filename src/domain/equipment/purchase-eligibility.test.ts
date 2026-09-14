import { expect, it } from "vitest";
import { purchaseFixture } from "../../../tests/support/purchase-fixtures";
import { validateItem } from "./validate";
it("applies hypothetical faction restrictions to generated purchase items", () => {
  const { snapshot } = purchaseFixture();
  const item = {
    instanceId: "purchase-original-48486",
    itemId: 48486,
    source: "purchase" as const,
    gemIds: [],
    enchantId: 0,
  };
  expect(
    validateItem(snapshot, item).some((d) => /faction/.test(d.message)),
  ).toBe(true);
  expect(
    validateItem(snapshot, { ...item, source: "bag" }).some((d) =>
      /faction/.test(d.message),
    ),
  ).toBe(false);
});
