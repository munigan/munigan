import { act, render, renderHook, screen } from "@testing-library/react";
import { Profiler, type PropsWithChildren } from "react";
import { renderToString } from "react-dom/server";
import { expect, it, vi } from "vitest";
import {
  purchaseFixture,
  purchasePolicy,
} from "../../../../tests/support/purchase-fixtures";
import {
  GearLabProvider,
  useGearLabSelector,
  useGearLabStore,
} from "./GearLabProvider";
import { createGearLabStore } from "./gear-lab-store";

function DraftId() {
  return (
    <span>
      {useGearLabSelector((state) => state.draft?.snapshot.id ?? "empty")}
    </span>
  );
}

it("isolates two provider instances", () => {
  const first = createGearLabStore(purchaseFixture());
  first.getState().actions.replaceDraft({
    ...purchaseFixture(),
    snapshot: { ...purchaseFixture().snapshot, id: "first" },
  });
  const second = createGearLabStore(purchaseFixture());
  second.getState().actions.replaceDraft({
    ...purchaseFixture(),
    snapshot: { ...purchaseFixture().snapshot, id: "second" },
  });

  render(
    <>
      <GearLabProvider store={first}>
        <DraftId />
      </GearLabProvider>
      <GearLabProvider store={second}>
        <DraftId />
      </GearLabProvider>
    </>,
  );

  expect(screen.getByText("first")).toBeInTheDocument();
  expect(screen.getByText("second")).toBeInTheDocument();
});

it("renders an empty provider consistently on the server", () => {
  expect(
    renderToString(
      <GearLabProvider>
        <DraftId />
      </GearLabProvider>,
    ),
  ).toBe("<span>empty</span>");
});

it("creates fresh state after unmount and remount", () => {
  const seen: ReturnType<typeof useGearLabStore>[] = [];
  function Capture() {
    seen.push(useGearLabStore());
    return null;
  }
  const mounted = render(
    <GearLabProvider>
      <Capture />
    </GearLabProvider>,
  );
  act(() => seen[0].getState().actions.replaceDraft(purchaseFixture()));
  mounted.unmount();
  render(
    <GearLabProvider>
      <Capture />
    </GearLabProvider>,
  );

  expect(seen.at(-1)).not.toBe(seen[0]);
  expect(seen.at(-1)?.getState().draft).toBeNull();
});

it("does not commit a snapshot selector on precision-only updates", () => {
  const store = createGearLabStore(purchaseFixture());
  const onRender = vi.fn();
  const wrapper = ({ children }: PropsWithChildren) => (
    <GearLabProvider store={store}>
      <Profiler id="snapshot" onRender={onRender}>
        {children}
      </Profiler>
    </GearLabProvider>
  );
  renderHook(() => useGearLabSelector((state) => state.draft?.snapshot), {
    wrapper,
  });
  expect(onRender).toHaveBeenCalledTimes(1);

  act(() =>
    store.getState().actions.setIterations(4000, {
      ...purchasePolicy,
      selectableIterations: { min: 500, max: 6000, step: 500 },
    }),
  );

  expect(onRender).toHaveBeenCalledTimes(1);
});

it("reports a clear error when hooks are used without the provider", () => {
  expect(() => renderHook(() => useGearLabStore())).toThrow(
    "Gear Lab store hooks must be used within GearLabProvider",
  );
});
