"use client";
import { useState } from "react";
import type { TopGearRequest, Slot } from "@/domain/top-gear/model";
import { slots, slotNames } from "@/domain/top-gear/slots";
import { getCatalog } from "@/domain/equipment/catalog";
import {
  eligibleSlots,
  canEquip,
  validateItem,
} from "@/domain/equipment/validate";
import { ItemIcon, ItemName, ItemDetails, ItemLink } from "./Item";
export function InventorySelector({
  request,
  onChange,
}: {
  request: TopGearRequest;
  onChange: (r: TopGearRequest) => void;
}) {
  const [filter, setFilter] = useState("All slots"),
    [expanded, setExpanded] = useState(false),
    [selectedOnly, setSelectedOnly] = useState(false);
  const { snapshot, selection } = request,
    catalog = getCatalog(snapshot.itemVersion);
  const valid = snapshot.inventory.filter(
      (i) => !validateItem(snapshot, i).length,
    ),
    unsupported = snapshot.inventory.filter(
      (i) => i.source === "bag" && validateItem(snapshot, i).length,
    );
  const groupSlots = slots.filter(
    (s) => s !== "finger2" && s !== "trinket2" && s !== "offHand",
  );
  const group = (s: Slot) =>
    s === "finger1"
      ? (["finger1", "finger2"] as Slot[])
      : s === "trinket1"
        ? (["trinket1", "trinket2"] as Slot[])
        : s === "mainHand"
          ? (["mainHand", "offHand"] as Slot[])
          : [s];
  const items = (s: Slot) =>
    valid.filter((i) =>
      group(s).some((slot) =>
        canEquip(snapshot, catalog.items.get(i.itemId)!, slot),
      ),
    );
  const changeIds = (ids: string[]) => {
    const locked = Object.fromEntries(
      Object.entries(selection.lockedSlots).filter(
        ([, v]) => v === null || ids.includes(v!),
      ),
    );
    onChange({
      ...request,
      selection: {
        ...selection,
        selectedInstanceIds: ids,
        lockedSlots: locked,
      },
    });
  };
  function toggle(id: string) {
    changeIds(
      selection.selectedInstanceIds.includes(id)
        ? selection.selectedInstanceIds.filter((i) => i !== id)
        : [...selection.selectedInstanceIds, id],
    );
  }
  const needsChoice = (s: Slot) => items(s).some((i) => i.source === "bag");
  const shown = groupSlots.filter((s) =>
    filter === "Armor"
      ? slots.indexOf(s) < 10
      : filter === "Weapons"
        ? slots.indexOf(s) >= 14
        : filter === "Rings & trinkets"
          ? s === "finger1" || s === "trinket1"
          : true,
  );
  return (
    <section className="inventory">
      <div className="section-top">
        <h2>
          Your equipment{" "}
          <span className="muted small">
            {selection.selectedInstanceIds.length} / {valid.length} selected
          </span>
        </h2>
        <div className="text-actions">
          <button
            onClick={() =>
              changeIds(
                valid
                  .filter((i) => i.source === "equipped")
                  .map((i) => i.instanceId),
              )
            }
          >
            Equipped only
          </button>
          <button onClick={() => changeIds(valid.map((i) => i.instanceId))}>
            Select all
          </button>
        </div>
      </div>
      <div className="filter-bar">
        <div className="segmented">
          {["All slots", "Armor", "Weapons", "Rings & trinkets"].map((f) => (
            <button
              key={f}
              aria-pressed={filter === f}
              onClick={() => {
                setFilter(f);
                if (f !== "All slots") setExpanded(true);
              }}
            >
              {f}
            </button>
          ))}
        </div>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={selectedOnly}
            onChange={(e) => setSelectedOnly(e.target.checked)}
          />{" "}
          Selected only
        </label>
      </div>
      {unsupported.length > 0 && (
        <details className="unsupported-bag">
          <summary>
            {unsupported.length} unsupported bag{" "}
            {unsupported.length === 1 ? "item" : "items"}
          </summary>
          <ul className="bag-grid" aria-label="Unsupported bag items">
            {unsupported.map((item) => {
              const metadata =
                catalog.items.get(item.itemId) ??
                catalog.gems.get(item.itemId) ??
                catalog.icons?.get(item.itemId);
              return (
                <li key={item.instanceId}>
                  <ItemLink
                    item={item}
                    tooltipOnly
                    className="bag-item"
                    data-wh-icon-size={!metadata?.icon ? "medium" : undefined}
                    aria-label={`${metadata?.name ?? `Item ${item.itemId}`} · Unsupported`}
                    aria-describedby={`reason-${item.instanceId}`}
                  >
                    <span className="bag-icon-fallback">
                      <ItemIcon itemId={item.itemId} size={44} />
                    </span>
                  </ItemLink>
                  <span className="sr-only" id={`reason-${item.instanceId}`}>
                    {validateItem(snapshot, item)[0].message}
                  </span>
                </li>
              );
            })}
          </ul>
        </details>
      )}
      {shown
        .filter((s) => expanded || needsChoice(s))
        .map((s) => {
          const all = items(s),
            values = selectedOnly
              ? all.filter((i) =>
                  selection.selectedInstanceIds.includes(i.instanceId),
                )
              : all;
          return (
            <section key={s} className="slot-group">
              <div className="section-top">
                <h3>
                  {s === "finger1"
                    ? "Rings"
                    : s === "trinket1"
                      ? "Trinkets"
                      : s === "mainHand"
                        ? "Weapons"
                        : slotNames[s]}{" "}
                  <span className="muted small">
                    {
                      all.filter((i) =>
                        selection.selectedInstanceIds.includes(i.instanceId),
                      ).length
                    }{" "}
                    selected
                  </span>
                </h3>
                <button
                  className="text-button"
                  onClick={() =>
                    changeIds(
                      selection.selectedInstanceIds.filter(
                        (id) => !all.some((i) => i.instanceId === id),
                      ),
                    )
                  }
                >
                  Clear slot
                </button>
              </div>
              {values.length === 0 ? (
                <p className="empty-slot">
                  {all.length
                    ? "No selected items"
                    : "Empty slot · no owned items"}
                </p>
              ) : (
                values.map((item, index) => (
                  <div className="inventory-row" key={item.instanceId}>
                    <div className="item-choice">
                      <input
                        type="checkbox"
                        checked={selection.selectedInstanceIds.includes(
                          item.instanceId,
                        )}
                        onChange={() => toggle(item.instanceId)}
                        aria-label={`Select ${catalog.items.get(item.itemId)!.name}, ${item.source}, copy ${index + 1}`}
                      />
                      <ItemLink item={item} className="item-tooltip-link">
                        <ItemIcon itemId={item.itemId} />
                        <span>
                          <ItemName item={item} />
                          <small className="item-enhancements">
                            {item.enchantId ? "Enchanted" : "No enchant"}
                            {item.gemIds.length
                              ? ` · ${item.gemIds.filter(Boolean).length}/${item.gemIds.length} gems`
                              : ""}
                          </small>
                        </span>
                      </ItemLink>
                    </div>
                    <span className="item-level">
                      {catalog.items.get(item.itemId)!.ilvl}
                    </span>
                    <span className="item-source">
                      {item.source === "equipped" ? "Equipped" : "Bags"}
                    </span>
                    <ItemDetails item={item} />
                  </div>
                ))
              )}
              {all.length > 0 && (
                <details className="locks">
                  <summary>
                    Slot locks{" "}
                    {group(s).some((slot) =>
                      Object.hasOwn(selection.lockedSlots, slot),
                    )
                      ? "· Active"
                      : ""}
                  </summary>
                  <div className="lock-controls">
                    {group(s).map((slot) => (
                      <label key={slot}>
                        {slotNames[slot]}
                        <select
                          value={
                            Object.hasOwn(selection.lockedSlots, slot)
                              ? (selection.lockedSlots[slot] ?? "empty")
                              : "unlocked"
                          }
                          onChange={(e) => {
                            const lockedSlots = { ...selection.lockedSlots };
                            if (e.target.value === "unlocked")
                              delete lockedSlots[slot];
                            else
                              lockedSlots[slot] =
                                e.target.value === "empty"
                                  ? null
                                  : e.target.value;
                            onChange({
                              ...request,
                              selection: { ...selection, lockedSlots },
                            });
                          }}
                        >
                          <option value="unlocked">Unlocked</option>
                          {(snapshot.equipped[slot] === null ||
                            slot === "offHand") && (
                            <option value="empty">Lock empty</option>
                          )}
                          {all
                            .filter(
                              (i) =>
                                selection.selectedInstanceIds.includes(
                                  i.instanceId,
                                ) &&
                                eligibleSlots(
                                  catalog.items.get(i.itemId)!,
                                ).includes(slot),
                            )
                            .map((i, n) => (
                              <option key={i.instanceId} value={i.instanceId}>
                                {catalog.items.get(i.itemId)!.name} · {i.source}{" "}
                                · copy {n + 1}
                              </option>
                            ))}
                        </select>
                      </label>
                    ))}
                  </div>
                </details>
              )}
            </section>
          );
        })}
      {filter === "All slots" && (
        <button className="expand-slots" onClick={() => setExpanded(!expanded)}>
          {expanded
            ? "Collapse unchanged slots −"
            : `Other slots · ${shown.filter((s) => !needsChoice(s)).length} groups — Expand all +`}
        </button>
      )}
    </section>
  );
}
