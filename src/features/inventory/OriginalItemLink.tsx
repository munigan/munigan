"use client";
import { useEffect, useId, useRef, type ComponentProps } from "react";
import Image from "next/image";
import type { ItemInstance } from "@/domain/top-gear/model";
import { getCatalog } from "@/domain/equipment/catalog";
import { Stat } from "@/generated/wotlk/common";
import original from "../../../data/wotlk/original-items.json";
import { fitItemTooltip } from "./tooltip-viewport";

function TooltipIcon({ icon, size = 18 }: { icon?: string; size?: number }) {
  return icon ? (
    <Image
      unoptimized
      src={`https://wow.zamimg.com/images/wow/icons/large/${icon}.jpg`}
      alt=""
      width={size}
      height={size}
      className="original-tooltip-icon"
    />
  ) : (
    <span className="original-tooltip-empty-icon" aria-hidden="true" />
  );
}

// The simulator stores shared ratings twice, for melee and spell calculations.
function statLines(stats: number[]) {
  const duplicateOf: Record<number, number> = {
    [Stat.StatSpellCrit]: Stat.StatMeleeCrit,
    [Stat.StatSpellHit]: Stat.StatMeleeHit,
    [Stat.StatSpellHaste]: Stat.StatMeleeHaste,
    [Stat.StatRangedAttackPower]: Stat.StatAttackPower,
  };
  return stats.flatMap((value, index) => {
    if (!value || (index in duplicateOf && stats[duplicateOf[index]] === value))
      return [];
    const name = (Stat[index] ?? `Stat ${index}`)
      .replace(/^Stat/, "")
      .replace(/^Melee/, "")
      .replace(/([a-z])([A-Z])/g, "$1 $2");
    return [`+${value.toLocaleString()} ${name}`];
  });
}

export function OriginalItemLink({
  item,
  tooltipOnly = false,
  children,
  ...props
}: {
  item: ItemInstance;
  tooltipOnly?: boolean;
} & ComponentProps<"a">) {
  const id = useId();
  const tooltip = useRef<HTMLSpanElement>(null);
  const anchor = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const reposition = () => {
      if (tooltip.current?.matches(":popover-open") && anchor.current)
        fitItemTooltip(tooltip.current, anchor.current);
    };
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(reposition);
    if (tooltip.current) observer?.observe(tooltip.current);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    window.visualViewport?.addEventListener("resize", reposition);
    window.visualViewport?.addEventListener("scroll", reposition);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      window.visualViewport?.removeEventListener("resize", reposition);
      window.visualViewport?.removeEventListener("scroll", reposition);
    };
  }, []);
  const catalog = getCatalog("original");
  const statsItem =
    catalog.items.get(item.itemId) ?? catalog.gems.get(item.itemId);
  const meta = statsItem ?? catalog.icons?.get(item.itemId);
  const gear = catalog.items.get(item.itemId);
  const enchants = catalog.enchants.get(item.enchantId);
  const enchant =
    enchants?.find(
      (e) => e.type === gear?.type || e.extraTypes.includes(gear?.type ?? 0),
    ) ?? enchants?.[0];
  const effects =
    (original as { effects?: Record<string, string[]> }).effects?.[
      item.itemId
    ] ?? [];
  const unsupported = catalog.unsupportedItemIds?.has(item.itemId);
  function hide() {
    if (tooltip.current?.matches(":popover-open"))
      tooltip.current.hidePopover();
  }
  function show() {
    const node = tooltip.current,
      link = anchor.current;
    if (!node || !link || !node.showPopover) return;
    if (!node.matches(":popover-open")) node.showPopover();
    fitItemTooltip(node, link);
  }
  return (
    <span
      className="original-item-trigger"
      onMouseEnter={show}
      onMouseLeave={(event) => {
        if (!event.currentTarget.contains(document.activeElement)) hide();
      }}
      onFocus={show}
      onBlur={hide}
      onKeyDown={(event) => {
        if (
          event.key === "Escape" &&
          tooltip.current?.matches(":popover-open")
        ) {
          event.preventDefault();
          hide();
          event.stopPropagation();
        }
      }}
    >
      <a
        {...props}
        ref={anchor}
        href={`https://wotlk.cavernoftime.com/item=${item.itemId}`}
        target="_blank"
        rel="noreferrer"
        data-item-version="original"
        aria-describedby={[props["aria-describedby"], id]
          .filter(Boolean)
          .join(" ")}
        role={tooltipOnly ? "img" : props.role}
        tabIndex={tooltipOnly ? 0 : props.tabIndex}
        draggable={tooltipOnly ? false : props.draggable}
        onClick={
          tooltipOnly ? (event) => event.preventDefault() : props.onClick
        }
        onAuxClick={
          tooltipOnly ? (event) => event.preventDefault() : props.onAuxClick
        }
        onContextMenu={
          tooltipOnly ? (event) => event.preventDefault() : props.onContextMenu
        }
      >
        {children}
      </a>
      <span
        ref={tooltip}
        id={id}
        role="tooltip"
        popover="manual"
        className="original-item-tooltip"
      >
        <strong className="item-name" data-quality={statsItem?.quality}>
          {meta?.name ?? `Item ${item.itemId}`}
        </strong>
        {gear && !unsupported && (
          <span className="original-item-level">Item Level {gear.ilvl}</span>
        )}
        {unsupported ? (
          <span>Not supported for simulation with this item version.</span>
        ) : (
          <>
            {!!gear?.weaponSpeed && (
              <span>
                {gear.weaponDamageMin}–{gear.weaponDamageMax} damage ·{" "}
                {gear.weaponSpeed.toFixed(2)} speed
              </span>
            )}
            {statsItem &&
              statLines(statsItem.stats).map((line) => (
                <span key={line}>{line}</span>
              ))}
            {effects.map((effect) => (
              <span className="original-item-effect" key={effect}>
                {effect}
              </span>
            ))}
          </>
        )}
        {!!item.enchantId && (
          <span className="original-item-enchant original-tooltip-attachment">
            <TooltipIcon icon={enchant?.icon} />
            <span>
              {enchant?.name ?? `Enchant ${item.enchantId}`}
              {!!enchant?.stats.some(Boolean) && (
                <small>{statLines(enchant.stats).join(", ")}</small>
              )}
            </span>
          </span>
        )}
        {item.gemIds.map((gem, index) => (
          <span
            className="original-item-enhancement original-tooltip-attachment"
            key={index}
          >
            <TooltipIcon icon={catalog.gems.get(gem)?.icon} />
            <span>
              {gem
                ? (catalog.gems.get(gem)?.name ?? `Gem ${gem}`)
                : "Empty socket"}
            </span>
          </span>
        ))}
        {!!gear?.socketBonus.some(Boolean) && (
          <span className="original-item-socket-bonus">
            Socket bonus: {statLines(gear.socketBonus).join(", ")}
          </span>
        )}
        <small className="original-item-profile">
          Original WotLK 3.3.5a · Stats preview
        </small>
        <small>
          Item {item.itemId} ·{" "}
          {tooltipOnly
            ? "Excluded from simulation"
            : "Click for full item details"}
        </small>
      </span>
    </span>
  );
}
