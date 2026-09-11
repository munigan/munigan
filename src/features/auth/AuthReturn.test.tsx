import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import en from "../../../messages/en-US/auth.json";
import { AuthReturn } from "./AuthReturn";
import {
  storeReturnState,
  storeSignInReturn,
  loadReturnState,
} from "./return-state";
const { replace, social } = vi.hoisted(() => ({
  replace: vi.fn(),
  social: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("./client", () => ({ authClient: { signIn: { social } } }));
const key = "a".repeat(43),
  state = {
    version: 1 as const,
    reportPath: "/reports/abc",
    locale: "en-US" as const,
    cursor: 20,
    selectedId: "row",
    difference: "highest" as const,
    scrollY: 400,
  };
function view() {
  render(
    <NextIntlClientProvider locale="en-US" messages={{ auth: en }}>
      <AuthReturn />
    </NextIntlClientProvider>,
  );
}
beforeEach(() => {
  sessionStorage.clear();
  replace.mockReset();
  social.mockReset();
  history.replaceState(null, "", "/auth/return");
  vi.unstubAllGlobals();
});
it("strips query immediately and completes an intent from the same-origin return page", async () => {
  storeReturnState(key, state);
  history.replaceState(null, "", `/auth/return?intent=${key}&code=secret`);
  const fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ reportPath: "/reports/abc" }),
  });
  vi.stubGlobal("fetch", fetch);
  view();
  expect(location.search).toBe("");
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/reports/abc"));
  expect(fetch).toHaveBeenCalledWith(
    "/api/library/save-intents/complete",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ token: key }),
    }),
  );
  expect(loadReturnState(key)).toEqual(state);
});
it("never claims for general sign-in and checks expected identity", async () => {
  storeSignInReturn(key, {
    returnPath: "/library?auth=secret",
    locale: "en-US",
    expectedUserId: "original",
  });
  history.replaceState(null, "", `/auth/return?flow=${key}`);
  const fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ account: { id: "other" } }),
  });
  vi.stubGlobal("fetch", fetch);
  view();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "different Discord account",
  );
  expect(replace).not.toHaveBeenCalled();
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("retains a failed intent across reload and retries saving without another OAuth", async () => {
  storeReturnState(key, state);
  history.replaceState(null, "", `/auth/return?intent=${key}`);
  const fetch = vi
    .fn()
    .mockResolvedValueOnce({
      ok: false,
      json: async () => ({ code: "AUTH_UNAVAILABLE" }),
    })
    .mockResolvedValue({
      ok: true,
      json: async () => ({ reportPath: "/reports/abc" }),
    });
  vi.stubGlobal("fetch", fetch);
  view();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "You're signed in, but this report wasn't saved. Try saving again.",
  );
  expect(sessionStorage.getItem("munigan.auth.active")).toContain(key);
  await userEvent.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() => expect(replace).toHaveBeenCalled());
  expect(social).not.toHaveBeenCalled();
});
it("explains lost flows without performing any claim", async () => {
  history.replaceState(null, "", `/auth/return?intent=${key}`);
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  view();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "missing or expired",
  );
  expect(fetch).not.toHaveBeenCalled();
});

it("validates a matching deletion return without sending a deletion request", async () => {
  const { storeDeletionReturn, loadDeletionReturn } =
    await import("./deletion-return");
  storeDeletionReturn(key, "account-a");
  storeSignInReturn(key, {
    returnPath: "/library",
    locale: "en-US",
    expectedUserId: "account-a",
  });
  history.replaceState(null, "", `/auth/return?flow=${key}`);
  const fetch = vi
    .fn()
    .mockResolvedValue(Response.json({ account: { id: "account-a" } }));
  vi.stubGlobal("fetch", fetch);
  view();
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/library"));
  expect(loadDeletionReturn()?.validated).toBe(true);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][0]).toBe("/api/account/session");
});

it("does not resume a stored intent after rejected OAuth state", async () => {
  storeReturnState(key, state);
  sessionStorage.setItem(
    "munigan.auth.active",
    JSON.stringify({ version: 1, kind: "intent", key }),
  );
  history.replaceState(null, "", "/auth/return?error=state_mismatch");
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  view();
  expect(await screen.findByRole("alert")).toHaveTextContent(en.returnLost);
  expect(fetch).not.toHaveBeenCalled();
  expect(replace).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: en.backGearLab })).toBeVisible();
});
