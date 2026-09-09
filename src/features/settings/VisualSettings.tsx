"use client";
import { useState } from "react";
import Image from "next/image";
import type { JsonObject } from "@protobuf-ts/runtime";
import {
  RaidBuffs,
  PartyBuffs,
  IndividualBuffs,
  Debuffs,
  Consumes,
  Conjured,
  Profession,
  Class,
} from "@/generated/wotlk/common";
import type { Snapshot } from "@/domain/top-gear/model";
import metadata from "../../../data/wotlk/settings-ui.json";
import { ItemIcon } from "@/features/inventory/Item";

const humanize = (name: string) =>
  name
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
type Props = { snapshot: Snapshot; onPatch: (patch: JsonObject) => void };
type BuffMeta = {
  name?: string;
  icon?: string;
  kind?: string;
  max?: number;
  step?: number;
};
type ConsumeMeta = { itemId: number; name: string; icon?: string };
type GlyphMeta = {
  kind: string;
  name: string;
  description: string;
  icon: string;
};
const buffMeta = metadata.buffs as Record<string, BuffMeta>;
const consumeMeta = metadata.consumes as Record<
  string,
  Record<string, ConsumeMeta>
>;
const glyphMeta = metadata.glyphs as Record<string, Record<string, GlyphMeta>>;

