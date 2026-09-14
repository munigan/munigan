import { afterEach, expect, it, vi } from "vitest";
import * as schema from "@/domain/top-gear/request-schema";
import type { TopGearRequest } from "@/domain/top-gear/model";
import {
  purchaseFixture,
  purchasePolicy,
} from "../../../../tests/support/purchase-fixtures";
import { createGearLabStore } from "./gear-lab-store";
import { createDraftPersistence } from "./gear-lab-persistence";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function setup(
  initial: TopGearRequest | null = purchaseFixture({ frost: 100 }),
) {
  const store = createGearLabStore(initial);
  const save = vi.fn<(draft: TopGearRequest) => void>();
  const clear = vi.fn<() => void>();
  const clearMatching =
    vi.fn<(submitted: ReturnType<typeof schema.encodeRequest>) => boolean>();
  const onError = vi.fn<(error: unknown) => void>();
  const persistence = createDraftPersistence(store, {
    save,
    clear,
    clearMatching,
    onError,
  });
  return { store, save, clear, clearMatching, onError, persistence };
}

it("writes only the latest edit after 250 ms without serializing each edit", () => {
  vi.useFakeTimers();
  const encode = vi.spyOn(schema, "encodeRequest");
  const { store, save, persistence } = setup();
  save.mockImplementation((draft) => {
    schema.encodeRequest(draft);
  });

  store.getState().actions.setResourceQuantity("frost", 120);
  store.getState().actions.setResourceQuantity("frost", 140);

  vi.advanceTimersByTime(249);
  expect(save).not.toHaveBeenCalled();
  expect(encode).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(save).toHaveBeenCalledTimes(1);
  expect(save).toHaveBeenCalledWith(store.getState().draft);
  expect(encode).toHaveBeenCalledTimes(1);

  persistence.dispose({ flush: false });
});

it("flush writes the current unsaved draft once and cancels its timer", () => {
  vi.useFakeTimers();
  const { store, save, persistence } = setup();
  store.getState().actions.setResourceQuantity("frost", 120);
  store.getState().actions.setResourceQuantity("frost", 140);
  const latest = store.getState().draft;

  persistence.flush();

  expect(save).toHaveBeenCalledTimes(1);
  expect(save).toHaveBeenCalledWith(latest);
  vi.advanceTimersByTime(250);
  persistence.flush();
  expect(save).toHaveBeenCalledTimes(1);
  persistence.dispose({ flush: false });
});

it("throws a synchronous flush failure and retries the unsaved draft", () => {
  vi.useFakeTimers();
  const failure = new Error("storage full");
  const { store, save, onError, persistence } = setup();
  save.mockImplementationOnce(() => {
    throw failure;
  });
  store.getState().actions.setResourceQuantity("frost", 120);

  expect(() => persistence.flush()).toThrow(failure);
  expect(onError).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);

  persistence.flush();
  expect(save).toHaveBeenCalledTimes(2);
  expect(save).toHaveBeenLastCalledWith(store.getState().draft);
  persistence.dispose({ flush: false });
});

it("reports a background write failure and retains the editable draft", () => {
  vi.useFakeTimers();
  const failure = new Error("storage full");
  const { store, save, onError, persistence } = setup();
  save.mockImplementationOnce(() => {
    throw failure;
  });
  store.getState().actions.setResourceQuantity("frost", 120);
  const failedDraft = store.getState().draft;

  vi.advanceTimersByTime(250);

  expect(onError).toHaveBeenCalledTimes(1);
  expect(onError).toHaveBeenCalledWith(failure);
  expect(store.getState().draft).toBe(failedDraft);

  store.getState().actions.setResourceQuantity("frost", 140);
  vi.advanceTimersByTime(250);
  expect(save).toHaveBeenCalledTimes(2);
  expect(save).toHaveBeenLastCalledWith(store.getState().draft);
  persistence.dispose({ flush: false });
});

it("cancel drops pending work but permits a later edit", () => {
  vi.useFakeTimers();
  const { store, save, persistence } = setup();
  store.getState().actions.setResourceQuantity("frost", 120);

  persistence.cancel();
  vi.advanceTimersByTime(250);
  expect(save).not.toHaveBeenCalled();

  store.getState().actions.setResourceQuantity("frost", 140);
  vi.advanceTimersByTime(250);
  expect(save).toHaveBeenCalledTimes(1);
  expect(save).toHaveBeenCalledWith(store.getState().draft);
  persistence.dispose({ flush: false });
});

it("discard cancels pending work, clears storage, then clears live state", () => {
  vi.useFakeTimers();
  const { store, save, clear, persistence } = setup();
  store.getState().actions.setResourceQuantity("frost", 120);

  persistence.discard();

  expect(clear).toHaveBeenCalledTimes(1);
  expect(store.getState().draft).toBeNull();
  vi.advanceTimersByTime(250);
  expect(save).not.toHaveBeenCalled();
  persistence.dispose();
});

