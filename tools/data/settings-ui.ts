import ts from "typescript";
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import * as common from "../../src/generated/wotlk/common";
import versions from "../../data/wotlk/versions.json";

// Extract display metadata only; simulator protobufs remain authoritative for values.
const upstream = ".cache/wotlk";
if (
  execFileSync("git", ["-C", upstream, "rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim() !== versions.engine
)
  throw new Error("Settings metadata must use the pinned simulator revision");
const db = JSON.parse(readFileSync("data/wotlk/db.json", "utf8"));
type Icon = { id: number; name: string; icon: string };
const spells = new Map<number, Icon>(db.spellIcons.map((i: Icon) => [i.id, i]));
const items = new Map<number, Icon>(
  [...db.itemIcons, ...db.items].map((i: Icon) => [i.id, i]),
);
const parse = (path: string) =>
  ts.createSourceFile(
    path,
    readFileSync(`${upstream}/${path}`, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
function prop(node: ts.ObjectLiteralExpression, name: string) {
  const found = node.properties.find((p) => p.name?.getText() === name);
  return found && ts.isPropertyAssignment(found)
    ? found.initializer
    : undefined;
}
function literal(node: ts.Node | undefined) {
  return node && (ts.isStringLiteralLike(node) || ts.isNumericLiteral(node))
    ? node.text
    : undefined;
}
function action(node: ts.Node | undefined) {
  if (!node || !ts.isCallExpression(node)) return undefined;
  const id = Number(literal(node.arguments[0]));
  return node.expression.getText().endsWith("fromSpellId")
    ? spells.get(id)
    : items.get(id);
}
const buffs: Record<
  string,
  { name?: string; icon?: string; max?: number; step?: number; kind?: string }
> = {};
function visitBuff(node: ts.Node) {
  if (
    ts.isCallExpression(node) &&
    /make\w+(RaidBuff|PartyBuff|IndividualBuff|Debuff)Input$/.test(
      node.expression.getText(),
    )
  ) {
    const object = node.arguments[0];
    if (object && ts.isObjectLiteralExpression(object)) {
      const field = literal(prop(object, "fieldName"));
      const group = node.expression.getText().includes("RaidBuff")
        ? "raidBuffs"
        : node.expression.getText().includes("PartyBuff")
          ? "partyBuffs"
          : node.expression.getText().includes("IndividualBuff")
            ? "buffs"
            : "debuffs";
      const icon = action(prop(object, "actionId"));
      const states = Number(literal(prop(object, "numStates")));
      const step = Number(literal(prop(object, "multiplier"))) || 1;
      if (field)
        buffs[`${group}.${field}`] = {
          ...buffs[`${group}.${field}`],
          ...(icon ? { name: icon.name, icon: icon.icon } : {}),
          ...(states ? { max: states - 1, step } : {}),
          ...(node.expression.getText().includes("Quadstate")
            ? { kind: "quad" }
            : {}),
        };
    } else {
      // The pinned UI still uses positional helpers for Revitalize and Mana Tide.
      const multiplied = node.expression.getText().includes("Multiplier");
      const field = literal(node.arguments[multiplied ? 3 : 2]);
      const icon = action(node.arguments[0]);
      const states = Number(literal(node.arguments[1]));
      const group = node.expression.getText().includes("PartyBuff")
        ? "partyBuffs"
        : "buffs";
      if (field && states)
        buffs[`${group}.${field}`] = {
          ...(icon ? { name: icon.name, icon: icon.icon } : {}),
          max: states - 1,
          step: multiplied ? Number(literal(node.arguments[2])) : 1,
        };
    }
  }
  ts.forEachChild(node, visitBuff);
}
visitBuff(parse("ui/core/components/inputs/buffs_debuffs.ts"));
const consumes: Record<
  string,
  Record<string, { itemId: number; name: string; icon?: string }>
> = {};
function visitConsume(node: ts.Node) {
  if (ts.isObjectLiteralExpression(node)) {
    const a = prop(node, "actionId"),
      value = prop(node, "value");
    const field = literal(prop(node, "fieldName"));
    if (a && ts.isCallExpression(a) && field) {
      const itemId = Number(literal(a.arguments[0]));
      const icon = items.get(itemId);
      if (icon)
        (consumes.boolean ??= {})[field] = {
          itemId,
          name: icon.name,
          icon: icon.icon,
        };
    }
    if (
      a &&
      ts.isCallExpression(a) &&
      value &&
      ts.isPropertyAccessExpression(value)
    ) {
      const enumName = value.expression.getText(),
        key = value.name.text;
      const enumeration = (
        common as unknown as Record<string, Record<string, number>>
      )[enumName];
      if (enumeration && typeof enumeration[key] === "number") {
        const itemId = Number(literal(a.arguments[0]));
        const icon = items.get(itemId);
        (consumes[enumName] ??= {})[enumeration[key]] = {
          itemId,
          name: icon?.name ?? key.replace(/([a-z])([A-Z])/g, "$1 $2"),
          icon: icon?.icon,
        };
      }
    }
  }
  ts.forEachChild(node, visitConsume);
}
visitConsume(parse("ui/core/components/inputs/consumables.ts"));
const glyphs: Record<
  string,
  Record<
    string,
    { kind: string; name: string; description: string; icon: string }
  >
> = {};
for (const className of [
  "druid",
  "hunter",
  "mage",
  "paladin",
  "priest",
  "rogue",
  "shaman",
  "warlock",
  "warrior",
  "deathknight",
]) {
  const classId = (common.Class as unknown as Record<string, number>)[
    `Class${className[0].toUpperCase() + className.slice(1)}`
  ];
  const generated = await import(`../../src/generated/wotlk/${className}.ts`);
  glyphs[classId] = {};
  function visit(node: ts.Node) {
    if (
      ts.isPropertyAssignment(node) &&
      ts.isComputedPropertyName(node.name) &&
      ts.isPropertyAccessExpression(node.name.expression) &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      const expression = node.name.expression;
      const id =
        generated[expression.expression.getText()]?.[expression.name.text];
      const name = literal(prop(node.initializer, "name"));
      if (typeof id === "number" && name)
        glyphs[classId][id] = {
          kind: expression.expression.getText().includes("Major")
            ? "major"
            : "minor",
          name,
          description: literal(prop(node.initializer, "description")) ?? "",
          icon: (literal(prop(node.initializer, "iconUrl")) ?? "")
            .split("/")
            .pop()!
            .replace(/\.jpg$/, ""),
        };
    }
    ts.forEachChild(node, visit);
  }
  visit(parse(`ui/core/talents/${className}.ts`));
}
writeFileSync(
  "data/wotlk/settings-ui.json",
  JSON.stringify(
    { revision: versions.engine, buffs, consumes, glyphs },
    null,
    2,
  ) + "\n",
);
console.log(
  `Extracted ${Object.keys(buffs).length} buffs, ${Object.values(consumes).reduce((n, v) => n + Object.keys(v).length, 0)} consumables and ${Object.values(glyphs).reduce((n, v) => n + Object.keys(v).length, 0)} glyphs.`,
);
