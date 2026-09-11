import { expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { createTranslator, NextIntlClientProvider } from "next-intl";
import { Stat, Race } from "@/generated/wotlk/common";
import { defaultSettings, listSpecs } from "@/features/settings/registry";
import type { SetRow, Snapshot } from "@/domain/top-gear/model";
import {
  characterStats,
  combinationStats,
  ratingConversions as r,
} from "./character-stats";
import { presentCombinationStat } from "./stat-presentation";
import { StatsDetails } from "./StatsDetails";
import { CombinationStats } from "./CombinationStats";
import en from "../../../messages/en-US/reports.json";
import pt from "../../../messages/pt-BR/reports.json";
import commonEn from "../../../messages/en-US/common.json";
import commonPt from "../../../messages/pt-BR/common.json";
import trees from "../../../data/wotlk/talent-trees.json";

function frost() {
  const spec = listSpecs().find(
    (s) => s.module === "deathknight" && s.id.includes("Frost"),
  )!;
  const settings = defaultSettings(spec.id);
  settings.player!.race = Race.RaceTroll;
  const snapshot = {
    specId: spec.id,
    settings,
    inventory: [],
    equipped: {},
  } as unknown as Snapshot;
  const row = { loadout: {}, stats: Array(40).fill(0) } as SetRow;
  row.stats![Stat.StatExpertise] = 26 * r.expertise;
  row.stats![Stat.StatMeleeHit] = 8 * r.meleeHit;
  return { snapshot, row };
}

it.each([
  ["en-US", en, commonEn, "Includes +5 expertise from Tundra Stalker", "6.50%"],
  ["pt-BR", pt, commonPt, "Inclui +5 de aptidão de Tundra Stalker", "6,50%"],
] as const)(
  "discloses talent expertise in the %s row tooltip and dialog without adding it twice",
  (locale, messages, common, expected, percent) => {
    const { snapshot, row } = frost();
    const before = JSON.stringify({ snapshot, row });
    const stats = combinationStats(row, snapshot);
    render(
      <NextIntlClientProvider
        locale={locale}
        messages={{ reports: messages, common }}
      >
        <CombinationStats stats={stats} />
        <StatsDetails row={row} snapshot={snapshot} onClose={() => {}} />
      </NextIntlClientProvider>,
    );
    const tooltip = document.querySelector(
      `.combination-stats [title*="Tundra Stalker"]`,
    );
    expect(tooltip).toHaveAttribute("title", expect.stringContaining(expected));
    expect(tooltip?.querySelector("dd")).toHaveTextContent(percent);
    expect(
      within(screen.getByRole("dialog")).getByText(expected),
    ).toBeVisible();
    expect(
      characterStats(row, snapshot).accuracy.find((s) => s.id === "expertise")
        ?.effective,
    ).toBeCloseTo(26);
    expect(JSON.stringify({ snapshot, row })).toBe(before);
  },
);

it("includes talent descriptions for armor penetration and crit in row tooltips", () => {
  const spec = listSpecs().find((s) => s.module === "rogue")!;
  const snapshot = {
    specId: spec.id,
    settings: defaultSettings(spec.id),
    inventory: [],
    equipped: {},
  } as unknown as Snapshot;
  const selected: Record<string, number> = { malice: 5, serratedBlades: 3 };
  const classTrees = (
    trees as Record<string, { talents: { fieldName?: string }[] }[]>
  )[String(spec.classId)];
  snapshot.settings.player!.talentsString = classTrees
    .map((tree) =>
      tree.talents
        .map((talent) => selected[talent.fieldName ?? ""] ?? 0)
        .join(""),
    )
    .join("-");
  const row = { loadout: {}, stats: Array(40).fill(0) } as SetRow;
  row.stats![Stat.StatMeleeCrit] = 20 * r.crit;
  row.stats![Stat.StatArmorPenetration] = 699.5;
  const t = createTranslator({ locale: "en-US", messages: en });
  const stats = combinationStats(row, snapshot);
  const stat = stats.find((s) => s.id === String(Stat.StatMeleeCrit))!;
  expect(presentCombinationStat(stat, t, "en-US").description).toContain(
    "Includes +5% from Malice",
  );
  expect(stat.percent).toBe(20);
  const armor = stats.find((s) => s.id === "armor-penetration")!;
  expect(presentCombinationStat(armor, t, "en-US").description).toContain(
    "Includes +9% from Serrated Blades",
  );
  expect(armor.percent).toBe(50);
  render(
    <NextIntlClientProvider
      locale="en-US"
      messages={{ reports: en, common: commonEn }}
    >
      <StatsDetails row={row} snapshot={snapshot} onClose={() => {}} />
    </NextIntlClientProvider>,
  );
  expect(screen.getByText("Includes +9% from Serrated Blades")).toBeVisible();
  expect(screen.getByText("Includes +5% from Malice")).toBeVisible();
});
