import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import { fixtureRequest } from "../../../../tests/support/fixtures";
import enInventory from "../../../../messages/en-US/inventory.json";
import ptInventory from "../../../../messages/pt-BR/inventory.json";
import enCommon from "../../../../messages/en-US/common.json";
import ptCommon from "../../../../messages/pt-BR/common.json";
import { ItemEnhancementEditor } from "./ItemEnhancementEditor";
import type { ItemInstance, TopGearRequest } from "@/domain/top-gear/model";

function setup(
  initialField: number | "enchant" = 0,
  configure?: (request: TopGearRequest) => void,
) {
  const request = fixtureRequest();
  const item: ItemInstance = {
    instanceId: "custom-50037",
    itemId: 50037,
    gemIds: [],
    enchantId: 0,
    source: "custom",
  };
  request.snapshot.inventory.push(item);
  configure?.(request);
  const onApply = vi.fn(),
    onClose = vi.fn();
  function View({ locale = "en-US" }: { locale?: "en-US" | "pt-BR" }) {
    return (
      <NextIntlClientProvider
        locale={locale}
        messages={{
          inventory: locale === "en-US" ? enInventory : ptInventory,
          common: locale === "en-US" ? enCommon : ptCommon,
        }}
      >
        <ItemEnhancementEditor
          request={request}
          item={item}
          initialField={initialField}
          onApply={onApply}
          onClose={onClose}
        />
      </NextIntlClientProvider>
    );
  }
  const view = render(<View />);
  return { ...view, request, item, onApply, onClose, View };
}

it("keeps manual gem and empty enchant changes local across fields until applying", async () => {
  const { request, onApply, onClose } = setup();
  const original = JSON.stringify(request);
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "40111" },
  });
  await userEvent.click(
    screen.getByRole("radio", { name: /Bold Cardinal Ruby/ }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Enchant" }));
  await userEvent.click(screen.getByRole("radio", { name: "No enchant" }));
  expect(JSON.stringify(request)).toBe(original);
  expect(onApply).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Apply changes" }));
  expect(
    onApply.mock.calls[0][0].snapshot.itemEnhancements["custom-50037"],
  ).toEqual({ gemIds: [40111], enchantId: 0 });
  expect(onClose).toHaveBeenCalledOnce();
});

it("discards pending choices on cancel", async () => {
  const { onApply, onClose } = setup();
  await userEvent.click(screen.getByRole("radio", { name: "Empty socket" }));
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(onApply).not.toHaveBeenCalled();
  expect(onClose).toHaveBeenCalledOnce();
});

it("resets all fields to automatic without mutating the imported item", async () => {
  const { onApply, request } = setup();
  await userEvent.click(screen.getByRole("radio", { name: "Empty socket" }));
  await userEvent.click(screen.getByRole("button", { name: "Reset item" }));
  expect(screen.getByRole("radio", { name: "Automatic" })).toBeChecked();
  await userEvent.click(screen.getByRole("button", { name: "Apply changes" }));
  expect(
    onApply.mock.calls[0][0].snapshot.itemEnhancements?.["custom-50037"],
  ).toBeUndefined();
  expect(request.snapshot.inventory.at(-1)?.gemIds).toEqual([]);
});

it("preserves pending selection while searching localized stats and changing locale", async () => {
  const { rerender, View } = setup();
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "40111" },
  });
  await userEvent.click(
    screen.getByRole("radio", { name: /Bold Cardinal Ruby/ }),
  );
  rerender(<View locale="pt-BR" />);
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "Força" },
  });
  expect(
    screen.getByRole("radio", { name: /Bold Cardinal Ruby/ }),
  ).toBeChecked();
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "not-a-real-gem" },
  });
  expect(screen.getByText("Nenhuma gema encontrada")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Aplicar alterações" }),
  ).toBeEnabled();
});

it("uses a color filter without making legal mismatched gems unavailable", async () => {
  setup();
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "40111" },
  });
  expect(
    screen.getByRole("radio", { name: /Bold Cardinal Ruby/ }),
  ).toBeEnabled();
  await userEvent.click(
    screen.getByRole("checkbox", { name: "Match socket color" }),
  );
  expect(
    screen.queryByRole("radio", { name: /Bold Cardinal Ruby/ }),
  ).not.toBeInTheDocument();
  expect(
    within(screen.getByRole("dialog")).getByText(/Inactive ·/),
  ).toBeInTheDocument();
});

