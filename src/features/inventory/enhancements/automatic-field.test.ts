import { expect, it } from "vitest";
import { automaticFieldOverride } from "./automatic-field";

it("previews an automatic socket while preserving other pending manual fields", () => {
  const pending = { gemIds: [42142, 40111], enchantId: 0 };
  expect(automaticFieldOverride(pending, 1)).toEqual({
    gemIds: [42142, null],
    enchantId: 0,
  });
  expect(pending).toEqual({ gemIds: [42142, 40111], enchantId: 0 });
});
it("previews an automatic enchant while preserving pending manual gems", () => {
  expect(
    automaticFieldOverride({ gemIds: [42142, 0], enchantId: 3604 }, "enchant"),
  ).toEqual({ gemIds: [42142, 0] });
});
