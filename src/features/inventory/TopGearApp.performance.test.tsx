import userEvent from "@testing-library/user-event";
vi.mock("@/features/pro-launch/ProLaunchProvider", () => ({
  useProLaunch: () => ({ open: vi.fn() }),
  proBeforeSignInEvent: "munigan.pro.before-sign-in",
}));
import { afterEach, expect, it, vi } from "vitest";
import { Profiler } from "react";
import * as validation from "@/domain/equipment/validate";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import {
  purchaseFixture,
  purchasePolicy,
} from "../../../tests/support/purchase-fixtures";
import { fixtureRequest } from "../../../tests/support/fixtures";
import { analyzePurchaseSelection } from "@/domain/purchases/analysis";
import { decodeDraft, encodeSnapshot } from "@/domain/top-gear/request-schema";
import type {
  PurchaseWorkerRequest,
  PurchaseWorkerReply,
} from "./purchases/purchase-worker-contract";
import { topGearStartEvent } from "@/features/shell/top-gear-navigation";
import { saveDraft } from "../import/draft-store";
import auth from "../../../messages/en-US/auth.json";
import importMessages from "../../../messages/en-US/import.json";
import inventory from "../../../messages/en-US/inventory.json";
import common from "../../../messages/en-US/common.json";
import diagnostics from "../../../messages/en-US/diagnostics.json";
import { TopGearApp } from "./TopGearApp";
const metrics = vi.hoisted(() => ({
  commits: [] as { id: string; ms: number }[],
  posts: 0,
}));
vi.mock("./purchases/ResourceWallet", async (original) => {
  const real = await original<typeof import("./purchases/ResourceWallet")>();
  const { Profiler, memo } = await import("react");
  return {
    ...real,
    ResourceWallet: memo((props: Parameters<typeof real.ResourceWallet>[0]) => (
      <Profiler
        id="wallet"
        onRender={(id, phase, ms) => {
          if (phase !== "mount") metrics.commits.push({ id, ms });
        }}
      >
        <real.ResourceWallet {...props} />
      </Profiler>
    )),
  };
});
vi.mock("./purchases/PurchasableItemsDialog", async (original) => {
  const real =
    await original<typeof import("./purchases/PurchasableItemsDialog")>();
  const { Profiler } = await import("react");
  return {
    ...real,
    PurchasableItemsDialog: (
      props: Parameters<typeof real.PurchasableItemsDialog>[0],
    ) => (
      <Profiler
        id="purchase-dialog"
        onRender={(id, phase, ms) => {
          if (phase !== "mount") metrics.commits.push({ id, ms });
        }}
      >
        <real.PurchasableItemsDialog {...props} />
      </Profiler>
    ),
  };
});
vi.mock("./InventorySelector", async (original) => {
  const real = await original<typeof import("./InventorySelector")>();
  const { Profiler, memo } = await import("react");
  return {
    ...real,
    InventorySelector: memo(
      (props: Parameters<typeof real.InventorySelector>[0]) => (
        <Profiler
          id="inventory"
          onRender={(id, phase, ms) => {
            if (phase !== "mount") metrics.commits.push({ id, ms });
          }}
        >
          <real.InventorySelector {...props} />
        </Profiler>
      ),
    ),
  };
});
vi.mock("./InventoryItemRow", async (original) => {
  const real = await original<typeof import("./InventoryItemRow")>();
  const { Profiler, memo } = await import("react");
  return {
    ...real,
    ConnectedInventoryItemRow: memo(
      (props: Parameters<typeof real.ConnectedInventoryItemRow>[0]) => (
        <Profiler
          id={`row-${props.id}`}
          onRender={(id, phase, ms) => {
            if (phase !== "mount") metrics.commits.push({ id, ms });
          }}
        >
          <real.ConnectedInventoryItemRow {...props} />
        </Profiler>
      ),
    ),
  };
});
vi.mock("../auth/AuthProvider", () => ({
  useAccount: () => ({ status: "anonymous", savingEnabled: false }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../auth/SignInDialog", () => ({ SignInDialog: () => null }));
class WorkerDouble {
  static hold = false;
  static replies: (() => void)[] = [];
  static instances: WorkerDouble[] = [];
  constructor() {
    WorkerDouble.instances.push(this);
  }
  static flush() {
    for (const reply of this.replies.splice(0)) reply();
  }
  fail() {
    for (const cb of this.listeners.get("error") ?? [])
      cb(new Event("error") as unknown as MessageEvent<PurchaseWorkerReply>);
  }

  listeners = new Map<
    string,
    Set<(event: MessageEvent<PurchaseWorkerReply>) => void>
  >();
  addEventListener(
    type: string,
    cb: (event: MessageEvent<PurchaseWorkerReply>) => void,
  ) {
    const set = this.listeners.get(type) ?? new Set();
    set.add(cb);
    this.listeners.set(type, set);
  }
  removeEventListener(
    type: string,
    cb: (event: MessageEvent<PurchaseWorkerReply>) => void,
  ) {
    this.listeners.get(type)?.delete(cb);
  }
  terminate() {
    this.listeners.clear();
  }
  postMessage(message: PurchaseWorkerRequest) {
    metrics.posts++;
    const reply = () => {
      let preview: Extract<
        PurchaseWorkerReply,
        { status: "ready" }
      >["preview"] = null;
      const analysis = analyzePurchaseSelection(
        decodeDraft(message.request),
        message.policy,
        (p) => {
          preview = {
            snapshot: encodeSnapshot(p.snapshot),
            selection: p.selection,
            candidates: p.candidates,
          };
        },
      );
      for (const cb of this.listeners.get("message") ?? [])
        cb({
          data: {
            revision: message.revision,
            status: "ready",
            analysis,
            preview,
          },
        } as MessageEvent<PurchaseWorkerReply>);
    };
    if (WorkerDouble.hold) WorkerDouble.replies.push(reply);
    else queueMicrotask(reply);
  }
}
afterEach(() => {
  WorkerDouble.hold = false;
  WorkerDouble.replies = [];
  WorkerDouble.instances = [];
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function setup(purchases = true) {
  localStorage.clear();
  sessionStorage.clear();
  const request = purchases
    ? purchaseFixture({ frost: 100, "regalia:vanquisher": 1 })
    : fixtureRequest();
  request.iterations = 3000;
  for (let i = 0; i < 80; i++)
    request.snapshot.inventory.push({
      ...request.snapshot.inventory[0],
      instanceId: `bag-${i}`,
      source: "bag",
      equippedSlot: undefined,
    });
  saveDraft(request);
  vi.stubGlobal("Worker", WorkerDouble);
  const fetcher = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      policy: {
        ...purchasePolicy,
        maxUnits: null,
        selectableIterations: { min: 500, max: 6000, step: 500 },
      },
    }),
  }));
  vi.stubGlobal("fetch", fetcher);
  const writes = vi.spyOn(Storage.prototype, "setItem");
  render(
    <NextIntlClientProvider
      locale="en-US"
      messages={{
        auth,
        import: importMessages,
        inventory,
        common,
        diagnostics,
      }}
    >
      <Profiler
        id="page"
        onRender={(id, phase, ms) => {
          if (phase !== "mount") metrics.commits.push({ id, ms });
        }}
      >
        <TopGearApp autoRestore />
      </Profiler>
    </NextIntlClientProvider>,
  );
  await screen.findByRole("combobox", { name: "Iterations per set" });
  if (purchases) await screen.findByText(/compatible purchases included/);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /Run Gear Lab/ })).toBeEnabled(),
  );
  return { fetcher, writes };
}
it.each([true, false])(
  "isolates iterations and checkbox controls (purchases=%s)",
  async (purchases) => {
    const { fetcher, writes } = await setup(purchases);

    const validate = vi.spyOn(validation, "validateItem");
    metrics.commits = [];
    metrics.posts = 0;
    fetcher.mockClear();
    validate.mockClear();
    writes.mockClear();
    await userEvent.click(
      screen.getByRole("combobox", { name: "Iterations per set" }),
    );
    await userEvent.click((await screen.findAllByRole("option"))[6]);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    expect(
      metrics.commits.filter((c) => c.id === "wallet" || c.id === "inventory"),
    ).toEqual([]);
    expect(metrics.posts).toBe(0);
    expect(validate).not.toHaveBeenCalled();
    expect(
      writes.mock.calls.filter(
        ([key]) => key === "wow-droptimizer.top-gear.v1",
      ),
    ).toHaveLength(1);
    const checkbox = purchases
      ? screen.getByRole("checkbox", {
          name: /Select Scourgelord Helmet, Purchase/,
        })
      : document.querySelector<HTMLInputElement>(
          '[data-instance-id="bag-0"] input',
        )!;
    const unrelated = document.querySelector('[data-instance-id="bag-79"]');
    metrics.commits = [];
    expect(unrelated).not.toBeNull();
    WorkerDouble.hold = true;
    checkbox.focus();
    fireEvent.click(checkbox);
    expect(document.activeElement).toBe(checkbox);
    expect(checkbox.isConnected).toBe(true);
    if (purchases) {
      expect(
        screen.getByRole("button", { name: /Run Gear Lab/ }),
      ).toBeDisabled();
      expect(
        within(document.querySelector(".inventory") as HTMLElement).queryByText(
          inventory.purchases.calculating,
        ),
      ).not.toBeInTheDocument();
    }
    expect(document.querySelector('[data-instance-id="bag-79"]')).toBe(
      unrelated,
    );
    expect(fetcher).not.toHaveBeenCalled();
    await act(async () => WorkerDouble.flush());
    expect(metrics.commits.filter((c) => c.id === "row-bag-79")).toEqual([]);
    expect(document.activeElement).toBe(checkbox);
    expect(document.querySelector('[data-instance-id="bag-79"]')).toBe(
      unrelated,
    );
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    act(() => window.dispatchEvent(new Event(topGearStartEvent)));
    expect(document.querySelector(".inventory")).toBeNull();
    expect(
      screen.getByRole("button", { name: /Restore draft/ }),
    ).toBeInTheDocument();
  },
  30000,
);

