import { expect, it } from "vitest";
import { z } from "zod";
import { failure } from "./api";
import { AdmissionError } from "@/server/jobs/admit";
import { AppError } from "@/i18n/error";

it("adds a stable admission code without changing HTTP status or legacy error text", async () => {
  const message = "The simulation queue is full. Try again shortly.";
  const response = failure(new AdmissionError(message, 429));
  expect(response.status).toBe(429);
  expect(await response.json()).toEqual({ error: message, code: "queueFull" });
});

it("preserves structured diagnostic parameters and validation details", async () => {
  const response = failure(
    new AppError("unknownGem", "Unknown gem 123", { id: 123 }),
  );
  expect(response.status).toBe(422);
  expect(await response.json()).toEqual({
    error: "Unknown gem 123",
    code: "unknownGem",
    params: { id: 123 },
  });
  const parsed = z.object({ name: z.string() }).safeParse({});
  expect(parsed.success).toBe(false);
  if (!parsed.success) {
    const payload = await failure(parsed.error).json();
    expect(payload).toMatchObject({
      error: "Invalid Top Gear input",
      code: "invalidInput",
    });
    expect(payload.details).toHaveLength(1);
  }
});

it("preserves an explicit purchase admission diagnostic", async () => {
  const response = failure(
    new AdmissionError("Invalid purchase enhancement", 422, {
      code: "purchaseEnhancementInvalid",
      params: { itemId: 50098 },
    }),
  );
  expect(response.status).toBe(422);
  expect(await response.json()).toEqual({
    error: "Invalid purchase enhancement",
    code: "purchaseEnhancementInvalid",
    params: { itemId: 50098 },
  });
});
