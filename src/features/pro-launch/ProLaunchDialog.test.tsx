import { NextIntlClientProvider } from "next-intl";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import common from "../../../messages/en-US/common.json";
import pro from "../../../messages/en-US/pro.json";
import proPt from "../../../messages/pt-BR/pro.json";
import {
  DISCORD_COMMUNITY_INVITE,
  DISCORD_PRO_INVITE,
} from "@/domain/pro-launch/discord";
import { ProLaunchDialog, type ProDialogState } from "./ProLaunchDialog";

vi.mock("next/navigation", () => ({ usePathname: () => "/gear-lab" }));

const account = { id: "account-1", name: "Munigaan", image: null };

function renderDialog(
  state: ProDialogState,
  options: {
    locale?: "en-US" | "pt-BR";
    onOpenChange?: (open: boolean) => void;
  } = {},
) {
  const handlers = {
    onOpenChange: options.onOpenChange ?? vi.fn(),
    onSignIn: vi.fn(),
    onJoin: vi.fn(),
    onRetry: vi.fn(),
  };
  render(
    <NextIntlClientProvider
      locale={options.locale ?? "en-US"}
      messages={{ common, pro: options.locale === "pt-BR" ? proPt : pro }}
    >
      <ProLaunchDialog open state={state} {...handlers} />
    </NextIntlClientProvider>,
  );
  return handlers;
}

describe("ProLaunchDialog", () => {
  it("keeps Discord sign-in separate from launch-list signup", async () => {
    const handlers = renderDialog({
      kind: "anonymous",
      signingIn: false,
      error: null,
    });
    expect(
      screen.getByRole("dialog", {
        name: "Meet munigan PRO.",
        description:
          "More ways to find your next DPS gain. Here’s what we’re building for the paid plan.",
      }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Continue with Discord" }),
    );
    expect(handlers.onSignIn).toHaveBeenCalledOnce();
    expect(handlers.onJoin).not.toHaveBeenCalled();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.queryByText(/\$|per month|por mês/i)).not.toBeInTheDocument();
  });

  it("shows the signed-in account and joins only from the signup action", async () => {
    const handlers = renderDialog({
      kind: "ready",
      account,
      joining: false,
      error: null,
    });
    expect(screen.getByText("Munigaan")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Join the PRO list" }),
    );
    expect(handlers.onJoin).toHaveBeenCalledOnce();
  });

  it("disables pending signup while leaving close available", async () => {
    const handlers = renderDialog({
      kind: "ready",
      account,
      joining: true,
      error: "We couldn’t confirm your signup.",
    });
    expect(screen.getByRole("button", { name: "Joining…" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Joining…");
    expect(screen.getByRole("alert")).toHaveTextContent("confirm your signup");
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(handlers.onOpenChange).toHaveBeenCalledWith(false);
  });

  it.each([
    ["auth_loading", "Checking your account…"],
    ["membership_loading", "Checking your launch-list status…"],
  ] as const)("announces the %s state", (kind, label) => {
    renderDialog(kind === "auth_loading" ? { kind } : { kind, account });
    expect(screen.getByRole("status")).toHaveTextContent(label);
    if (kind === "membership_loading")
      expect(screen.getByText("Munigaan")).toBeInTheDocument();
  });

  it.each([
    ["auth_unavailable", "We couldn’t check your Discord sign-in."],
    ["membership_error", "We couldn’t check your launch-list status."],
  ] as const)("announces and retries the %s state", async (kind, label) => {
    const handlers = renderDialog(
      kind === "auth_unavailable" ? { kind } : { kind, account },
    );
    expect(screen.getByRole("alert")).toHaveTextContent(label);
    if (kind === "membership_error")
      expect(screen.getByText("Munigaan")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(handlers.onRetry).toHaveBeenCalledOnce();
  });

  it("offers optional Discord notifications after signup without joining again", async () => {
    const handlers = renderDialog({ kind: "joined", account });
    expect(screen.getByText("You’re on the list.")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Join the PRO list" }),
    ).not.toBeInTheDocument();
    const invite = screen.getByRole("link", {
      name: "Enable Discord notifications",
    });
    expect(invite).toHaveAttribute("href", DISCORD_PRO_INVITE);
    expect(invite).toHaveAttribute("target", "_blank");
    expect(invite).toHaveAttribute("rel", "noopener noreferrer");
    await userEvent.click(invite);
    expect(handlers.onJoin).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: "Back to Gear Lab" }),
    );
    expect(handlers.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders the optional role and removal guidance in Portuguese", () => {
    renderDialog({ kind: "joined", account }, { locale: "pt-BR" });
    expect(screen.getByText("Você está na lista.")).toBeInTheDocument();
    expect(
      screen.getByText(/cargo PRO Launch.*menções no canal/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/remoção do cargo.*suporte/i)).toBeInTheDocument();
  });

  it("uses the approved public Discord URLs", () => {
    expect(DISCORD_COMMUNITY_INVITE).toBe("https://discord.gg/vtK8Zvs6EG");
    expect(DISCORD_PRO_INVITE).toBe("https://discord.gg/79SMq4A7vg");
  });

  it("supports Escape dismissal and explicit final focus", async () => {
    const focusTarget = document.createElement("button");
    document.body.append(focusTarget);
    const onOpenChange = vi.fn();
    function Harness() {
      const [open, setOpen] = useState(true);
      return (
        <ProLaunchDialog
          open={open}
          state={{ kind: "joined", account }}
          onOpenChange={(nextOpen) => {
            onOpenChange(nextOpen);
            setOpen(nextOpen);
          }}
          onSignIn={vi.fn()}
          onJoin={vi.fn()}
          onRetry={vi.fn()}
          finalFocus={() => focusTarget}
        />
      );
    }
    render(
      <NextIntlClientProvider locale="en-US" messages={{ common, pro }}>
        <Harness />
      </NextIntlClientProvider>,
    );
    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(focusTarget).toHaveFocus();
    focusTarget.remove();
  });
});
