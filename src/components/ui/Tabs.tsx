"use client";
import { classes } from "./classes";

import { Tabs } from "@base-ui/react/tabs";
export const TabsRoot = Tabs.Root;
export const TabsPanel = Tabs.Panel;
export function TabsList({ className, ...props }: Tabs.List.Props) {
  return (
    <Tabs.List
      {...props}
      className={(state) =>
        classes(
          "flex gap-1",
          typeof className === "function" ? className(state) : className,
        )
      }
    />
  );
}
export function TabsTab({ className, ...props }: Tabs.Tab.Props) {
  return (
    <Tabs.Tab
      {...props}
      className={(state) =>
        classes(
          "min-h-10 shrink-0 rounded-control px-4 py-2 text-sm font-medium text-muted hover:text-text data-active:bg-selected-surface data-active:text-text focus-visible:outline-2 focus-visible:outline-action",
          typeof className === "function" ? className(state) : className,
        )
      }
    />
  );
}
