import type { Locator } from "@playwright/test";

/** Exercise the shared select through its visible trigger and listbox. */
export async function selectOption(
  trigger: Locator,
  option: string | { label: string },
) {
  await trigger.click();
  const popup = trigger.page().getByRole("listbox");
  const item =
    typeof option === "string"
      ? popup.locator(
          `[role="option"][data-select-value=${JSON.stringify(option)}]`,
        )
      : popup.getByRole("option", { name: option.label, exact: true });
  await item.click();
}