it("keeps visible rewards on worker error and retries through the shared secondary button", async () => {
  await setup();
  const row = screen
    .getByRole("checkbox", { name: /Select Scourgelord Helmet, Purchase/ })
    .closest(".inventory-row");
  expect(row).not.toBeNull();
  act(() => WorkerDouble.instances.at(-1)!.fail());
  const retry = screen.getByRole("button", { name: "Retry" });
  expect(screen.getByRole("button", { name: /Run Gear Lab/ })).toBeDisabled();
  expect(
    screen
      .getByRole("checkbox", { name: /Select Scourgelord Helmet, Purchase/ })
      .closest(".inventory-row"),
  ).toBe(row);
  fireEvent.click(retry);
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Retry" }),
    ).not.toBeInTheDocument(),
  );
  expect(screen.getByRole("button", { name: /Run Gear Lab/ })).toBeEnabled();
});

it("keeps the purchase dialog isolated from precision changes", async () => {
  await setup();
  const select = screen.getByRole("combobox", { name: "Iterations per set" });
  fireEvent.click(screen.getByRole("button", { name: "Review purchases" }));
  await screen.findByRole("dialog");
  // Let the dialog opening/focus effects settle before measuring precision work.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
  });
  metrics.commits = [];
  await userEvent.click(select);
  await userEvent.click((await screen.findAllByRole("option"))[6]);
  expect(metrics.commits.filter((c) => c.id === "purchase-dialog")).toEqual([]);
});

it("updates tier counts from current exclusions while analysis is held or fails", async () => {
  await setup();
  fireEvent.click(screen.getByRole("button", { name: "Review purchases" }));
  await screen.findByRole("dialog");
  const row = document.querySelector<HTMLElement>(
    '[data-purchase-id="50096"]',
  )!;
  const group = row.closest("details")!;
  expect(group.querySelector("summary")).toHaveTextContent(
    "5 available · Included",
  );
  WorkerDouble.hold = true;
  const checkbox = within(row).getByRole("checkbox", { hidden: true });
  fireEvent.click(checkbox);
  expect(checkbox).not.toBeChecked();
  expect(group.querySelector("summary")).toHaveTextContent(
    "4 available · Included",
  );
  act(() => WorkerDouble.instances.at(-1)!.fail());
  expect(group.querySelector("summary")).toHaveTextContent(
    "4 available · Included",
  );
});
