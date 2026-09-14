import { expect, it } from "vitest";
import { parseJoinProLaunchInput } from "./http";

const valid = {
  expectedUserId: "account-a",
  source: "header",
  locale: "en-US",
  consentVersion: "pro-discord-launch-v1",
};

it("accepts only the consent contract", () => {
  expect(parseJoinProLaunchInput(valid)).toEqual(valid);
  for (const fields of [
    {},
    { ...valid, consentVersion: "old" },
    { ...valid, source: "checkout" },
    { ...valid, locale: "en" },
    { ...valid, discordId: "attacker-supplied" },
    { ...valid, expectedUserId: "" },
    { ...valid, expectedUserId: "x".repeat(257) },
  ]) {
    expect(() => parseJoinProLaunchInput(fields)).toThrow();
  }
});
