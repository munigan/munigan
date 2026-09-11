import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { messages } from "@/i18n/messages-en";
import { DeleteAccountDialog } from "./DeleteAccountDialog";
import { storeDeletionReturn, validateDeletionReturn } from "./deletion-return";
const { auth, social } = vi.hoisted(() => ({
  auth: {
    status: "authenticated",
    account: { id: "a", name: "Discord A", image: null },
    accountDeleted: vi.fn(),
    refresh: vi.fn(),
  },
  social: vi.fn(),
}));
vi.mock("./AuthProvider", () => ({ useAccount: () => auth }));
vi.mock("./client", () => ({ authClient: { signIn: { social } } }));
const tree = () => (
  <NextIntlClientProvider locale="en-US" messages={messages}>
    <DeleteAccountDialog open onOpenChange={vi.fn()} />
  </NextIntlClientProvider>
);
beforeEach(() => {
  auth.status = "authenticated";
  auth.account = { id: "a", name: "Discord A", image: null };
  auth.accountDeleted.mockReset();
  social.mockReset();
  sessionStorage.clear();
  localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("names the account and only clears app draft/return keys after successful deletion", async () => {
  localStorage.setItem("wow-droptimizer.top-gear.v1", "draft");
  localStorage.setItem("munigan.top-gear.import.v1", "draft");
  localStorage.setItem("unrelated", "keep");
  sessionStorage.setItem("munigan.auth.active", "flow");
  sessionStorage.setItem("munigan.top-gear.admission", "attempt");
  sessionStorage.setItem("unrelated", "keep");
  let release!: (r: Response) => void;
  const fetch = vi.fn().mockReturnValue(
    new Promise<Response>((r) => {
      release = r;
    }),
  );
  vi.stubGlobal("fetch", fetch);
  render(tree());
  expect(screen.getByRole("dialog")).toHaveTextContent("Discord A");
  await userEvent.click(
    screen.getByRole("button", { name: "Delete my account" }),
  );
  expect(localStorage.getItem("wow-droptimizer.top-gear.v1")).toBe("draft");
  expect(screen.getByRole("button", { name: "Deleting…" })).toBeDisabled();
  await act(async () =>
    release(Response.json({ status: "deleting" }, { status: 202 })),
  );
  expect(screen.getByRole("status")).toHaveTextContent("cleanup is processing");
  expect(fetch).toHaveBeenCalledWith(
    "/api/account/delete",
    expect.objectContaining({
      method: "POST",
      body: '{"expectedUserId":"a"}',
      credentials: "same-origin",
    }),
  );
  expect(auth.accountDeleted).toHaveBeenCalledOnce();
  expect(localStorage.getItem("wow-droptimizer.top-gear.v1")).toBeNull();
  expect(localStorage.getItem("munigan.top-gear.import.v1")).toBeNull();
  expect(sessionStorage.getItem("munigan.auth.active")).toBeNull();
  expect(sessionStorage.getItem("munigan.top-gear.admission")).toBeNull();
  expect(localStorage.getItem("unrelated")).toBe("keep");
  expect(sessionStorage.getItem("unrelated")).toBe("keep");
});
it("requires an explicit Discord action for freshness and another confirmation after validated return", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      Response.json({ code: "FRESH_LOGIN_REQUIRED" }, { status: 409 }),
    );
  vi.stubGlobal("fetch", fetch);
  social.mockResolvedValue({ error: null });
  const view = render(tree());
  await userEvent.click(
    screen.getByRole("button", { name: "Delete my account" }),
  );
  expect(social).not.toHaveBeenCalled();
  await userEvent.click(
    screen.getByRole("button", { name: "Verify with Discord" }),
  );
  const callback = social.mock.calls[0][0].callbackURL;
  const key = callback.split("=")[1];
  expect(
    JSON.parse(sessionStorage.getItem(`munigan.auth.signin.${key}`)!).value
      .expectedUserId,
  ).toBe("a");
  expect(social.mock.calls[0][0].errorCallbackURL).toBe(callback);
  validateDeletionReturn(key, "a");
  view.unmount();
  render(tree());
  expect(screen.getByRole("dialog")).toHaveTextContent("Confirm again");
  expect(fetch).toHaveBeenCalledTimes(1);
  await userEvent.click(
    screen.getByRole("button", { name: "Delete my account" }),
  );
  expect(fetch).toHaveBeenCalledTimes(2);
});
it("hides the old account profile and blocks deletion after an account switch", async () => {
  vi.stubGlobal("fetch", vi.fn());
  const view = render(tree());
  auth.account = { ...auth.account, id: "b", name: "Discord B" };
  view.rerender(tree());
  expect(screen.queryByText("Discord A")).not.toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent(
    "different Discord account",
  );
  expect(
    screen.queryByRole("button", { name: "Delete my account" }),
  ).not.toBeInTheDocument();
});
it("refuses a reauthentication context belonging to a different account", async () => {
  storeDeletionReturn("a".repeat(43), "other");
  validateDeletionReturn("a".repeat(43), "other");
  vi.stubGlobal("fetch", vi.fn());
  render(tree());
  expect(screen.getByRole("alert")).toHaveTextContent(
    "different Discord account",
  );
  expect(screen.queryByText("Discord A")).not.toBeInTheDocument();
});
it("keeps drafts and offers retry on a failed deletion", async () => {
  localStorage.setItem("wow-droptimizer.top-gear.v1", "draft");
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
  render(tree());
  await userEvent.click(
    screen.getByRole("button", { name: "Delete my account" }),
  );
  await waitFor(() => expect(screen.getByRole("alert")).toBeVisible());
  expect(localStorage.getItem("wow-droptimizer.top-gear.v1")).toBe("draft");
  expect(
    screen.getByRole("button", { name: "Delete my account" }),
  ).toBeEnabled();
});
