import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { expect, it, vi } from "vitest";
import common from "../../../messages/en-US/common.json";
import { Pagination } from "./Pagination";

it("blocks navigation at boundaries and while pending without moving the page", async () => {
  const previous = vi.fn(),
    next = vi.fn(),
    scroll = vi.spyOn(window, "scrollTo");
  const view = (pending: boolean) => (
    <NextIntlClientProvider locale="en-US" messages={{ common }}>
      <Pagination
        page={1}
        hasPrevious={false}
        hasNext
        onPrevious={previous}
        onNext={next}
        pending={pending}
        range={{ start: 1, end: 20, total: 23 }}
      />
    </NextIntlClientProvider>
  );
  const rendered = render(view(false));
  expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(next).toHaveBeenCalledTimes(1);
  expect(scroll).not.toHaveBeenCalled();
  rendered.rerender(view(true));
  await userEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(next).toHaveBeenCalledTimes(1);
  expect(screen.getByText("1–20 of 23")).toBeVisible();
  scroll.mockRestore();
});
it("supports incremental item loading without changing to page navigation", async () => {
  const more = vi.fn();
  render(
    <NextIntlClientProvider locale="en-US" messages={{ common }}>
      <Pagination
        variant="load-more"
        hasNext
        onLoadMore={more}
        range={{ start: 1, end: 80, total: 100 }}
      />
    </NextIntlClientProvider>,
  );
  await userEvent.click(screen.getByRole("button", { name: "Show more" }));
  expect(more).toHaveBeenCalledTimes(1);
  expect(
    screen.queryByRole("button", { name: "Previous" }),
  ).not.toBeInTheDocument();
});
