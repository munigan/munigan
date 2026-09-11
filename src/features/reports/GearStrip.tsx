import type { Snapshot, Loadout } from "@/domain/top-gear/model";
import { slots } from "@/domain/top-gear/slots";
import { changedSlots } from "@/domain/top-gear/report";
import { alignPairedSlots } from "@/domain/equipment/enumerate";
import { getCatalog } from "@/domain/equipment/catalog";
import { useTranslations } from "next-intl";
import { ItemIcon } from "@/features/inventory/Item";
export function GearStrip({
  snapshot,
  loadout,
  base,
  changes,
  compact = false,
  changesOnly = false,
}: {
  snapshot: Snapshot;
  loadout: Loadout;
  base: Loadout;
  changes?: ReturnType<typeof changedSlots>;
  compact?: boolean;
  changesOnly?: boolean;
}) {
  const t = useTranslations("reports");
  const aligned = alignPairedSlots(snapshot, loadout, base);
  const changed = changes ?? changedSlots(snapshot, base, aligned);
  const visibleSlots = changesOnly
    ? slots.filter((slot) => changed.includes(slot))
    : slots;
  return (
    <div
      className={compact ? "gear-strip gear-strip-compact" : "gear-strip"}
      aria-label={changesOnly ? t("gearChanges") : t("completeGear")}
    >
      {changesOnly && visibleSlots.length === 0 && (
        <span className="muted text-sm">{t("noChanges")}</span>
      )}
      {visibleSlots.map((slot) => {
        const item = snapshot.inventory.find(
          (i) => i.instanceId === aligned[slot],
        );
        return (
          <div
            key={slot}
            className={
              changed.includes(slot) ? "gear-slot changed" : "gear-slot"
            }
            title={
              item
                ? getCatalog(snapshot.itemVersion).items.get(item.itemId)?.name
                : t("empty")
            }
          >
            <span>{t(`${compact ? "compactSlots" : "slots"}.${slot}`)}</span>
            {item ? (
              <ItemIcon
                item={item}
                size={compact ? 36 : 44}
                onClick={
                  compact ? (event) => event.stopPropagation() : undefined
                }
                aria-label={
                  getCatalog(snapshot.itemVersion).items.get(item.itemId)?.name
                }
              />
            ) : (
              <span className="empty-icon">—</span>
            )}
            {!compact && (
              <small>
                {item
                  ? getCatalog(snapshot.itemVersion).items.get(item.itemId)
                      ?.ilvl
                  : t("empty")}
              </small>
            )}
          </div>
        );
      })}
    </div>
  );
}
