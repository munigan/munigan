import { NextIntlClientProvider } from "next-intl";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { SignInDialog } from "./SignInDialog";

const { social } = vi.hoisted(() => ({ social: vi.fn() }));
vi.mock("./client", () => ({ authClient: { signIn: { social } } }));

const messages = {
  auth: {
    title: "Welcome",
    description: "Keep reports together.",
    continueDiscord: "Continue with Discord",
    continueAnonymous: "Continue without signing in",
    returnNotice: "You will return here.",
    invalidCallback: "This sign-in link is invalid.",
    signInFailed: "Sign-in could not start.",
  },
  common: { close: "Close" },
};

describe("SignInDialog", () => {
  beforeEach(() => social.mockReset());

  it("does not open automatically and returns focus after Escape", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open sign in</button>
          <SignInDialog
            open={open}
            onOpenChange={setOpen}
            callbackPath="/top-gear"
          />
        </>
      );
    }
    render(
      <NextIntlClientProvider locale="en-US" messages={messages}>
        <Harness />
      </NextIntlClientProvider>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const trigger = screen.getByRole("button", { name: "Open sign in" });
    await userEvent.click(trigger);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("starts Discord sign-in with explicit same-origin return and error paths", async () => {
    social.mockResolvedValue({ data: null, error: null });
    render(
      <NextIntlClientProvider locale="en-US" messages={messages}>
        <SignInDialog
          open
          onOpenChange={vi.fn()}
          callbackPath="/reports/token?cursor=2"
        />
      </NextIntlClientProvider>,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Continue with Discord" }),
    );
    const options = social.mock.calls[0][0];
    expect(options.callbackURL).toMatch(
      /^\/auth\/return\?flow=[A-Za-z0-9_-]+$/,
    );
    expect(options.errorCallbackURL).toBe(options.callbackURL);
    expect(
      sessionStorage.getItem(
        `munigan.auth.signin.${options.callbackURL.split("=")[1]}`,
      ),
    ).toContain("/reports/token");
    expect(
      sessionStorage.getItem(
        `munigan.auth.signin.${options.callbackURL.split("=")[1]}`,
      ),
    ).not.toContain("cursor");
  });

  it("rejects absolute and auth callback paths", async () => {
    render(
      <NextIntlClientProvider locale="en-US" messages={messages}>
        <SignInDialog
          open
          onOpenChange={vi.fn()}
          callbackPath="https://evil.example/"
        />
      </NextIntlClientProvider>,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Continue with Discord" }),
    );
    expect(social).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("invalid");
  });
});