it("reveals disabled gems with localized unknown profession rank requirements", async () => {
  const { rerender, View } = setup(0, (request) => {
    delete request.snapshot.professionLevels;
  });
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "42142" },
  });
  expect(
    screen.queryByRole("radio", { name: /Bold Dragon/ }),
  ).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("checkbox", { name: "Show unavailable" }),
  );
  expect(screen.getByRole("radio", { name: /Bold Dragon/ })).toBeDisabled();
  expect(
    screen.getByText("Verify Jewelcrafting rank: requires 350."),
  ).toBeInTheDocument();
  rerender(<View locale="pt-BR" />);
  expect(
    screen.getByText("Verifique o nível de Joalheria: requer 350."),
  ).toBeInTheDocument();
});

it("retains an invalid stored override and lets Automatic recover it", async () => {
  const { onApply } = setup(0, (request) => {
    request.snapshot.itemEnhancements = { "custom-50037": { gemIds: [42142] } };
    delete request.snapshot.professionLevels;
  });
  expect(screen.getByRole("button", { name: "Apply changes" })).toBeDisabled();
  expect(screen.getByRole("alert")).toHaveTextContent(/Jewelcrafting/);
  await userEvent.click(screen.getByRole("radio", { name: "Automatic" }));
  expect(screen.getByRole("button", { name: "Apply changes" })).toBeEnabled();
  await userEvent.click(screen.getByRole("button", { name: "Apply changes" }));
  expect(onApply.mock.calls[0][0].snapshot.itemEnhancements).toBeUndefined();
});

it("allows ordinary enchants without Enchanting and disables unavailable profession enchants", async () => {
  setup("enchant", (request) => {
    request.snapshot.settings.player!.profession1 = 0;
    request.snapshot.settings.player!.profession2 = 0;
  });
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "Crusher" },
  });
  expect(screen.getByRole("radio", { name: "Crusher" })).toBeEnabled();
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "Hyperspeed Accelerators" },
  });
  expect(
    screen.queryByRole("radio", { name: "Hyperspeed Accelerators" }),
  ).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("checkbox", { name: "Show unavailable" }),
  );
  expect(
    screen.getByRole("radio", { name: "Hyperspeed Accelerators" }),
  ).toBeDisabled();
  expect(screen.getByText("Requires Engineering 400.")).toBeInTheDocument();
});

it("identifies the Blacksmith socket separately from built-in sockets", () => {
  setup(0, (request) => {
    request.snapshot.settings.player!.profession1 = 2;
    request.snapshot.professionLevels = { 2: 450 };
  });
  expect(
    screen.getByRole("button", { name: "Socket 3 · Blacksmith socket" }),
  ).toBeInTheDocument();
});

it("finds proc enchants by their localized effect stats", async () => {
  const { rerender, View } = setup("enchant", (request) => {
    request.snapshot.professionLevels = { 4: 450, 7: 450 };
  });
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "haste" },
  });
  expect(
    screen.getByRole("radio", { name: "Hyperspeed Accelerators" }),
  ).toBeEnabled();
  expect(screen.getByText(/340 haste rating/)).toBeInTheDocument();
  rerender(<View locale="pt-BR" />);
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "aceleração" },
  });
  expect(
    screen.getByRole("radio", { name: "Hyperspeed Accelerators" }),
  ).toBeEnabled();
});

it("uses formula artwork for enchant choices", () => {
  setup("enchant", (request) => {
    request.snapshot.inventory.find(
      (i) => i.instanceId === "custom-50037",
    )!.itemId = 47446;
  });
  const choice = screen
    .getByRole("radio", { name: "Berserking" })
    .closest("label")!;
  expect(choice.querySelector("img")).toHaveAttribute(
    "src",
    expect.stringContaining("inv_enchant_formulasuperior_01"),
  );
});

it("shows only gem controls for a necklace even when asked to open enchants", () => {
  setup("enchant", (request) => {
    request.snapshot.inventory.find(
      (i) => i.instanceId === "custom-50037",
    )!.itemId = 47988;
  });
  expect(screen.getByRole("dialog", { name: "Gems" })).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Enchant" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("radio", { name: "No enchant" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("searchbox", { name: "Search gems" })).toBeVisible();
});
