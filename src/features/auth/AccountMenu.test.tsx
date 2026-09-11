import { NextIntlClientProvider } from "next-intl";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountMenu } from "./AccountMenu";

const mocks = vi.hoisted(() => ({ useAccount: vi.fn() }));
vi.mock("./AuthProvider", () => ({ useAccount: mocks.useAccount }));
vi.mock("next/navigation", () => ({ usePathname: () => "/top-gear" }));

const messages = { auth: { loading: "Loading account", retry: "Retry account", signIn: "Sign in", accountMenu: "Account menu", discordAccount: "Signed in with Discord", library: "My Library", libraryHint: "Your saved work across munigan.app.", signOut: "Sign out", deleteAccount: "Delete account", signOutFailed: "Could not sign out.", retrySignOut: "Retry sign out", title: "Welcome", description: "Description", continueDiscord: "Continue with Discord", continueAnonymous: "Continue without signing in", returnNotice: "Return", invalidCallback: "Invalid", signInFailed: "Failed", errors: { AUTH_UNAVAILABLE: "We couldn't check your session. Try again." } }, common: { close: "Close" } };
const base = { savingEnabled: true, enrollmentEnabled: false, refresh: vi.fn(), signOut: vi.fn() };
function view(mobile = false) { return <NextIntlClientProvider locale="en-US" messages={messages}><AccountMenu mobile={mobile} /></NextIntlClientProvider>; }

describe("AccountMenu", () => {
  beforeEach(() => { mocks.useAccount.mockReset(); base.refresh.mockReset(); base.signOut.mockReset(); });

  it("keeps the same reserved control slot through loading, authenticated, and unavailable states", () => {
    mocks.useAccount.mockReturnValue({ ...base, status: "loading", account: null });
    const rendered = render(view());
    expect(rendered.container.querySelector(".auth-control")).toHaveClass("auth-loading");
    mocks.useAccount.mockReturnValue({ ...base, status: "authenticated", account: { id: "1", name: "A very long Discord display name", image: null } });
    rendered.rerender(view());
    expect(rendered.container.querySelector(".auth-control")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Account menu" })).toBeInTheDocument();
    mocks.useAccount.mockReturnValue({ ...base, status: "unavailable", account: null });
    rendered.rerender(view());
    expect(rendered.container.querySelector(".auth-control")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "We couldn't check your session. Try again.",
    );
    expect(screen.getByRole("button", { name: "Retry account" })).toBeInTheDocument();
  });

  it("supports keyboard account-menu navigation", async () => {
    mocks.useAccount.mockReturnValue({ ...base, status: "authenticated", account: { id: "1", name: "Munigan", image: null } });
    render(view());
    const trigger = screen.getByRole("button", { name: "Account menu" });
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByRole("menu")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "My Library" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Sign out" })).toHaveFocus();
    expect(screen.getByRole("menuitem", { name: "Delete account" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(trigger).toHaveFocus();
  });

  it("exposes all account actions directly in mobile navigation", () => {
    mocks.useAccount.mockReturnValue({ ...base, status: "authenticated", account: { id: "1", name: "Munigan", image: null } });
    render(view(true));
    expect(screen.getByRole("link", { name: "My Library" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Delete account" })).toBeVisible();
  });

  it("retains the account and offers a translated retry when sign-out fails", async () => {
    base.signOut.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(undefined);
    mocks.useAccount.mockReturnValue({ ...base, status: "authenticated", account: { id: "1", name: "Munigan", image: null } });
    render(view());
    await userEvent.click(screen.getByRole("button", { name: "Account menu" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Sign out" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not sign out");
    expect(screen.getByRole("button", { name: "Account menu" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry sign out" }));
    await waitFor(() => expect(base.signOut).toHaveBeenCalledTimes(2));
  });
});
