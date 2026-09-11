import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { messages } from "@/i18n/messages-en";
import { LibraryView } from "./LibraryView";
const { auth, push } = vi.hoisted(() => ({
  auth: {
    status: "authenticated",
    account: { id: "a", name: "Account A", image: null },
    refresh: vi.fn(),
  },
  push: vi.fn(),
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAccount: () => auth }));
vi.mock("@/features/auth/client", () => ({
  authClient: { signIn: { social: vi.fn() } },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
export const item = {
  id: "item-a",
  title: "Best gear",
  tool: "top-gear",
  kind: "report",
  summary: {
    characterName: "Character A",
    classKey: "mage",
    specKey: "mage:FireTalents",
    level: 80,
    dps: 12000,
    gainDps: 500,
  },
  savedAt: "2026-09-10T12:00:00Z",
  createdAt: "2026-09-10T12:00:00Z",
};
const page = (name: string, nextCursor: string | null = null) =>
  Response.json({
    items: [{ ...item, summary: { ...item.summary, characterName: name } }],
    nextCursor,
    tools: ["top-gear"],
  });
const tree = () => (
  <NextIntlClientProvider locale="en-US" messages={messages}>
    <LibraryView />
  </NextIntlClientProvider>
);
beforeEach(() => {
  auth.status = "authenticated";
  auth.account = { id: "a", name: "Account A", image: null };
  push.mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("isolates pending account A results from B and clears rows synchronously on sign-out", async () => {
  let resolveA!: (r: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockReturnValueOnce(
        new Promise<Response>((r) => {
          resolveA = r;
        }),
      )
      .mockResolvedValueOnce(page("Character B")),
  );
  const view = render(tree());
  auth.account = { ...auth.account, id: "b" };
  view.rerender(tree());
  expect(await screen.findByText("Character B")).toBeVisible();
  await act(async () => resolveA(page("Character A")));
  expect(screen.queryByText("Character A")).not.toBeInTheDocument();
  auth.status = "anonymous";
  view.rerender(tree());
  expect(screen.queryByText("Character B")).not.toBeInTheDocument();
  expect(screen.getByText("Sign in to see your saved reports.")).toBeVisible();
});
it("keeps same-account rows while paging and never scrolls the window", async () => {
  let release!: (r: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(page("Character A", "next"))
      .mockReturnValueOnce(
        new Promise<Response>((r) => {
          release = r;
        }),
      ),
  );
  const fetch = globalThis.fetch;
  const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  render(tree());
  await screen.findByText("Character A");
  await userEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByText("Character A")).toBeVisible();
  await act(async () => release(page("Character B")));
  expect(screen.getByText("Character B")).toBeVisible();
  expect(scroll).not.toHaveBeenCalled();
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 250));
  });
  expect(fetch).toHaveBeenCalledTimes(2);
});
it("resolves the authorized report path before navigation", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(page("Character A"))
    .mockResolvedValueOnce(
      Response.json({ reportPath: "/reports/authorized" }),
    );
  vi.stubGlobal("fetch", fetch);
  render(tree());
  await userEvent.click(
    await screen.findByRole("button", { name: "Open Character A" }),
  );
  expect(fetch).toHaveBeenLastCalledWith(
    "/api/library/item-a/open",
    expect.objectContaining({ cache: "no-store", credentials: "same-origin" }),
  );
  expect(push).toHaveBeenCalledWith("/reports/authorized");
});
it("debounces bounded search and resets pagination", async () => {
  const fetch = vi
    .fn()
    .mockImplementation(async () => page("Character A", "next"));
  vi.stubGlobal("fetch", fetch);
  render(tree());
  await screen.findByText("Character A");
  await userEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  const input = screen.getByRole("searchbox");
  expect(input).toHaveAttribute("maxlength", "100");
  await userEvent.type(input, "mage");
  expect(fetch).toHaveBeenCalledTimes(2);
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
  expect(fetch.mock.calls[2][0]).toBe("/api/library?search=mage");
});
it("confirms named report deletion, retries failures, and sends same-origin JSON", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(page("Character A"))
    .mockResolvedValueOnce(
      Response.json({ code: "AUTH_UNAVAILABLE" }, { status: 503 }),
    )
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValue(
      Response.json({ items: [], nextCursor: null, tools: ["top-gear"] }),
    );
  vi.stubGlobal("fetch", fetch);
  render(tree());
  const trigger = await screen.findByRole("button", {
    name: "Delete Character A",
  });
  await userEvent.click(trigger);
  expect(screen.getByRole("dialog")).toHaveTextContent("Character A");
  expect(screen.getByRole("dialog")).toHaveTextContent(
    "shared link will stop working",
  );
  await userEvent.click(screen.getByRole("button", { name: "Delete report" }));
  expect(await screen.findByRole("alert")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Delete report" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(fetch).toHaveBeenCalledWith(
    "/api/library/item-a",
    expect.objectContaining({
      method: "DELETE",
      body: "{}",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
    }),
  );
  expect(
    await screen.findByText("Your next discovery belongs here."),
  ).toBeVisible();
  expect(screen.getByRole("heading", { name: "My Library" })).toHaveFocus();
});
it("ignores an open-path response after switching accounts", async () => {
  let release!: (r: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(page("Character A"))
      .mockReturnValueOnce(
        new Promise<Response>((r) => {
          release = r;
        }),
      )
      .mockResolvedValueOnce(page("Character B")),
  );
  const view = render(tree());
  await userEvent.click(
    await screen.findByRole("button", { name: "Open Character A" }),
  );
  auth.account = { ...auth.account, id: "b" };
  view.rerender(tree());
  await screen.findByText("Character B");
  await act(async () =>
    release(Response.json({ reportPath: "/reports/old-account" })),
  );
  expect(push).not.toHaveBeenCalled();
});
it("clears stale rows on cross-tab invalidation before accepting new rows", async () => {
  vi.stubGlobal("BroadcastChannel", undefined);
  let release!: (r: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(page("Character A"))
      .mockReturnValueOnce(
        new Promise<Response>((r) => {
          release = r;
        }),
      ),
  );
  render(tree());
  await screen.findByText("Character A");
  act(() =>
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "munigan.data.invalidated",
        newValue: "other-tab-event",
      }),
    ),
  );
  expect(screen.queryByText("Character A")).not.toBeInTheDocument();
  await act(async () => release(page("Updated Character")));
  expect(screen.getByText("Updated Character")).toBeVisible();
});
it("restores focus after cancelling report deletion without a mutation", async () => {
  const fetch = vi.fn().mockResolvedValue(page("Character A"));
  vi.stubGlobal("fetch", fetch);
  render(tree());
  const trigger = await screen.findByRole("button", {
    name: "Delete Character A",
  });
  await userEvent.click(trigger);
  await userEvent.keyboard("{Escape}");
  expect(trigger).toHaveFocus();
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("keeps a route back when deleting the last item on a later page", async () => {
  vi.stubGlobal("BroadcastChannel", undefined);
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(page("Character A", "next"))
      .mockResolvedValueOnce(page("Character B"))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValue(
        Response.json({ items: [], nextCursor: null, tools: ["top-gear"] }),
      ),
  );
  render(tree());
  await screen.findByText("Character A");
  await userEvent.click(screen.getByRole("button", { name: "Next" }));
  await userEvent.click(
    await screen.findByRole("button", { name: "Delete Character B" }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Delete report" }));
  expect(
    await screen.findByText("No reports left on this page."),
  ).toBeVisible();
  expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
  expect(
    screen.queryByText("Your next discovery belongs here."),
  ).not.toBeInTheDocument();
});

it("offers tool tabs and filters by a character from beyond the current report page", async () => {
  const libraryPage = () =>
    Response.json({
      items: [item],
      nextCursor: "next",
      tools: ["top-gear"],
      total: 25,
      filteredTotal: 25,
      pageSize: 20,
      characters: [
        {
          name: "Munigan",
          classKey: "warrior",
          count: 5,
          specKeys: ["warrior:FuryTalents"],
          lastSavedAt: item.savedAt,
        },
      ],
    });
  const fetch = vi.fn().mockImplementation(async () => libraryPage());
  vi.stubGlobal("fetch", fetch);
  render(tree());
  expect(await screen.findByRole("tab", { name: /Gear Lab/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(screen.getByRole("tab", { name: /Raid Trainer/ })).toBeDisabled();
  await userEvent.click(
    await screen.findByRole("button", { name: /Munigan.*5/ }),
  );
  await waitFor(() =>
    expect(String(fetch.mock.calls.at(-1)?.[0])).toContain(
      "character=Munigan&classKey=warrior",
    ),
  );
  expect(String(fetch.mock.calls.at(-1)?.[0])).not.toContain("cursor=");
  await userEvent.click(screen.getByRole("combobox", { name: "Sort reports" }));
  await userEvent.click(
    await screen.findByRole("option", { name: "Oldest first" }),
  );
  await waitFor(() =>
    expect(String(fetch.mock.calls.at(-1)?.[0])).toContain("sort=oldest"),
  );
  await userEvent.click(
    screen.getByRole("combobox", { name: "Specialization" }),
  );
  await userEvent.click(await screen.findByRole("option", { name: /Fury/ }));
  await waitFor(() =>
    expect(String(fetch.mock.calls.at(-1)?.[0])).toContain(
      "spec=warrior%3AFuryTalents",
    ),
  );
});

it("shows the saved run context and computes the gain against that run's equipped set", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json({
        items: [
          {
            ...item,
            context: {
              itemVersion: "original",
              combinations: 40,
              duration: 180,
              targetCount: 1,
            },
          },
        ],
        nextCursor: null,
        tools: ["top-gear"],
        total: 1,
        filteredTotal: 1,
        pageSize: 20,
        characters: [],
      }),
    ),
  );
  render(tree());
  const report = await screen.findByRole("button", {
    name: "Open Character A",
  });
  expect(report).toHaveTextContent("40 combinations");
  expect(report).toHaveTextContent("Original WotLK · Single target · 180s");
  expect(report).toHaveTextContent("DPS · +4.35%");
});

it("keeps a readable character filter when its last report is removed in another tab", async () => {
  const response = () =>
    Response.json({
      items: [item],
      nextCursor: null,
      tools: ["top-gear"],
      total: 1,
      filteredTotal: 1,
      pageSize: 20,
      characters: [
        {
          name: "Character A",
          classKey: "mage",
          count: 1,
          specKeys: [item.summary.specKey],
          lastSavedAt: item.savedAt,
        },
      ],
    });
  const fetch = vi.fn().mockImplementation(async () => response());
  vi.stubGlobal("fetch", fetch);
  render(tree());
  await userEvent.click(
    await screen.findByRole("button", { name: /Character A.*Mage.*1/ }),
  );
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  fetch.mockImplementation(async () =>
    Response.json({
      items: [],
      nextCursor: null,
      tools: ["top-gear"],
      total: 0,
      filteredTotal: 0,
      pageSize: 20,
      characters: [],
    }),
  );
  act(() =>
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "munigan.data.invalidated",
        newValue: "deleted",
      }),
    ),
  );
  await screen.findByText("No matching reports.");
  expect(
    screen.getByRole("combobox", { name: "Characters" }),
  ).toHaveTextContent("Character A");
  expect(
    screen.getByRole("combobox", { name: "Characters" }),
  ).not.toHaveTextContent('["');
});
