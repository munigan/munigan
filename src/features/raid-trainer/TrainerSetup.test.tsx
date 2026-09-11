import { createRef } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TrainerSetup } from "./TrainerSetup";
import { prepareScenarioAssets } from "./arena-assets";
import { validateRun } from "./scenario-content";
vi.mock("./arena-assets", () => ({
  prepareScenarioAssets: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./scenario-content", async (original) => ({
  ...(await original<typeof import("./scenario-content")>()),
  validateRun: vi.fn().mockReturnValue([]),
}));
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("reports invalid profiles before preparing or entering focus", async () => {
  vi.mocked(validateRun).mockReturnValueOnce(["runSpeed must be positive"]);
  const start = vi.fn();
  render(<TrainerSetup active startButtonRef={createRef()} onStart={start} />);
  fireEvent.click(screen.getByRole("button", { name: /Start game/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Invalid practice profile: runSpeed must be positive",
  );
  expect(start).not.toHaveBeenCalled();
  expect(prepareScenarioAssets).not.toHaveBeenCalled();
});
it("ignores canceled preparation, then starts once with Mixed metadata and timers default", async () => {
  let resolve!: () => void;
  vi.mocked(prepareScenarioAssets).mockImplementationOnce(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      }),
  );
  const start = vi.fn(),
    ref = createRef<HTMLButtonElement>();
  render(<TrainerSetup active startButtonRef={ref} onStart={start} />);
  fireEvent.click(screen.getByRole("button", { name: /Start game/ }));
  fireEvent.click(
    screen.getByRole("button", {
      name: /Back to mechanic selection/,
      hidden: true,
    }),
  );
  resolve();
  await waitFor(() => expect(ref.current).toHaveFocus());
  expect(start).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /Start game/ }));
  await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
  expect(start.mock.calls[0][0].mode).toBe("timers");
  expect(start.mock.calls[0][1]).toBe("mixed");
});
