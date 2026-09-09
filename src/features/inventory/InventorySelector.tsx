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
import { ItemIcon, ItemName, ItemDetails } from "./Item";
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
                  <ItemIcon
                    item={item}
                    tooltipOnly
                    className="bag-item"
                    data-wh-icon-size={!metadata?.icon ? "medium" : undefined}
                    aria-label={`${metadata?.name ?? `Item ${item.itemId}`} · Unsupported`}
                    aria-describedby={`reason-${item.instanceId}`}
                  />
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
                <div className="slot-actions">
                  {all.length > 0 && (
                    <details
                      className="locks"
                      data-active={group(s).some((slot) =>
                        Object.hasOwn(selection.lockedSlots, slot),
                      )}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          event.currentTarget.open = false;
                          event.currentTarget.querySelector("summary")?.focus();
                        }
                      }}
                    >
                      <summary aria-label={`${slotNames[s]} locks`}>
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          aria-hidden="true"
                        >
                          <rect x="5" y="10" width="14" height="11" rx="2" />
                          <path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3" />
                        </svg>
                        {group(s).some((slot) =>
                          Object.hasOwn(selection.lockedSlots, slot),
                        )
                          ? "Locked"
                          : "Lock"}
                      </summary>
                      <div className="lock-controls">
                        <p>Keep these items in every tested set.</p>
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
                                const lockedSlots = {
                                  ...selection.lockedSlots,
                                };
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
                                  <option
                                    key={i.instanceId}
                                    value={i.instanceId}
                                  >
                                    {catalog.items.get(i.itemId)!.name} ·{" "}
                                    {i.source} · copy {n + 1}
                                  </option>
                                ))}
                            </select>
                          </label>
                        ))}
                      </div>
                    </details>
                  )}{" "}
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
              </div>
              {values.length === 0 ? (
                <div className="empty-slot">
                  <p>
                    {all.length
                      ? "No selected items"
                      : "Empty slot · no owned items"}
                  </p>
                  {all.length > 0 && selectedOnly && (
                    <button
                      className="text-button"
                      onClick={() => setSelectedOnly(false)}
                    >
                      Show available items
                    </button>
                  )}
                </div>
              ) : (
                <div className="slot-items">
                  {values.map((item, index) => (
                    <div
                      className="inventory-row"
                      data-selected={selection.selectedInstanceIds.includes(
                        item.instanceId,
                      )}
                      key={item.instanceId}
                    >
                      <div className="item-choice">
                        <input
                          type="checkbox"
                          checked={selection.selectedInstanceIds.includes(
                            item.instanceId,
                          )}
                          onChange={() => toggle(item.instanceId)}
                          aria-label={`Select ${catalog.items.get(item.itemId)!.name}, ${item.source}, copy ${index + 1}`}
                        />
                        <ItemIcon item={item} className="item-tooltip-link">
                          <span>
                            <ItemName item={item} />
                            <small className="item-enhancements">
                              <span className="item-mobile-meta">
                                <span aria-label="Item level">
                                  {catalog.items.get(item.itemId)!.ilvl}
                                </span>{" "}
                                ·{" "}
                                {item.source === "equipped"
                                  ? "Equipped"
                                  : "Bags"}
                              </span>
                              {item.enchantId ? "Enchanted" : "No enchant"}
                              {item.gemIds.length
                                ? ` · ${item.gemIds.filter(Boolean).length}/${item.gemIds.length} gems`
                                : ""}
                            </small>
                          </span>
                        </ItemIcon>
                      </div>
                      <span className="item-level" aria-label="Item level">
                        {catalog.items.get(item.itemId)!.ilvl}
                      </span>
                      <span className="item-source">
                        {item.source === "equipped" ? "Equipped" : "Bags"}
                      </span>
                      <ItemDetails item={item} />
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      {filter === "All slots" && shown.some((s) => !needsChoice(s)) && (
        <button className="expand-slots" onClick={() => setExpanded(!expanded)}>
          {expanded
            ? "Collapse unchanged slots −"
            : `Other slots · ${shown.filter((s) => !needsChoice(s)).length} groups — Expand all +`}
        </button>
      )}
    </section>
  );
}
