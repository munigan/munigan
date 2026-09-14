import { NextIntlClientProvider } from "next-intl";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { messages as en } from "@/i18n/messages-en";
import { storeProLaunchResume } from "./resume";
import {
  ProLaunchProvider,
  proBeforeSignInEvent,
  useProLaunch,
} from "./ProLaunchProvider";

const mocks = vi.hoisted(() => ({
  auth: {} as {
    status: "loading" | "anonymous" | "authenticated" | "unavailable";
    account: { id: string; name: string; image: string | null } | null;
    refresh: ReturnType<typeof vi.fn>;
    signOut: ReturnType<typeof vi.fn>;
    accountDeleted: ReturnType<typeof vi.fn>;
  },
  pathname: "/gear-lab",
  beginSignIn: vi.fn(),
  signingIn: false,
  signInError: null as string | null,
}));
vi.mock("@/features/auth/AuthProvider", () => ({
  useAccount: () => mocks.auth,
}));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));
vi.mock("@/features/auth/useDiscordSignIn", () => ({
  useDiscordSignIn: () => ({
    beginSignIn: mocks.beginSignIn,
    pending: mocks.signingIn,
    error: mocks.signInError,
  }),
}));

function Trigger() {
  const pro = useProLaunch();
  return (
    <button onClick={(event) => pro.open("header", event.currentTarget)}>
      Open PRO
    </button>
  );
}
function view() {
  return (
    <NextIntlClientProvider locale="en-US" messages={en}>
      <ProLaunchProvider>
        <Trigger />
      </ProLaunchProvider>
    </NextIntlClientProvider>
  );
}
function response(payload: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(payload), { status }));
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}
const joined = {
  status: "joined",
  joinedAt: "2026-09-14T12:00:00.000Z",
  offerVersion: "pro-launch-v1",
};

