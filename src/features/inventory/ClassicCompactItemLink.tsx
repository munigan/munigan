"use client";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { getCatalog } from "@/domain/equipment/catalog";
import { matchesSocket } from "@/domain/equipment/sockets";
import { GemColor } from "@/generated/wotlk/common";
import type { ItemInstance } from "@/domain/top-gear/model";
import {
  tooltipSourceUrl,
  type ItemTooltipResponse,
  type TooltipLine,
  type TooltipVersion,
} from "@/domain/tooltips/contracts";
import original from "../../../data/wotlk/original-items.json";
import { statLines } from "./stat-labels";
import { claimOwnedTooltip, releaseOwnedTooltip } from "./active-tooltip";
import { enchantDescription } from "./enhancements/enchant-description";
import { fitItemTooltip } from "./tooltip-viewport";
import { loadItemTooltip, peekItemTooltip } from "./tooltip-client";
import { useTooltipLoading, Skeleton } from "./tooltip-loading";

const socketColors = {
  red: GemColor.GemColorRed,
  yellow: GemColor.GemColorYellow,
  blue: GemColor.GemColorBlue,
  meta: GemColor.GemColorMeta,
  prismatic: GemColor.GemColorPrismatic,
};
function Icon({ icon, size = 16 }: { icon?: string | null; size?: number }) {
  return icon ? (
    <Image
      unoptimized
      src={`https://wow.zamimg.com/images/wow/icons/large/${icon}.jpg`}
      alt=""
      width={size}
      height={size}
      className="compact-tooltip-icon"
    />
  ) : (
    <span
      className="compact-tooltip-empty-icon"
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}
export function ClassicCompactItemLink({
  item,
  version,
  tooltipOnly = false,
  children,
  ...props
}: {
  item: ItemInstance;
  version: TooltipVersion;
  tooltipOnly?: boolean;
} & ComponentProps<"a">) {
  const t = useTranslations("inventory"),
    locale = useLocale(),
    id = useId();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{
    key: string;
    data?: ItemTooltipResponse;
    failed?: boolean;
  }>();
  const key = `${version}/${item.itemId}`;
  const data =
    (result?.key === key ? result.data : undefined) ??
    peekItemTooltip(version, item.itemId);
  const details = data?.item;
  const anchor = useRef<HTMLAnchorElement>(null),
    tooltip = useRef<HTMLSpanElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const openTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const touch = useRef(false),
    hovered = useRef(false);
  const catalog = getCatalog(version);
  const gear = catalog.items.get(item.itemId),
    gem = catalog.gems.get(item.itemId);
  const statsItem = gear ?? gem,
    meta = statsItem ?? catalog.icons?.get(item.itemId);
  const unsupported = catalog.unsupportedItemIds?.has(item.itemId);
  const localGemComplete = !!gem && gem.color !== GemColor.GemColorMeta;
  const failed = result?.key === key && result.failed;
  const loading = useTooltipLoading(
    open ? key : null,
    !details && !failed && !localGemComplete,
  );

  const enchants = catalog.enchants.get(item.enchantId);
  const enchant =
    enchants?.find(
      (e) => e.type === gear?.type || e.extraTypes.includes(gear?.type ?? 0),
    ) ?? enchants?.[0];
  const baseSockets =
    details?.sockets.map((color) => socketColors[color]) ??
    gear?.gemSockets ??
    [];
  // Only populated extra sockets prove an enhancement exists; zero export padding
  // must never append slots. Existing base slots keep their exact original index.
  const socketCount = Math.max(
    baseSockets.length,
    item.gemIds.findLastIndex(Boolean) + 1,
  );
  const bonusActive =
    baseSockets.length > 0 &&
    baseSockets.every((color, index) =>
      matchesSocket(catalog.gems.get(item.gemIds[index])?.color, color),
    );
  const bonus = details?.socketBonus
    ? t("item.socketBonus", {
        stats: details.socketBonus.replace(/^Socket Bonus:\s*/i, ""),
      })
    : gear?.socketBonus.some(Boolean)
      ? t("item.socketBonus", {
          stats: statLines(gear.socketBonus, t, locale).join(", "),
        })
      : null;
  function sourceLines(lines: TooltipLine[]) {
    return lines.map((line, index) => (
      <span className="compact-tooltip-line" data-kind={line.kind} key={index}>
        <span>{line.text}</span>
        {line.rightText && <span>{line.rightText}</span>}
      </span>
    ));
  }
  const lineGroups: TooltipLine["kind"][][] = [
    ["binding", "slot"],
    ["weapon"],
    ["stat"],
    ["effect"],
    ["set"],
    ["description", "flavor"],
  ];
  const effects =
    version === "original"
      ? ((original as { effects?: Record<string, string[]> }).effects?.[
          item.itemId
        ] ?? [])
      : [];
  function cancelClose() {
    clearTimeout(closeTimer.current);
  }
  function cancelOpen() {
    clearTimeout(openTimer.current);
    openTimer.current = undefined;
  }
  function show() {
    cancelOpen();
    claimOwnedTooltip(id, hide);
    cancelClose();
    if (!open) setResult((current) => (current?.failed ? undefined : current));
    setOpen(true);
  }
  function hide() {
    cancelOpen();
    releaseOwnedTooltip(id);
    cancelClose();
    setOpen(false);
  }
  function scheduleClose() {
    cancelOpen();
    cancelClose();
    closeTimer.current = setTimeout(() => {
      if (
        !hovered.current &&
        !anchor.current?.parentElement?.contains(document.activeElement)
      )
        setOpen(false);
    }, 150);
  }
  useEffect(
    () => () => {
      clearTimeout(closeTimer.current);
      clearTimeout(openTimer.current);
      releaseOwnedTooltip(id);
    },
    [id],
  );
  useEffect(() => () => clearTimeout(openTimer.current), [key]);
  useEffect(() => {
    if (!open) return;
    let active = true;
    loadItemTooltip(version, item.itemId).then(
      (data) => {
        if (active) setResult({ key, data });
      },
      () => {
        if (active) setResult({ key, failed: true });
      },
    );
    return () => {
      active = false;
    };
  }, [open, version, item.itemId, key]);
  useLayoutEffect(() => {
    const node = tooltip.current,
      link = anchor.current;
    if (!open || !node || !link) return;
    if (node.showPopover) {
      node.setAttribute("popover", "manual");
      node.showPopover();
    }
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      clearTimeout(closeTimer.current);
      setOpen(false);
    };
    window.addEventListener("keydown", dismiss, true);
    const reposition = (event?: Event) => {
      if (
        event?.type === "scroll" &&
        !(event.target instanceof Node && node.contains(event.target))
      ) {
        const bounds = link.getBoundingClientRect();
        const viewport = window.visualViewport;
        const top = viewport?.offsetTop ?? 0;
        const left = viewport?.offsetLeft ?? 0;
        if (
          bounds.bottom <= top ||
          bounds.top >= top + (viewport?.height ?? innerHeight) ||
          bounds.right <= left ||
          bounds.left >= left + (viewport?.width ?? innerWidth)
        ) {
          hovered.current = false;
          setOpen(false);
          return;
        }
      }
      fitItemTooltip(node, link);
    };
    reposition();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => reposition());
    observer?.observe(node);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    window.visualViewport?.addEventListener("resize", reposition);
    window.visualViewport?.addEventListener("scroll", reposition);
    return () => {
      releaseOwnedTooltip(id);
      window.removeEventListener("keydown", dismiss, true);
      node.hidePopover?.();
      observer?.disconnect();
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      window.visualViewport?.removeEventListener("resize", reposition);
      window.visualViewport?.removeEventListener("scroll", reposition);
    };
  }, [open, id]);
  return (
    <span
      className="item-tooltip-trigger"
      onMouseEnter={() => {
        if (!touch.current) {
          hovered.current = true;
          cancelClose();
          if (!open) {
            cancelOpen();
            openTimer.current = setTimeout(show, 250);
          }
        }
      }}
      onMouseLeave={() => {
        hovered.current = false;
        scheduleClose();
      }}
      onFocus={() => {
        if (!touch.current) show();
      }}
      onBlur={scheduleClose}
      onKeyDownCapture={(event) => {
        if (
          event.key === "Escape" &&
          (open || openTimer.current !== undefined)
        ) {
          event.preventDefault();
          event.stopPropagation();
          hide();
        }
      }}
    >
      <a
        {...props}
        ref={anchor}
        href={tooltipSourceUrl(version, item.itemId)}
        target="_blank"
        rel="noreferrer"
        data-item-version={version}
        data-item-id={item.itemId}
        data-item-enhancements={`ench=${item.enchantId}&gems=${item.gemIds.join(":")}`}
        aria-describedby={
          [props["aria-describedby"], open ? id : undefined]
            .filter(Boolean)
            .join(" ") || undefined
        }
        role={tooltipOnly ? "img" : props.role}
        tabIndex={tooltipOnly ? 0 : props.tabIndex}
        draggable={tooltipOnly ? false : props.draggable}
        onPointerDown={(event) => {
          touch.current = event.pointerType === "touch";
          props.onPointerDown?.(event);
        }}
        onClick={(event) => {
          if (props.onClick && !tooltipOnly) {
            hovered.current = false;
            hide();
          }
          props.onClick?.(event);
          if (tooltipOnly || (touch.current && !props.onClick)) {
            event.preventDefault();
            show();
          }
          touch.current = false;
        }}
        onAuxClick={(event) => {
          if (tooltipOnly) event.preventDefault();
          props.onAuxClick?.(event);
        }}
        onContextMenu={(event) => {
          if (tooltipOnly) event.preventDefault();
          props.onContextMenu?.(event);
        }}
      >
        {children}
      </a>
      {open && (
        <span
          ref={tooltip}
          id={id}
          role="tooltip"
          onClick={(event) => event.stopPropagation()}
          className="classic-compact-tooltip"
          data-gem={!!gem}
        >
          <span className="compact-tooltip-header">
            <Icon icon={meta?.icon ?? details?.icon} size={gem ? 32 : 36} />
            <span className="compact-tooltip-title">
              <strong data-quality={details?.quality ?? statsItem?.quality}>
                {details?.name ??
                  meta?.name ??
                  t("item.id", { id: item.itemId })}
              </strong>
              <span className="compact-tooltip-muted">
                {details?.heroic && <>{t("tooltip.heroic")} · </>}
                {(details?.itemLevel ?? gear?.ilvl)
                  ? t("item.level", { level: details?.itemLevel ?? gear!.ilvl })
                  : gem
                    ? t("tooltip.gem")
                    : null}
              </span>
            </span>
            <button
              type="button"
              className="compact-tooltip-close"
              aria-label={t("tooltip.close")}
              onClick={hide}
            >
              ×
            </button>
          </span>
          {unsupported && (
            <span className="compact-tooltip-section compact-tooltip-muted">
              {t("item.unsupported")}
            </span>
          )}
          <span
            className="compact-tooltip-details"
            data-reveal={!!details && loading.reveal}
          >
            {details
              ? lineGroups.map((kinds) => {
                  const lines = details.lines.filter((line) =>
                    kinds.includes(line.kind),
                  );
                  return (
                    lines.length > 0 && (
                      <span
                        className="compact-tooltip-section"
                        data-section={kinds[0]}
                        key={kinds[0]}
                      >
                        {kinds[0] === "set" && (
                          <span className="compact-tooltip-muted">
                            {t("tooltip.setInfo")}
                          </span>
                        )}
                        {sourceLines(lines)}
                      </span>
                    )
                  );
                })
              : !unsupported && (
                  <>
                    {!!gear?.weaponSpeed && (
                      <span className="compact-tooltip-section">
                        {t("item.weaponStats", {
                          min: gear.weaponDamageMin.toLocaleString(locale),
                          max: gear.weaponDamageMax.toLocaleString(locale),
                          speed: gear.weaponSpeed.toLocaleString(locale, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }),
                        })}
                      </span>
                    )}
                    {statsItem && (
                      <span className="compact-tooltip-section">
                        {statLines(statsItem.stats, t, locale).map((line) => (
                          <span className="compact-tooltip-line" key={line}>
                            {line}
                          </span>
                        ))}
                      </span>
                    )}
                    {effects.length > 0 && (
                      <span className="compact-tooltip-section">
                        {effects.map((effect) => (
                          <span
                            className="compact-tooltip-line"
                            data-kind="effect"
                            key={effect}
                          >
                            {effect}
                          </span>
                        ))}
                      </span>
                    )}
                  </>
                )}
          </span>
          {loading.visible && !statsItem && (
            <span className="compact-tooltip-loading">
              {["100%", "92%", "96%", "63%"].map((width) => (
                <Skeleton key={width} width={width} />
              ))}
            </span>
          )}
          {!!item.enchantId && (
            <span
              className="compact-tooltip-section compact-tooltip-attachment"
              data-kind="effect"
            >
              <Icon icon={enchant?.icon} />
              <span>
                {enchant?.name ?? t("item.enchantId", { id: item.enchantId })}
                {enchant && (
                  <span className="compact-tooltip-line">
                    {enchantDescription(enchant, t, locale)}
                  </span>
                )}
              </span>
            </span>
          )}
          {socketCount > 0 && (
            <span className="compact-tooltip-section">
              <span className="compact-tooltip-label">
                {t("tooltip.sockets")}
              </span>
              {Array.from({ length: socketCount }, (_, index) => {
                const id = item.gemIds[index] ?? 0,
                  gem = catalog.gems.get(id);
                const color = GemColor[
                  baseSockets[index] ?? GemColor.GemColorPrismatic
                ].replace("GemColor", "");
                return (
                  <span
                    className="compact-tooltip-attachment"
                    data-socket-index={index}
                    data-socket-color={color.toLowerCase()}
                    key={index}
                  >
                    <Icon icon={gem?.icon} />
                    <span>
                      {id
                        ? (gem?.name ?? t("item.gemId", { id }))
                        : t("item.emptySocket")}
                      <span className="compact-tooltip-muted">
                        {gem
                          ? statLines(gem.stats, t, locale).join(", ")
                          : t(`editor.colors.${color}`)}
                      </span>
                    </span>
                  </span>
                );
              })}
            </span>
          )}
          {bonus && (
            <span
              className="compact-tooltip-line compact-tooltip-bonus"
              data-socket-bonus
              data-active={bonusActive}
            >
              {bonus} · {t(bonusActive ? "tooltip.active" : "tooltip.inactive")}
            </span>
          )}
          <span className="compact-tooltip-footer">
            <span
              role="status"
              className="compact-tooltip-loading-status compact-tooltip-muted"
            >
              {loading.visible && (
                <>
                  <span
                    className="compact-tooltip-loading-dot"
                    aria-hidden="true"
                  />
                  {t(statsItem ? "tooltip.fetchingDetails" : "tooltip.loading")}
                </>
              )}
            </span>
            {details &&
              sourceLines(
                details.lines.filter(
                  (line) =>
                    line.kind === "requirement" || line.kind === "durability",
                ),
              )}
            <span>
              {t(`tooltip.${version}`)} ·{" "}
              {version === "classic" ? "Wowhead" : "Cavern of Time"}
            </span>
            <span className="compact-tooltip-muted">
              {t("item.id", { id: item.itemId })}
            </span>
            {!details && failed && !localGemComplete && (
              <span className="compact-tooltip-muted" role="status">
                {t("tooltip.unavailable")}
              </span>
            )}
            {!tooltipOnly && (
              <a
                href={tooltipSourceUrl(version, item.itemId)}
                target="_blank"
                rel="noreferrer"
              >
                {t("item.fullDetails")}
              </a>
            )}
          </span>
        </span>
      )}
    </span>
  );
}
