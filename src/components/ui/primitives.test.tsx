import { createRef } from "react";
import Link from "next/link";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { Button } from "./Button";
import {
  DialogRoot,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogClose,
} from "./Dialog";
import { TabsRoot, TabsList, TabsTab, TabsPanel } from "./Tabs";

it("composes a navigation button without nesting interactive elements and forwards its ref", () => {
  const ref = createRef<HTMLElement>();
  render(
    <Button
      ref={ref}
      nativeButton={false}
      role="link"
      render={<Link href="/top-gear" />}
      className="hidden sm:inline-flex"
    >
      Compare gear
    </Button>,
  );
  const link = screen.getByRole("link", { name: "Compare gear" });
  expect(link).toHaveAttribute("href", "/top-gear");
  expect(link.querySelector("button")).toBeNull();
  expect(ref.current).toBe(link);
  expect(link).toHaveClass("hidden");
  expect(link).not.toHaveClass("inline-flex");
});

it("opens a named modal and restores keyboard focus after Escape", async () => {
  const user = userEvent.setup();
  render(
    <DialogRoot>
      <DialogTrigger render={<Button />}>Settings</DialogTrigger>
      <DialogContent>
        <DialogTitle>Simulation settings</DialogTitle>
        <label>
          Duration
          <input defaultValue="180" />
        </label>
        <DialogClose render={<Button />}>Done</DialogClose>
      </DialogContent>
    </DialogRoot>,
  );
  const trigger = screen.getByRole("button", { name: "Settings" });
  await user.click(trigger);
  expect(
    screen.getByRole("dialog", { name: "Simulation settings" }),
  ).toBeVisible();
  await user.keyboard("{Escape}");
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(trigger).toHaveFocus();
});

it("supports arrow-key navigation between composed tabs and their panels", async () => {
  const user = userEvent.setup();
  render(
    <TabsRoot defaultValue="encounter">
      <TabsList aria-label="Settings sections">
        <TabsTab value="encounter">Encounter</TabsTab>
        <TabsTab value="buffs">Buffs</TabsTab>
      </TabsList>
      <TabsPanel value="encounter">Fight duration</TabsPanel>
      <TabsPanel value="buffs">Raid buffs</TabsPanel>
    </TabsRoot>,
  );
  await user.click(screen.getByRole("tab", { name: "Encounter" }));
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("tab", { name: "Buffs" })).toHaveFocus();
  await user.keyboard("{Enter}");
  expect(screen.getByRole("tabpanel")).toHaveTextContent("Raid buffs");
});
