import { NextIntlClientProvider } from "next-intl";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { messages as en } from "@/i18n/messages-en";
import { messages as pt } from "@/i18n/messages-pt";
import { WorkbenchHeader } from "./WorkbenchNavigation";

const mocks = vi.hoisted(() => ({
  useAccount: vi.fn(),
  switchLocale: vi.fn(),
  persistLocale: vi.fn(),
  pathname: "/library",
  locale: "en-US",
}));
vi.mock("@/features/auth/AuthProvider", () => ({
  useAccount: mocks.useAccount,
}));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));
vi.mock("@/i18n/LocaleProvider", () => ({
  useAppLocale: () => ({
    locale: mocks.locale,
    area: "library",
    switching: false,
    switchLocale: mocks.switchLocale,
    persistLocale: mocks.persistLocale,
  }),
}));

function view(locale: "en-US" | "pt-BR" = "en-US") {
  mocks.locale = locale;
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "pt-BR" ? pt : en}
    >
      <WorkbenchHeader />
    </NextIntlClientProvider>
  );
}
async function openMenu() {
  await userEvent.click(
    screen.getByRole("button", { name: "Open navigation" }),
  );
  return within(await screen.findByRole("dialog"));
}

describe("responsive tool switcher", () => {
  beforeEach(() => {
    mocks.pathname = "/library";
    mocks.switchLocale.mockReset();
    mocks.useAccount.mockReturnValue({
      status: "authenticated",
      account: { id: "1", name: "Munigan", image: null },
      signOut: vi.fn(),
      refresh: vi.fn(),
    });
  });
  it("shows the active library card and keeps account actions behind the account view", async () => {
    render(view());
    const menu = await openMenu();
    expect(menu.getByRole("link", { name: /My Library/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      menu.queryByRole("button", { name: "Delete account" }),
    ).not.toBeInTheDocument();
    await userEvent.click(menu.getByRole("button", { name: "Account menu" }));
    expect(menu.getByRole("button", { name: "Sign out" })).toBeVisible();
    expect(menu.getByRole("button", { name: "Delete account" })).toBeVisible();
    expect(menu.getByRole("button", { name: "Back" })).toHaveFocus();
    await userEvent.click(menu.getByRole("button", { name: "Back" }));
    expect(menu.getByRole("button", { name: "Account menu" })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(
      screen.getByRole("button", { name: "Open navigation" }),
    ).toHaveFocus();
  });
  it("offers languages within the drawer and expands unavailable future tools", async () => {
    render(view());
    const menu = await openMenu();
    await userEvent.click(menu.getByRole("button", { name: "Language" }));
    expect(menu.getByRole("button", { name: "English" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(
      menu.getByRole("button", { name: "Português (Brasil)" }),
    );
    expect(mocks.switchLocale).toHaveBeenCalledWith("pt-BR");
    await userEvent.click(menu.getByRole("button", { name: "Back" }));
    await userEvent.click(menu.getByRole("button", { name: /More tools/ }));
    expect(menu.getByText("Raid Upgrades").parentElement).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
  it("closes after choosing a tool and marks reports as Gear Lab", async () => {
    mocks.pathname = "/reports/example";
    render(view());
    const menu = await openMenu();
    expect(menu.getByRole("link", { name: /Gear Lab/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await userEvent.click(menu.getByRole("link", { name: /My Library/ }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("localizes the drawer and offers Discord sign-in to guests", async () => {
    mocks.useAccount.mockReturnValue({ status: "anonymous", account: null });
    render(view("pt-BR"));
    await userEvent.click(
      screen.getByRole("button", { name: pt.shell.openNavigation }),
    );
    const menu = within(await screen.findByRole("dialog"));
    expect(menu.getByText("Para onde vamos?")).toBeVisible();
    expect(menu.getByRole("button", { name: pt.auth.signIn })).toBeVisible();
    expect(
      menu.getByRole("link", { name: /Meus resultados|Minha biblioteca/i }),
    ).toBeVisible();
  });
});
