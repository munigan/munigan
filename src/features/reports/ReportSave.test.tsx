import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import en from "../../../messages/en-US/auth.json";
import { ReportSave } from "./ReportSave";
const { auth, social } = vi.hoisted(() => ({
  auth: {
    status: "anonymous",
    account: null as { id: string } | null,
    savingEnabled: true,
    enrollmentEnabled: true,
  },
  social: vi.fn(),
}));
vi.mock("../auth/AuthProvider", () => ({ useAccount: () => auth }));
vi.mock("../auth/client", () => ({ authClient: { signIn: { social } } }));
const access = {
  saved: false,
  effectiveExpiresAt: "2030-01-01T00:00:00Z",
  anonymousExpiresAt: "2030-01-01T00:00:00Z",
  canManage: true,
  canSave: true,
  canDelete: false,
};
const onSaved = vi.fn();
function view(props = {}) {
  return render(
    <NextIntlClientProvider
      locale="en-US"
      messages={{ auth: en, common: { close: "Close" } }}
    >
      <ReportSave token="report" access={access} onSaved={onSaved} {...props} />
    </NextIntlClientProvider>,
  );
}
beforeEach(() => {
  sessionStorage.clear();
  auth.status = "anonymous";
  auth.account = null;
  social.mockReset();
  onSaved.mockReset();
  vi.unstubAllGlobals();
});
it("opens only after click and dismissal leaves a quiet save action", async () => {
  view();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: "Dismiss save notice" }),
  );
  expect(screen.queryByText("Keep this report")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Save report" }));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});
it("never offers saving to a shared viewer", () => {
  view({ access: { ...access, canSave: false, canManage: false } });
  expect(
    screen.queryByRole("button", { name: "Save report" }),
  ).not.toBeInTheDocument();
});
it("direct saves authenticated owners and announces saved only after API success", async () => {
  auth.status = "authenticated";
  auth.account = { id: "owner" };
  let resolve!: (r: unknown) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise((r) => (resolve = r))),
  );
  view();
  await userEvent.click(screen.getByRole("button", { name: "Save report" }));
  expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  expect(onSaved).not.toHaveBeenCalled();
  resolve({ ok: true, json: async () => ({ reportPath: "/reports/report" }) });
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(screen.getByText("Report saved")).toBeInTheDocument();
});
it("keeps auth success separate from save failure", async () => {
  auth.status = "authenticated";
  auth.account = { id: "owner" };
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ code: "SAVING_UNAVAILABLE" }),
    }),
  );
  view();
  await userEvent.click(screen.getByRole("button", { name: "Save report" }));
  expect(await screen.findByRole("alert")).toBeInTheDocument();
  expect(onSaved).not.toHaveBeenCalled();
  expect(screen.queryByText("Report saved")).not.toBeInTheDocument();
});
it("stores context before leaving for Discord, using an explicit matching error callback", async () => {
  const intent = "x".repeat(43);
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ token: intent }) }),
  );
  social.mockResolvedValue({});
  view();
  await userEvent.click(screen.getByRole("button", { name: "Save report" }));
  await userEvent.click(
    screen.getByRole("button", { name: "Continue with Discord" }),
  );
  await waitFor(() =>
    expect(social).toHaveBeenCalledWith({
      provider: "discord",
      callbackURL: `/auth/return?intent=${intent}`,
      errorCallbackURL: `/auth/return?intent=${intent}`,
    }),
  );
  expect(sessionStorage.getItem(`munigan.auth.report.${intent}`)).toContain(
    "/reports/report",
  );
  expect(onSaved).not.toHaveBeenCalled();
});

it("translates owner-cookie failures without rendering server exception text", async () => {
  auth.status = "authenticated";
  auth.account = { id: "owner" };
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        code: "OWNER_COOKIE_REQUIRED",
        error: "private database detail",
      }),
    }),
  );
  view();
  await userEvent.click(screen.getByRole("button", { name: "Save report" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "original browser",
  );
  expect(screen.queryByText(/private database detail/)).not.toBeInTheDocument();
});

it("describes shared retained reports without claiming they are in the viewer library", () => {
  view({
    access: {
      ...access,
      saved: true,
      canManage: false,
      canSave: false,
      effectiveExpiresAt: null,
    },
  });
  expect(screen.getByRole("status")).toHaveTextContent(
    "Shared report · read only",
  );
  expect(screen.queryByText("Report saved")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Save report" }),
  ).not.toBeInTheDocument();
});
it("reserves personal-library wording for authenticated owners", () => {
  auth.status = "authenticated";
  auth.account = { id: "owner" };
  view({ access: { ...access, saved: true, effectiveExpiresAt: null } });
  expect(screen.getByRole("status")).toHaveTextContent("Report saved");
});

it("does not carry personal save-success wording into another account", async () => {
  auth.status = "authenticated";
  auth.account = { id: "owner" };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  const first = view();
  await userEvent.click(screen.getByRole("button", { name: "Save report" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Report saved");
  auth.account = { id: "other" };
  first.rerender(
    <NextIntlClientProvider
      locale="en-US"
      messages={{ auth: en, common: { close: "Close" } }}
    >
      <ReportSave
        token="report"
        access={{ ...access, canManage: false, canSave: false }}
        onSaved={onSaved}
      />
    </NextIntlClientProvider>,
  );
  expect(screen.getByRole("status")).toHaveTextContent(
    "Shared report · read only",
  );
});
