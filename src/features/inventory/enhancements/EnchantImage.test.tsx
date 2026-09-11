import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import { getCatalog } from "@/domain/equipment/catalog";
import { ItemVersionContext } from "../ItemVersionContext";
import { EnchantImage } from "./EnchantImage";

it.each(["classic", "original"] as const)(
  "uses enchant artwork consistently in %s rows and picker previews",
  (version) => {
    const catalog = getCatalog(version);
    const cases = [
      [3832, "trade_engraving"], // Powerful Stats has formula artwork even on its spell.
      [3252, "trade_engraving"], // Super Stats uses the enchanting symbol directly.
      [3789, "trade_engraving"], // Berserking's spell uses a recipe note.
      [3855, "spell_holy_greaterheal"], // Staff enchant has a distinct spell icon.
      [3604, "trade_engineering"],
      [3370, "spell_frost_frostarmor"],
    ] as const;
    for (const [id, icon] of cases) {
      const { container, unmount } = render(
        <ItemVersionContext value={version}>
          <EnchantImage enchant={catalog.enchants.get(id)?.[0]} />
        </ItemVersionContext>,
      );
      expect(container.querySelector("img")).toHaveAttribute(
        "src",
        `https://wow.zamimg.com/images/wow/icons/large/${icon}.jpg`,
      );
      unmount();
    }
  },
);

it("uses the enchanting symbol when no enchant is selected", () => {
  const { container } = render(<EnchantImage />);
  expect(container.querySelector("img")).toHaveAttribute(
    "src",
    "https://wow.zamimg.com/images/wow/icons/large/trade_engraving.jpg",
  );
});
