import { afterEach, describe, expect, it, vi } from "vitest";
import { PRO_OFFER_VERSION } from "@/domain/pro-launch/contracts";
import {
  ProLaunchClientError,
  getProLaunchStatus,
  joinProLaunch,
} from "./client";

afterEach(() => vi.unstubAllGlobals());

describe("PRO launch client", () => {
  it("sends private no-store requests and validates a joined response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            status: "joined",
            joinedAt: "2026-09-14T12:00:00.000Z",
            offerVersion: PRO_OFFER_VERSION,
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const signal = new AbortController().signal;
    await expect(getProLaunchStatus(signal)).resolves.toEqual({
      status: "joined",
      joinedAt: "2026-09-14T12:00:00.000Z",
      offerVersion: "pro-launch-v1",
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/pro-launch", {
      cache: "no-store",
      credentials: "same-origin",
      signal,
    });
  });

  it.each([
    {
      status: "joined",
      joinedAt: "yesterday",
      offerVersion: PRO_OFFER_VERSION,
    },
    {
      status: "joined",
      joinedAt: "2026-09-14T12:00:00.000Z",
      offerVersion: "old",
    },
    { status: "not_joined", extra: true },
  ])("rejects malformed membership DTOs", async (payload) => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify(payload), { status: 200 }),
        ),
    );
    await expect(
      getProLaunchStatus(new AbortController().signal),
    ).rejects.toThrow("Invalid PRO launch response");
  });

  it("posts the exact join payload and exposes only recognized account errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: "ACCOUNT_CHANGED" }), {
          status: 409,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: "SOMETHING_ELSE" }), {
          status: 500,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const signal = new AbortController().signal;
    const input = {
      expectedUserId: "account-a",
      source: "header" as const,
      locale: "en-US" as const,
      consentVersion: "pro-discord-launch-v1" as const,
    };
    await expect(joinProLaunch(input, signal)).rejects.toMatchObject({
      code: "ACCOUNT_CHANGED",
      status: 409,
    });
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/pro-launch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      cache: "no-store",
      credentials: "same-origin",
      signal,
    });
    await expect(joinProLaunch(input, signal)).rejects.toEqual(
      new ProLaunchClientError(500),
    );
  });
});
