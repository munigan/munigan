import { load } from "cheerio";
import {
  ItemTooltipSchema,
  tooltipSourceUrl,
  type ItemTooltip,
  type TooltipLine,
} from "../../../src/domain/tooltips/contracts";

type HtmlNode = {
  type: string;
  data?: string;
  name?: string;
  attribs?: Record<string, string>;
  children?: HtmlNode[];
};
type RawLine = { text: string; effect: boolean; set: boolean };
const clean = (text: string) =>
  text
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;])/g, "$1")
    .trim();

/** Read structure and text only. No upstream markup survives this boundary. */
function parseHtml(
  html: string,
  metadata: Omit<
    ItemTooltip,
    | "schemaVersion"
    | "lines"
    | "sockets"
    | "socketBonus"
    | "itemLevel"
    | "heroic"
  >,
): ItemTooltip {
  const $ = load(html, {}, false);
  const name = $("b").first();
  if (clean(name.text()) !== metadata.name)
    throw new Error("Invalid tooltip name");
  name.remove();
  $(".whtt-ilvl").removeClass("whtt-extra");
  $(
    "script, style, noscript, iframe, object, embed, form, input, button, img, [hidden], .whtt-extra, .whtt-sellprice",
  ).remove();
  // Cavern's interactive rating calculator repeats the actual rating as a level-
  // dependent percentage. Keep the rating itself, without its JavaScript UI.
  $("small").each((_, node) => {
    if ($(node).find('[onclick*="openDB_setRatingLevel"]').length)
      $(node).remove();
  });
  const rows: RawLine[] = [];
  let text = "",
    effect = false,
    inSet = false;
  const flush = () => {
    if (text.trim()) rows.push({ text, effect, set: inSet });
    text = "";
    effect = false;
  };
  const walk = (node: HtmlNode, green = false) => {
    if (node.type === "text") {
      text += node.data ?? "";
      if ((node.data ?? "").trim()) effect ||= green;
      return;
    }
    if (node.type === "comment") return;
    const tag = node.name ?? "";
    if (tag === "br") {
      flush();
      return;
    }
    const block = ["table", "tr", "div", "p", "li"].includes(tag);
    if (block) flush();
    if (/item-?set[=/]/.test(node.attribs?.href ?? "")) inSet = true;
    if ((tag === "td" || tag === "th") && text.trim()) text += "\t";
    const isGreen =
      green || /(?:^|\s)q2(?:\s|$)/.test(node.attribs?.class ?? "");
    for (const child of node.children ?? []) walk(child, isGreen);
    if (block) flush();
  };
  for (const node of $.root().contents().toArray()) walk(node);
  flush();

  const lines: TooltipLine[] = [],
    sockets: ItemTooltip["sockets"] = [];
  let itemLevel: number | null = null,
    heroic = false,
    socketBonus: string | null = null;
  for (const row of rows) {
    const cells = row.text.split("\t").map(clean).filter(Boolean);
    const value = clean(cells[0] ?? "");
    if (!value || /^Sell Price:/.test(value)) continue;
    const level = /^Item Level\s+(\d+)$/.exec(value);
    if (level) {
      itemLevel = Number(level[1]);
      continue;
    }
    if (value === "Heroic") {
      heroic = true;
      continue;
    }
    const socket = /^(Red|Yellow|Blue|Meta|Prismatic) Socket$/i.exec(value);
    if (socket) {
      sockets.push(socket[1].toLowerCase() as ItemTooltip["sockets"][number]);
      continue;
    }
    if (/^Socket Bonus:/.test(value)) {
      socketBonus = value.replace(/^Socket Bonus:\s*/, "");
      continue;
    }
    const kind: TooltipLine["kind"] =
      /^(Binds |Unique|Conjured|Quest Item)/.test(value)
        ? "binding"
        : /^(Requires|Classes:|Races:)/.test(value)
          ? "requirement"
          : /^Durability /.test(value)
            ? "durability"
            : /^\(\d+\) Set\s*:/.test(value) || row.set
              ? "set"
              : /^(Equip:|Use:|Chance on hit:)/.test(value)
                ? "effect"
                : /damage per second|\d.* Damage$/.test(value)
                  ? "weapon"
                  : /^[+-]\d|^\d+ Armor$|^\d+ Block$/.test(value)
                    ? "stat"
                    : /^[“"]/.test(value)
                      ? "flavor"
                      : cells.length > 1 ||
                          /^(Head|Neck|Shoulder|Back|Chest|Shirt|Tabard|Wrist|Hands|Waist|Legs|Feet|Finger|Trinket|Relic|Libram|Totem|Idol|Sigil|Two-[Hh]and|One-[Hh]and|Main [Hh]and|Off [Hh]and|Held In Off-hand|Ranged|Thrown)$/.test(
                            value,
                          )
                        ? "slot"
                        : row.effect
                          ? "effect"
                          : "description";
    lines.push({
      kind,
      text: value,
      ...(cells.length > 1 ? { rightText: cells.slice(1).join(" · ") } : {}),
    });
  }
  return ItemTooltipSchema.parse({
    ...metadata,
    schemaVersion: 1,
    itemLevel,
    heroic,
    lines,
    sockets,
    socketBonus,
  });
}

export function parseWowhead(input: unknown, id: number): ItemTooltip {
  if (!input || typeof input !== "object")
    throw new Error("Invalid Wowhead payload");
  const data = input as Record<string, unknown>;
  if (typeof data.tooltip !== "string" || typeof data.name !== "string")
    throw new Error("Missing Wowhead tooltip");
  // Cheerio repairs truncated markup. Check the original response first so a
  // title/binding-only prefix cannot overwrite a complete cached item.
  const markup = data.tooltip.replace(/<!--[\s\S]*?-->/g, "").trim();
  let depth = 0,
    sections = 0;
  for (const tag of markup.match(/<\/?table\b[^>]*>/gi) ?? []) {
    if (depth === 0 && !/^<\//.test(tag)) sections++;
    depth += /^<\//.test(tag) ? -1 : 1;
    if (depth < 0) throw new Error("Incomplete Wowhead tooltip");
  }
  if (
    depth !== 0 ||
    sections < 2 ||
    !/^<table\b/i.test(markup) ||
    !/<\/table>$/i.test(markup)
  )
    throw new Error("Incomplete Wowhead tooltip");
  // This marker belongs to the tooltip itself, unlike name/icon metadata.
  const identity = /<!--i\?(\d+):/.exec(data.tooltip);
  // Gem/consumable tooltips omit this marker. If supplied, it must agree with
  // the fixed requested endpoint; the title is checked for every item.
  if (identity && Number(identity[1]) !== id)
    throw new Error("Mismatched Wowhead item");
  return parseHtml(data.tooltip, {
    id,
    version: "classic",
    source: { provider: "wowhead", url: tooltipSourceUrl("classic", id) },
    name: data.name,
    quality: data.quality as number,
    icon: data.icon as string,
  });
}

export function parseCavernOfTime(html: string, id: number): ItemTooltip {
  if (!/<\/body>\s*<\/html>\s*$/i.test(html))
    throw new Error("Incomplete Cavern of Time document");
  const $ = load(html);
  const tooltip = $(`#tooltip${id}-generic.tooltip`);
  if (tooltip.length !== 1) throw new Error("Missing Cavern of Time tooltip");
  const title = tooltip.find("b").first();
  const quality = /(?:^|\s)q([0-7])(?:\s|$)/.exec(title.attr("class") ?? "");
  const icon =
    new RegExp(
      `ge\\(['"]icon${id}-generic['"]\\)\\.appendChild\\(Icon\\.create\\(['"]([a-z0-9_-]+)['"]`,
    ).exec(html)?.[1] ?? null;
  if (!quality || !title.text().trim() || !icon)
    throw new Error("Invalid Cavern of Time identity");
  return parseHtml(tooltip.html()!, {
    id,
    version: "original",
    source: { provider: "cavernoftime", url: tooltipSourceUrl("original", id) },
    name: clean(title.text()),
    quality: Number(quality[1]),
    icon,
  });
}