export function SettingIcon({ icon }: { icon?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="setting-icon" aria-hidden="true">
      {icon && !failed ? (
        <Image
          unoptimized
          src={`https://wow.zamimg.com/images/wow/icons/large/${icon}.jpg`}
          width={32}
          height={32}
          alt=""
          onError={() => setFailed(true)}
        />
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="m12 3 3 6 6 3-6 3-3 6-3-6-6-3 6-3Z" />
        </svg>
      )}
    </span>
  );
}
export const professionIcons: Record<number, string> = {
  [Profession.Alchemy]: "trade_alchemy",
  [Profession.Blacksmithing]: "trade_blacksmithing",
  [Profession.Enchanting]: "trade_engraving",
  [Profession.Engineering]: "trade_engineering",
  [Profession.Herbalism]: "trade_herbalism",
  [Profession.Inscription]: "inv_inscription_tradeskill01",
  [Profession.Jewelcrafting]: "inv_misc_gem_01",
  [Profession.Leatherworking]: "trade_leatherworking",
  [Profession.Mining]: "trade_mining",
  [Profession.Skinning]: "inv_misc_pelt_wolf_01",
  [Profession.Tailoring]: "trade_tailoring",
};
const buffGroups = [
  { key: "raidBuffs", title: "Raid buffs", type: RaidBuffs },
  { key: "buffs", title: "Personal buffs", type: IndividualBuffs },
  { key: "debuffs", title: "Target debuffs", type: Debuffs },
  { key: "partyBuffs", title: "Party buffs", type: PartyBuffs },
] as const;
const buffLabels: Record<string, string> = {
  demonicPactSp: "Demonic Pact spell power",
  revitalizeRejuvination: "Revitalize: Rejuvenation uptime (%)",
  revitalizeWildGrowth: "Revitalize: Wild Growth uptime (%)",
  atieshMage: "Atiesh (Mage)",
  atieshWarlock: "Atiesh (Warlock)",
};
export function BuffControls({ snapshot, onPatch }: Props) {
  const [search, setSearch] = useState(""),
    [activeOnly, setActiveOnly] = useState(false);
  const groups = buffGroups.map((group) => {
    const values = (group.key === "buffs"
      ? snapshot.settings.player?.buffs
      : snapshot.settings[group.key]) as unknown as
      Record<string, number | boolean> | undefined;
    const fields = group.type.fields.filter((field) => {
      const m = buffMeta[`${group.key}.${field.localName}`];
      return (
        (!activeOnly || Boolean(values?.[field.localName])) &&
        `${buffLabels[field.localName] ?? m?.name ?? humanize(field.localName)} ${humanize(field.localName)}`
          .toLowerCase()
          .includes(search.toLowerCase())
      );
    });
    return { ...group, values, fields };
  });
  return (
    <div className="visual-buffs">
      <div className="settings-filter">
        <input
          type="search"
          aria-label="Find a buff"
          placeholder="Find a buff or debuff…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
          />
          Active only
        </label>
      </div>
      {groups.map((group) => {
        const { values, fields } = group;
        if (!fields.length) return null;
        return (
          <details
            key={`${group.key}-${Boolean(search)}-${activeOnly}`}
            className="buff-group"
            open={group.key === "raidBuffs" || Boolean(search) || activeOnly}
          >
            <summary>
              {group.title}
              <span>
                {Object.values(values ?? {}).filter(Boolean).length} active
              </span>
            </summary>
            <div className="buff-grid">
              {fields.map((field) => {
                const key = field.localName,
                  m = buffMeta[`${group.key}.${key}`],
                  value = values?.[key] ?? 0,
                  label = buffLabels[key] ?? m?.name ?? humanize(key);
                const set = (v: boolean | number) =>
                  onPatch(
                    group.key === "buffs"
                      ? { player: { buffs: { [key]: v } } }
                      : { [group.key]: { [key]: v } },
                  );
                const isBool = field.kind === "scalar" && field.T === 8;
                return (
                  <label
                    className="buff-control"
                    key={key}
                    data-active={Boolean(value)}
                  >
                    <SettingIcon key={m?.icon ?? key} icon={m?.icon} />
                    <span className="buff-label">{label}</span>
                    {isBool ? (
                      <input
                        aria-label={label}
                        type="checkbox"
                        checked={Boolean(value)}
                        onChange={(e) => set(e.target.checked)}
                      />
                    ) : field.kind === "enum" || m?.kind === "quad" ? (
                      <select
                        aria-label={label}
                        value={Number(value)}
                        onChange={(e) => set(Number(e.target.value))}
                      >
                        <option value={0}>Off</option>
                        <option value={1}>Normal</option>
                        <option value={2}>Improved</option>
                        {m?.kind === "quad" && (
                          <option value={3}>Improved + glyph</option>
                        )}
                      </select>
                    ) : (
                      <input
                        aria-label={label}
                        type="number"
                        min={0}
                        max={m?.max}
                        step={1}
                        value={Number(value)}
                        onChange={(e) => {
                          const next = Number(e.target.value);
                          if (
                            Number.isInteger(next) &&
                            next >= 0 &&
                            (m?.max === undefined || next <= m.max)
                          )
                            set(next);
                        }}
                      />
                    )}
                  </label>
                );
              })}
            </div>
          </details>
        );
      })}
      {!groups.some((group) => group.fields.length > 0) && (
        <div className="settings-empty">
          <p>No buffs match these filters.</p>
          <button
            className="text-button"
            onClick={() => {
              setSearch("");
              setActiveOnly(false);
            }}
          >
            Reset filters
          </button>
        </div>
      )}
    </div>
  );
}
const consumeLabels: Record<string, string> = {
  flask: "Flask",
  battleElixir: "Battle elixir",
  guardianElixir: "Guardian elixir",
  food: "Food",
  defaultPotion: "Combat potion",
  prepopPotion: "Pre-pull potion",
  defaultConjured: "Conjured item",
  petFood: "Pet food",
  petScrollOfAgility: "Pet agility scroll rank",
  petScrollOfStrength: "Pet strength scroll rank",
  thermalSapper: "Global Thermal Sapper Charge",
  explosiveDecoy: "Explosive Decoy",
  fillerExplosive: "Explosive",
};
export function ConsumeControls({ snapshot, onPatch }: Props) {
  const consumes = snapshot.settings.player?.consumes ?? Consumes.create();
  function set(key: string, value: number | boolean) {
    const patch: JsonObject = { [key]: value };
    if (key === "flask" && value) {
      patch.battleElixir = 0;
      patch.guardianElixir = 0;
    }
    if ((key === "battleElixir" || key === "guardianElixir") && value)
      patch.flask = 0;
    onPatch({ player: { consumes: patch } });
  }
  function field(key: string) {
    const definition = Consumes.fields.find((f) => f.localName === key)!;
    const value = (consumes as unknown as Record<string, number | boolean>)[
      key
    ];
    const enumeration = definition.kind === "enum" ? definition.T() : null;
    const options = enumeration
      ? Object.entries(enumeration[1]).filter(
          ([, v]) =>
            typeof v === "number" &&
            (key !== "defaultConjured" ||
              v !== Conjured.ConjuredRogueThistleTea ||
              snapshot.settings.player?.class === Class.ClassRogue ||
              v === value),
        )
      : [];
    const item = enumeration
      ? consumeMeta[enumeration[0].replace("proto.", "")]?.[String(value)]
      : consumeMeta.boolean?.[key];
    return (
      <label className="consume-control" key={key}>
        <span>{consumeLabels[key]}</span>
        <span className="consume-input">
          {item ? (
            <ItemIcon
              item={{
                instanceId: `consume-${key}`,
                itemId: item.itemId,
                enchantId: 0,
                gemIds: [],
                source: "bag",
              }}
              size={32}
            />
          ) : (
            <SettingIcon />
          )}
          {enumeration ? (
            <select
              aria-label={consumeLabels[key]}
              value={Number(value)}
              onChange={(e) => set(key, Number(e.target.value))}
            >
              {options.map(([name, v]) => (
                <option key={name} value={v}>
                  {v === 0
                    ? "None"
                    : (consumeMeta[enumeration[0].replace("proto.", "")]?.[
                        String(v)
                      ]?.name ??
                      humanize(
                        name.replace(/^(Food|PetFood|Conjured|Explosive)/, ""),
                      ))}
                </option>
              ))}
            </select>
          ) : definition.kind === "scalar" && definition.T === 8 ? (
            <input
              type="checkbox"
              aria-label={consumeLabels[key]}
              checked={Boolean(value)}
              onChange={(e) => set(key, e.target.checked)}
            />
          ) : (
            <input
              type="number"
              min={0}
              max={5}
              aria-label={consumeLabels[key]}
              value={Number(value)}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isInteger(n) && n >= 0 && n <= 5) set(key, n);
              }}
            />
          )}
        </span>
      </label>
    );
  }
  const player = snapshot.settings.player!;
  const professions = [player.profession1, player.profession2];
  const hasEngineering = professions.includes(Profession.Engineering);
  const hasPet = [
    Class.ClassHunter,
    Class.ClassWarlock,
    Class.ClassDeathknight,
  ].includes(player.class);
  return (
    <div className="visual-consumes">
      <div className="consume-grid">
        {[
          "flask",
          "battleElixir",
          "guardianElixir",
          "food",
          "prepopPotion",
          "defaultPotion",
          "defaultConjured",
        ].map(field)}
      </div>
      <p className="muted small">
        Choose a flask or a battle and guardian elixir. Food and potions are
        separate.
      </p>
      {(hasEngineering ||
        consumes.thermalSapper ||
        consumes.explosiveDecoy ||
        consumes.fillerExplosive > 0) && (
        <section>
          <h4>Engineering</h4>
          <div className="consume-grid">
            {["thermalSapper", "explosiveDecoy", "fillerExplosive"].map(field)}
          </div>
        </section>
      )}
      {(hasPet ||
        consumes.petFood > 0 ||
        consumes.petScrollOfAgility > 0 ||
        consumes.petScrollOfStrength > 0) && (
        <details className="buff-group">
          <summary>Pet consumables</summary>
          <div className="consume-grid">
            {["petFood", "petScrollOfAgility", "petScrollOfStrength"].map(
              field,
            )}
          </div>
        </details>
      )}
    </div>
  );
}
export function GlyphControls({ snapshot, onPatch }: Props) {
  const glyphs = snapshot.settings.player?.glyphs;
  const choices = glyphMeta[String(snapshot.settings.player?.class)] ?? {};
  return (
    <div className="visual-glyphs">
      {(["major", "minor"] as const).map((kind) => (
        <section key={kind}>
          <h4>{kind === "major" ? "Major glyphs" : "Minor glyphs"}</h4>
          <div className="glyph-grid">
            {[1, 2, 3].map((n) => {
              const key = `${kind}${n}` as keyof NonNullable<typeof glyphs>;
              const value = glyphs?.[key] ?? 0;
              const item = choices[value];
              return (
                <label className="glyph-control" key={key}>
                  <span className="glyph-slot-label">
                    {kind === "major" ? "Major" : "Minor"} glyph {n}
                  </span>
                  <span className="consume-input">
                    <SettingIcon key={item?.icon ?? key} icon={item?.icon} />
                    <select
                      aria-label={`${kind === "major" ? "Major" : "Minor"} glyph ${n}`}
                      value={value}
                      onChange={(e) =>
                        onPatch({
                          player: { glyphs: { [key]: Number(e.target.value) } },
                        })
                      }
                    >
                      <option value={0}>Empty</option>
                      {value !== 0 && !item && (
                        <option value={value}>Imported glyph {value}</option>
                      )}
                      {Object.entries(choices)
                        .filter(([, g]) => g.kind === kind)
                        .sort((a, b) => a[1].name.localeCompare(b[1].name))
                        .map(([id, g]) => (
                          <option
                            key={id}
                            value={id}
                            disabled={
                              Number(id) !== value &&
                              Object.values(glyphs ?? {}).includes(Number(id))
                            }
                          >
                            {g.name}
                          </option>
                        ))}
                    </select>
                  </span>
                  {item && <small className="muted">{item.description}</small>}
                </label>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
