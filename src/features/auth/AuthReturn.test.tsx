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
  loadSignInReturn,
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
  return render(
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
    en.errors.AUTH_UNAVAILABLE,
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
  const first = view();
  expect(await screen.findByRole("alert")).toHaveTextContent(en.returnLost);
  first.unmount();
  expect(location.search).toBe("");
  view();
  expect(await screen.findByRole("alert")).toHaveTextContent(en.returnLost);
  expect(loadReturnState(key)).toBeNull();
  expect(sessionStorage.getItem("munigan.auth.active")).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
  expect(replace).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: en.backGearLab })).toBeVisible();
});

it("invalidates only the rejected sign-in and matching deletion context across reload", async () => {
  const { storeDeletionReturn, loadDeletionReturn } =
    await import("./deletion-return");
  storeDeletionReturn(key, "account-a");
  storeSignInReturn(key, {
    returnPath: "/library",
    locale: "en-US",
    expectedUserId: "account-a",
  });
  const other = "b".repeat(43);
  storeReturnState(other, state);
  sessionStorage.setItem("munigan.top-gear.admission", "unrelated-draft");
  sessionStorage.setItem(
    "munigan.auth.active",
    JSON.stringify({ version: 1, kind: "flow", key }),
  );
  history.replaceState(null, "", "/auth/return?error=state_mismatch");
  const fetch = vi
    .fn()
    .mockResolvedValue(Response.json({ account: { id: "account-a" } }));
  vi.stubGlobal("fetch", fetch);
  const first = view();
  await screen.findByRole("alert");
  first.unmount();
  view();
  expect(await screen.findByRole("alert")).toHaveTextContent(en.returnLost);
  expect(fetch).not.toHaveBeenCalled();
  expect(replace).not.toHaveBeenCalled();
  expect(loadSignInReturn(key)).toBeNull();
  expect(loadDeletionReturn()).toBeNull();
  expect(loadReturnState(other)).toEqual(state);
  expect(sessionStorage.getItem("munigan.top-gear.admission")).toBe(
    "unrelated-draft",
  );
});

it("preserves successful reload recovery for a save failure without rejected state", async () => {
  storeReturnState(key, state);
  history.replaceState(null, "", `/auth/return?intent=${key}`);
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({ code: "AUTH_UNAVAILABLE" }, { status: 503 }),
    )
    .mockResolvedValue(Response.json({ reportPath: state.reportPath }));
  vi.stubGlobal("fetch", fetch);
  const first = view();
  await screen.findByRole("alert");
  first.unmount();
  expect(location.search).toBe("");
  view();
  await waitFor(() => expect(replace).toHaveBeenCalledWith(state.reportPath));
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(social).not.toHaveBeenCalled();
});

it("does not clear deletion reconfirmation owned by a different flow", async () => {
  const { storeDeletionReturn, loadDeletionReturn } =
    await import("./deletion-return");
  const other = "b".repeat(43);
  storeDeletionReturn(other, "account-a");
  storeSignInReturn(key, { returnPath: "/library", locale: "en-US" });
  sessionStorage.setItem(
    "munigan.auth.active",
    JSON.stringify({ version: 1, kind: "flow", key }),
  );
  history.replaceState(null, "", "/auth/return?error=state_mismatch");
  vi.stubGlobal("fetch", vi.fn());
  view();
  await screen.findByRole("alert");
  expect(loadDeletionReturn()?.flow).toBe(other);
  expect(loadSignInReturn(key)).toBeNull();
});

it.each(["access_denied", "server_error", ""])(
  "invalidates provider error %s for a first return and clean reload",
  async (error) => {
    storeReturnState(key, state);
    history.replaceState(null, "", `/auth/return?intent=${key}&error=${error}`);
    const fetch = vi
      .fn()
      .mockResolvedValue(Response.json({ reportPath: state.reportPath }));
    vi.stubGlobal("fetch", fetch);
    const first = view();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      en.returnOAuthFailed,
    );
    expect(replace).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: en.back }));
    expect(replace).toHaveBeenCalledWith(state.reportPath);
    replace.mockClear();
    first.unmount();
    expect(location.search).toBe("");
    view();
    expect(await screen.findByRole("alert")).toHaveTextContent(en.returnLost);
    expect(loadReturnState(key)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  },
);
it.each([false, true])(
  "provider denial invalidates sign-in and deletion=%s despite an existing session",
  async (deletion) => {
    const { storeDeletionReturn, loadDeletionReturn } =
      await import("./deletion-return");
    if (deletion) storeDeletionReturn(key, "account-a");
    const other = "b".repeat(43);
    storeReturnState(other, state);
    sessionStorage.setItem("munigan.top-gear.admission", "unrelated-draft");
    storeSignInReturn(key, {
      returnPath: "/library",
      locale: "en-US",
      expectedUserId: "account-a",
    });
    history.replaceState(
      null,
      "",
      `/auth/return?flow=${key}&error=access_denied`,
    );
    const fetch = vi
      .fn()
      .mockResolvedValue(Response.json({ account: { id: "account-a" } }));
    vi.stubGlobal("fetch", fetch);
    const first = view();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      en.returnOAuthFailed,
    );
    first.unmount();
    view();
    expect(await screen.findByRole("alert")).toHaveTextContent(en.returnLost);
    expect(loadSignInReturn(key)).toBeNull();
    expect(loadReturnState(other)).toEqual(state);
    expect(sessionStorage.getItem("munigan.top-gear.admission")).toBe(
      "unrelated-draft",
    );
    expect(loadDeletionReturn()).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  },
);
it.each(["OWNER_COOKIE_REQUIRED", "AUTH_UNAVAILABLE"] as const)(
  "explains completion %s without claiming authentication succeeded",
  async (code) => {
    storeReturnState(key, state);
    history.replaceState(null, "", `/auth/return?intent=${key}`);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ code }, { status: 503 })),
    );
    view();
    expect(await screen.findByRole("alert")).toHaveTextContent(en.errors[code]);
    expect(loadReturnState(key)).toEqual(state);
  },
);