describe("ProLaunchProvider", () => {
  beforeEach(() => {
    sessionStorage.clear();
    mocks.pathname = "/gear-lab";
    mocks.auth = {
      status: "authenticated",
      account: { id: "account-a", name: "Account A", image: null },
      refresh: vi.fn().mockResolvedValue(undefined),
      signOut: vi.fn(),
      accountDeleted: vi.fn(),
    };
    mocks.beginSignIn.mockReset();
    mocks.signingIn = false;
    mocks.signInError = null;
    vi.unstubAllGlobals();
  });

  it("joins once with the displayed account, source, locale, and consent", async () => {
    const post = deferred<Response>();
    const fetchMock = vi.fn((_url: string, init?: RequestInit) =>
      init?.method === "POST"
        ? post.promise
        : response({ status: "not_joined" }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(view());
    await userEvent.click(screen.getByRole("button", { name: "Open PRO" }));
    const join = await screen.findByRole("button", {
      name: "Join the PRO list",
    });
    await userEvent.click(join);
    await userEvent.click(join);
    const postCalls = fetchMock.mock.calls.filter(
      ([, init]) => init?.method === "POST",
    );
    expect(postCalls).toHaveLength(1);
    expect(JSON.parse(String(postCalls[0][1]?.body))).toEqual({
      expectedUserId: "account-a",
      source: "header",
      locale: "en-US",
      consentVersion: "pro-discord-launch-v1",
    });
    await act(async () => post.resolve(new Response(JSON.stringify(joined))));
    expect(await screen.findByText("You’re on the list.")).toBeVisible();
  });

  it("does not call membership APIs for anonymous or unavailable auth", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    mocks.auth = { ...mocks.auth, status: "anonymous", account: null };
    const rendered = render(view());
    await userEvent.click(screen.getByRole("button", { name: "Open PRO" }));
    expect(
      screen.getByRole("button", { name: "Continue with Discord" }),
    ).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
    rendered.unmount();
    mocks.auth = { ...mocks.auth, status: "unavailable", account: null };
    render(view());
    await userEvent.click(screen.getByRole("button", { name: "Open PRO" }));
    expect(
      screen.getByText(/couldn’t check your Discord sign-in/),
    ).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("cancels sign-in when preservation fails", async () => {
    mocks.auth = { ...mocks.auth, status: "anonymous", account: null };
    vi.stubGlobal("fetch", vi.fn());
    const reject = (event: Event) => event.preventDefault();
    window.addEventListener(proBeforeSignInEvent, reject);
    render(view());
    await userEvent.click(screen.getByRole("button", { name: "Open PRO" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Continue with Discord" }),
    );
    expect(mocks.beginSignIn).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "couldn’t save your current work",
    );
    window.removeEventListener(proBeforeSignInEvent, reject);
  });

  it("discards a late account A write after account B appears", async () => {
    const post = deferred<Response>();
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => response({ status: "not_joined" }))
      .mockImplementationOnce(() => post.promise)
      .mockImplementationOnce(() => response({ status: "not_joined" }));
    vi.stubGlobal("fetch", fetchMock);
    const rendered = render(view());
    await userEvent.click(screen.getByRole("button", { name: "Open PRO" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Join the PRO list" }),
    );
    mocks.auth = {
      ...mocks.auth,
      account: { id: "account-b", name: "Account B", image: null },
    };
    rendered.rerender(view());
    await act(async () => post.resolve(new Response(JSON.stringify(joined))));
    expect(await screen.findByText("Account B")).toBeVisible();
    expect(screen.queryByText("You’re on the list.")).not.toBeInTheDocument();
    expect(screen.queryByText("Account A")).not.toBeInTheDocument();
  });

  it("re-reads status after an uncertain write is closed", async () => {
    const post = deferred<Response>();
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => response({ status: "not_joined" }))
      .mockImplementationOnce(() => post.promise)
      .mockImplementationOnce(() => response(joined));
    vi.stubGlobal("fetch", fetchMock);
    render(view());
    await userEvent.click(screen.getByRole("button", { name: "Open PRO" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Join the PRO list" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    post.resolve(new Response(JSON.stringify(joined)));
    await userEvent.click(screen.getByRole("button", { name: "Open PRO" }));
    expect(await screen.findByText("You’re on the list.")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("shows status failures and retries the persisted membership read", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => response({ code: "AUTH_UNAVAILABLE" }, 503))
      .mockImplementationOnce(() => response({ status: "not_joined" }));
    vi.stubGlobal("fetch", fetchMock);
    render(view());
    await userEvent.click(screen.getByRole("button", { name: "Open PRO" }));
    expect(
      await screen.findByText(/couldn’t check your launch-list status/),
    ).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("button", { name: "Join the PRO list" }),
    ).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("refreshes auth after an account-changing join response and requires another click", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => response({ status: "not_joined" }))
      .mockImplementationOnce(() => response({ code: "ACCOUNT_CHANGED" }, 409));
    vi.stubGlobal("fetch", fetchMock);
    render(view());
    await userEvent.click(screen.getByRole("button", { name: "Open PRO" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Join the PRO list" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "account changed",
    );
    expect(mocks.auth.refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      screen.getByRole("button", { name: "Join the PRO list" }),
    ).toBeEnabled();
  });

  it("refreshes auth once and resumes only after the matching account resolves", async () => {
    storeProLaunchResume({
      userId: "account-a",
      returnPath: "/gear-lab",
      source: "gear_limit",
    });
    mocks.auth = { ...mocks.auth, status: "anonymous", account: null };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => response({ status: "not_joined" })),
    );
    const rendered = render(view());
    expect(mocks.auth.refresh).toHaveBeenCalledTimes(1);
    rendered.rerender(view());
    expect(mocks.auth.refresh).toHaveBeenCalledTimes(1);
    mocks.auth = {
      ...mocks.auth,
      status: "authenticated",
      account: { id: "account-a", name: "Account A", image: null },
    };
    rendered.rerender(view());
    expect(
      await screen.findByRole("button", { name: "Join the PRO list" }),
    ).toBeVisible();
  });
});
