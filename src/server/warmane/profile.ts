import { load } from "cheerio";
import { AppError, type DiagnosticCode } from "@/i18n/error";
import {
  type ArmoryCharacter,
  type WarmaneLookup,
} from "@/features/import/warmane";
import gemIds from "../../../data/wotlk/warmane-gem-ids.json";

// Profile slot layout and DBC gem mapping follow Poli93's deployed importer.
// Source/provenance: docs/engineering/warmane-import-research.md; MIT license:
// public/licenses/Poli93-wotlk.txt. Empty slots and gem positions must be retained.
const columns = {
  "item-left": [0, 1, 2, 3, 4, null, null, 5],
  "item-right": [6, 7, 8, 9, 10, 11, 12, 13],
  "item-bottom": [14, 15, 16],
};
const races = [
  "Blood Elf",
  "Night Elf",
  "Draenei",
  "Dwarf",
  "Gnome",
  "Human",
  "Orc",
  "Tauren",
  "Troll",
  "Undead",
];
const classes = [
  "Death Knight",
  "Druid",
  "Hunter",
  "Mage",
  "Paladin",
  "Priest",
  "Rogue",
  "Shaman",
  "Warlock",
  "Warrior",
];
const professions = [
  "Alchemy",
  "Blacksmithing",
  "Enchanting",
  "Engineering",
  "Herbalism",
  "Inscription",
  "Jewelcrafting",
  "Leatherworking",
  "Mining",
  "Skinning",
  "Tailoring",
];

export class WarmaneError extends AppError {
  constructor(
    code: DiagnosticCode,
    message: string,
    public readonly status: number = 502,
    params?: Record<string, number>,
  ) {
    super(code, message, params);
  }
}
const invalid = () =>
  new WarmaneError(
    "warmaneInvalidProfile",
    "Could not read this Armory profile completely. Try again or use an addon export.",
  );
const notFound = () =>
  new WarmaneError(
    "warmaneNotFound",
    "Character not found. Check the name and realm.",
    404,
  );

function id(value: string | null) {
  if (value === null) return 0;
  if (!/^\d{1,8}$/.test(value)) throw invalid();
  return Number(value);
}

export function parseWarmaneProfile(
  html: string,
  lookup: WarmaneLookup,
): ArmoryCharacter {
  const $ = load(html);
  if (/character (does not exist|not found)/i.test($.text())) throw notFound();
  const sheet = $("#character-sheet");
  const identity = sheet
    .find(".level-race-class")
    .text()
    .replace(/\s+/g, " ")
    .trim();
  const match = /^Level (\d+) (.+), (\w+)$/.exec(identity);
  if (!match || match[3] !== lookup.realm) throw invalid();
  if (Number(match[1]) !== 80)
    throw new AppError(
      "wrathLevel",
      "This importer supports level 80 Wrath characters",
    );
  const race = races.find((value) => match[2].startsWith(value + " "));
  const characterClass = race ? match[2].slice(race.length + 1) : "";
  if (!race || !classes.includes(characterClass)) throw invalid();
  const nameNode = sheet.find(".name").first().clone();
  nameNode.children().remove();
  const name = nameNode.text().trim();
  if (name.toLowerCase() !== lookup.name.toLowerCase()) throw invalid();
  const items: ArmoryCharacter["gear"]["items"] = Array.from(
    { length: 17 },
    () => ({ id: 0, enchant: 0, gems: [] }),
  );
  for (const [column, slots] of Object.entries(columns)) {
    const elements = $(
      `#character-profile .item-model .${column} > .item-slot`,
    );
    if (elements.length !== slots.length) throw invalid();
    elements.each((index, element) => {
      const slot = slots[index];
      if (slot === null) return; // Shirt and tabard aren't simulator slots.
      const links = $(element).find('a[rel^="item="]');
      if (!links.length) {
        if (!$(element).find('a[href="#self"]').length) throw invalid();
        return;
      }
      if (links.length !== 1) throw invalid();
      const params = new URLSearchParams(links.attr("rel"));
      const itemId = id(params.get("item"));
      if (!itemId) throw invalid();
      const gems = params.has("gems")
        ? params
            .get("gems")!
            .split(":")
            .map((value) => {
              const enchantId = id(value);
              if (!enchantId) return 0;
              const gem = (gemIds as Record<string, number>)[enchantId];
              if (!gem)
                throw new WarmaneError(
                  "warmaneUnknownGem",
                  `Armory gem ${enchantId} could not be identified. Use an addon export to preserve your gems.`,
                  422,
                  { id: enchantId },
                );
              return gem;
            })
        : [];
      if (gems.length > 4) throw invalid();
      items[slot] = { id: itemId, enchant: id(params.get("ench")), gems };
    });
  }
  if (!items.some((item) => item.id)) throw invalid();
  const importedProfessions: ArmoryCharacter["professions"] = [];
  $("#character-profile .profskills .stub .text").each((_, element) => {
    const text = $(element).clone();
    const rank = text.find(".value").text().trim();
    text.find(".value").remove();
    const name = text.text().trim();
    if (!professions.includes(name)) return; // Exclude secondary skills.
    const skill = /^(\d+)\s*\/\s*(\d+)$/.exec(rank);
    const reportedLevel = Number(skill?.[1]),
      maximum = Number(skill?.[2]);
    const racialProfession = {
      Draenei: "Jewelcrafting",
      Gnome: "Engineering",
      Tauren: "Herbalism",
      "Blood Elf": "Enchanting",
    }[race];
    const cap = racialProfession === name ? 465 : 450;
    if (
      !Number.isInteger(reportedLevel) ||
      reportedLevel < 1 ||
      reportedLevel > maximum ||
      maximum > cap
    )
      throw invalid();
    // Armory includes racial bonuses (e.g. 455/455 Jewelcrafting). The simulator
    // models profession ranks only through 450; excess skill adds no higher tier.
    const level = Math.min(reportedLevel, 450);
    importedProfessions.push({ name, level });
  });
  if (importedProfessions.length > 2) throw invalid();
  return {
    name,
    class: characterClass,
    race,
    level: 80,
    gear: { items },
    professions: importedProfessions,
  };
}