it("discard preserves live state when clearing storage fails", () => {
  vi.useFakeTimers();
  const failure = new Error("storage unavailable");
  const { store, save, clear, persistence } = setup();
  const draft = store.getState().draft;
  clear.mockImplementation(() => {
    throw failure;
  });
  store.getState().actions.setResourceQuantity("frost", 120);
  const edited = store.getState().draft;

  expect(() => persistence.discard()).toThrow(failure);
  expect(store.getState().draft).toBe(edited);
  expect(store.getState().draft).not.toBe(draft);
  vi.advanceTimersByTime(250);
  expect(save).not.toHaveBeenCalled();

  store.getState().actions.setResourceQuantity("frost", 140);
  vi.advanceTimersByTime(250);
  expect(save).toHaveBeenCalledTimes(1);
  persistence.dispose({ flush: false });
});

it("restarts the debounce window when a draft epoch is replaced", () => {
  vi.useFakeTimers();
  const { store, save, persistence } = setup();
  store.getState().actions.setResourceQuantity("frost", 120);
  vi.advanceTimersByTime(200);
  store
    .getState()
    .actions.replaceDraft(purchaseFixture({ frost: 300, triumph: 20 }));
  const replacement = store.getState().draft;

  vi.advanceTimersByTime(49);
  expect(save).not.toHaveBeenCalled();
  vi.advanceTimersByTime(201);
  expect(save).toHaveBeenCalledTimes(1);
  expect(save).toHaveBeenCalledWith(replacement);
  persistence.dispose({ flush: false });
});

it("cancels a pending write when replacement clears the draft", () => {
  vi.useFakeTimers();
  const { store, save, clear, persistence } = setup();
  store.getState().actions.setResourceQuantity("frost", 120);

  store.getState().actions.replaceDraft(null);
  vi.advanceTimersByTime(250);

  expect(save).not.toHaveBeenCalled();
  expect(clear).not.toHaveBeenCalled();
  persistence.flush();
  expect(save).not.toHaveBeenCalled();
  persistence.dispose({ flush: false });
});

it("saves a newer live draft before matching completed-attempt cleanup", () => {
  vi.useFakeTimers();
  const events: string[] = [];
  const { store, save, clearMatching, persistence } = setup();
  persistence.flush();
  const submitted = schema.encodeRequest(store.getState().draft!);
  save.mockClear();
  save.mockImplementation(() => events.push("save"));
  clearMatching.mockImplementation(() => {
    events.push("clearMatching");
    return false;
  });
  store.getState().actions.setResourceQuantity("frost", 140);
  const newer = store.getState().draft;

  persistence.complete(submitted);

  expect(events).toEqual(["save", "clearMatching"]);
  expect(save).toHaveBeenCalledTimes(1);
  expect(save).toHaveBeenCalledWith(newer);
  expect(clearMatching).toHaveBeenCalledWith(submitted);
  vi.advanceTimersByTime(250);
  expect(save).toHaveBeenCalledTimes(1);
  persistence.dispose();
  expect(save).toHaveBeenCalledTimes(1);
});

it("does not resurrect a matching completed draft during disposal", () => {
  const { store, save, clearMatching, persistence } = setup();
  persistence.flush();
  const submitted = schema.encodeRequest(store.getState().draft!);
  clearMatching.mockReturnValue(true);

  persistence.complete(submitted);
  persistence.dispose();

  expect(save).toHaveBeenCalledTimes(1);
  expect(clearMatching).toHaveBeenCalledTimes(1);
  expect(clearMatching).toHaveBeenCalledWith(submitted);
});

it("surfaces completion cleanup failure after saving the newer draft", () => {
  vi.useFakeTimers();
  const failure = new Error("cleanup unavailable");
  const { store, save, clearMatching, onError, persistence } = setup();
  persistence.flush();
  const submitted = schema.encodeRequest(store.getState().draft!);
  save.mockClear();
  store.getState().actions.setResourceQuantity("frost", 140);
  const newer = store.getState().draft;
  clearMatching.mockImplementation(() => {
    throw failure;
  });

  expect(() => persistence.complete(submitted)).toThrow(failure);
  expect(save).toHaveBeenCalledTimes(1);
  expect(save).toHaveBeenCalledWith(newer);
  expect(onError).not.toHaveBeenCalled();
  vi.advanceTimersByTime(250);
  expect(save).toHaveBeenCalledTimes(1);
  persistence.dispose();
  expect(save).toHaveBeenCalledTimes(1);
});

it("disposes subscriptions and timers exactly once after a final flush fails", () => {
  vi.useFakeTimers();
  const failure = new Error("storage full");
  const { store, save, persistence } = setup();
  save.mockImplementation(() => {
    throw failure;
  });
  store.getState().actions.setIterations(1000, {
    ...purchasePolicy,
    selectableIterations: { min: 500, max: 6000, step: 500 },
  });

  expect(() => persistence.dispose()).toThrow(failure);
  expect(vi.getTimerCount()).toBe(0);

  store.getState().actions.setResourceQuantity("frost", 140);
  vi.advanceTimersByTime(250);
  expect(save).toHaveBeenCalledTimes(1);
  expect(() => persistence.dispose()).not.toThrow();
  expect(save).toHaveBeenCalledTimes(1);
});
