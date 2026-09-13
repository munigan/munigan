import { act, renderHook, waitFor } from "@testing-library/react";
import { StrictMode, type PropsWithChildren } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fixtureRequest } from "../../../../tests/support/fixtures";
import { purchasePolicy } from "../../../../tests/support/purchase-fixtures";
import { createGearLabStore } from "./gear-lab-store";
import { GearLabProvider } from "./GearLabProvider";
import { GearLabRuntimeProvider } from "./GearLabRuntime";
import { useGearLabSession } from "./useGearLabSession";
import { draftKey, saveDraft } from "@/features/import/draft-store";
import { importFormDraftKey } from "@/features/import/import-form-draft";
import { topGearStartEvent } from "@/features/shell/top-gear-navigation";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ json: async () => ({ policy: purchasePolicy }) })),
  );
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function setup(strict = false, autoRestore = false) {
  const store = createGearLabStore();
  const wrapper = ({ children }: PropsWithChildren) => (
    <GearLabProvider store={store}>
      <GearLabRuntimeProvider>
        {strict ? <StrictMode>{children}</StrictMode> : children}
      </GearLabRuntimeProvider>
    </GearLabProvider>
  );
  const onStart = vi.fn();
  const hook = renderHook(() => useGearLabSession({ autoRestore, onStart }), {
    wrapper,
    reactStrictMode: strict,
  });
  return { store, onStart, ...hook };
}
it("registers one active lifecycle listener per event through Strict Mode and removes all on unmount", async () => {
  const addWindow = vi.spyOn(window, "addEventListener"),
    removeWindow = vi.spyOn(window, "removeEventListener");
  const addDocument = vi.spyOn(document, "addEventListener"),
    removeDocument = vi.spyOn(document, "removeEventListener");
  const test = setup(true);
  await waitFor(() => expect(test.result.current.policy).not.toBeNull());
  for (const [event, add, remove] of [
    [topGearStartEvent, addWindow, removeWindow],
    ["pagehide", addWindow, removeWindow],
    ["visibilitychange", addDocument, removeDocument],
  ] as const) {
    expect(
      add.mock.calls.filter(([name]) => name === event).length -
        remove.mock.calls.filter(([name]) => name === event).length,
    ).toBe(1);
  }
  act(() => test.result.current.resolved(fixtureRequest().snapshot));
  act(() => {
    window.dispatchEvent(new Event(topGearStartEvent));
  });
  expect(test.onStart).toHaveBeenCalledTimes(1);
  expect(test.store.getState().draft).toBeNull();
  expect(localStorage.getItem(draftKey)).not.toBeNull();
  test.unmount();
  for (const [event, add, remove] of [
    [topGearStartEvent, addWindow, removeWindow],
    ["pagehide", addWindow, removeWindow],
    ["visibilitychange", addDocument, removeDocument],
  ] as const) {
    expect(add.mock.calls.filter(([name]) => name === event).length).toBe(
      remove.mock.calls.filter(([name]) => name === event).length,
    );
  }
});
it("prefers a saved import form to the editable gear draft when restoring manually", async () => {
  saveDraft(fixtureRequest());
  localStorage.setItem(importFormDraftKey, "import in progress");
  const test = setup();
  await waitFor(() => expect(test.result.current.hasDraft).toBe(true));
  const restoreDraft = vi.fn(() => true);
  test.result.current.importPanel.current = {
    restoreDraft,
    saveForLater: () => {},
  };
  act(() => test.result.current.restoreSavedDraft());
  expect(restoreDraft).toHaveBeenCalledTimes(1);
  expect(test.store.getState().draft).toBeNull();
  expect(localStorage.getItem(draftKey)).not.toBeNull();
  test.unmount();
});
it("flushes before sign-in and cancels a discarded draft so unmount cannot restore it", async () => {
  const test = setup();
  await waitFor(() => expect(test.result.current.policy).not.toBeNull());
  act(() => test.result.current.resolved(fixtureRequest().snapshot));
  act(() => test.result.current.signInForRun());
  expect(localStorage.getItem(draftKey)).not.toBeNull();
  expect(sessionStorage.getItem("munigan.top-gear.signin-restore")).toBe("1");
  expect(test.result.current.signInOpen).toBe(true);
  act(() => test.result.current.discardSavedDraft());
  test.unmount();
  expect(localStorage.getItem(draftKey)).toBeNull();
});
it("prevents start and sign-in navigation when the pending draft cannot be saved", async () => {
  const test = setup();
  await waitFor(() => expect(test.result.current.policy).not.toBeNull());
  act(() => test.result.current.resolved(fixtureRequest().snapshot));
  const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("Storage unavailable");
  });
  const event = new Event(topGearStartEvent, { cancelable: true });
  act(() => {
    window.dispatchEvent(event);
    test.result.current.signInForRun();
  });
  expect(event.defaultPrevented).toBe(true);
  expect(test.store.getState().draft).not.toBeNull();
  expect(test.result.current.signInOpen).toBe(false);
  expect(test.result.current.storageError?.message).toBe("Storage unavailable");
  set.mockRestore();
  test.unmount();
});
it("preserves a completed restored draft across subsequent lifecycle flush and unmount", async () => {
  saveDraft(fixtureRequest());
  const test = setup(true, true);
  await waitFor(() => expect(test.store.getState().draft).not.toBeNull());
  const { encodeRequest } = await import("@/domain/top-gear/request-schema");
  act(() => {
    test.result.current.persistence.flush();
    test.result.current.persistence.complete(
      encodeRequest(test.store.getState().draft!),
    );
    window.dispatchEvent(new Event("pagehide"));
  });
  test.unmount();
  expect(localStorage.getItem(draftKey)).toBeNull();
});

it("finishes cleanup for an already pending admission after its component unmounts", async () => {
  const test = setup();
  await waitFor(() => expect(test.result.current.policy).not.toBeNull());
  act(() => test.result.current.resolved(fixtureRequest().snapshot));
  const { encodeRequest } = await import("@/domain/top-gear/request-schema");
  const submitted = encodeRequest(test.store.getState().draft!);
  const persistence = test.result.current.persistence;
  test.unmount();
  expect(localStorage.getItem(draftKey)).not.toBeNull();
  persistence.complete(submitted);
  expect(localStorage.getItem(draftKey)).toBeNull();
});
