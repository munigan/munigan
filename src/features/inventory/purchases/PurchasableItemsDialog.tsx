"use client";
import { useRef, useState } from "react";
import { ItemEnhancementEditor } from "../enhancements/ItemEnhancementEditor";
import { setPurchaseEnhancements } from "@/domain/purchases/enhancements";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import {
  DialogContent,
  DialogDescription,
  DialogDismiss,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/Dialog";
import type { TopGearRequest } from "@/domain/top-gear/model";
import type {
  PurchaseRecipe,
  ResourceAmounts,
  ResourceId,
} from "@/domain/purchases/model";
import {
  getPurchaseCatalog,
  tokenFamilyForClass,
} from "@/domain/purchases/catalog";
import { setPurchaseExcluded } from "@/domain/purchases/state";
import { itemVersionOf } from "@/domain/top-gear/item-version";
import { getCatalog } from "@/domain/equipment/catalog";
import { ItemIcon, ItemName } from "../Item";
import type { PurchasePreview } from "./purchase-worker-contract";
import { optionForResource } from "./resource-labels";
import { orderPurchaseVariants } from "./presentation";
import "./purchases.css";
export function PurchasableItemsDialog({
  request,
  preview,
  open,
  onOpenChange,
  onChange,
}: {
  request: TopGearRequest;
  preview: PurchasePreview | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (request: TopGearRequest) => void;
}) {
  const t = useTranslations("inventory.purchases");
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [editing, setEditing] = useState<number | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const editedItem = preview?.snapshot.inventory.find(
    (item) => item.source === "purchase" && item.itemId === editing,
  );
  const profile = itemVersionOf(request.snapshot);
  const catalog = getPurchaseCatalog(profile);
  const equipment = getCatalog(profile);
  const family = tokenFamilyForClass(request.snapshot.settings.player!.class);
  const orderedCandidates = orderPurchaseVariants(
    preview?.candidates ?? [],
    (candidate) => catalog.byItemId.get(candidate.instance.itemId),
    request.snapshot.specId,
    request.snapshot.settings.player!.class,
  );
  const changeOpen = onOpenChange;
  const name = (id: number) => equipment.items.get(id)?.name ?? String(id);
  const resourceName = (id: ResourceId) => {
    const option = optionForResource(id, family);
    return option
      ? t(option.labelKey, { family: t(`families.${family}`) })
      : id;
  };
  function fullChain(recipe: PurchaseRecipe): PurchaseRecipe[] {
    const previous =
      recipe.prerequisiteItemId &&
      catalog.byItemId.get(recipe.prerequisiteItemId);
    return [...(previous ? fullChain(previous) : []), recipe];
  }
  const cost = (amounts: ResourceAmounts) =>
    Object.entries(amounts)
      .filter(([, amount]) => amount > 0)
      .map(([id, amount]) => `${amount} ${resourceName(id as ResourceId)}`)
      .join(" + ");
  return (
    <DialogRoot open={open} onOpenChange={changeOpen}>
      {open && (
        <DialogContent className="resource-dialog purchase-review-dialog max-w-[70rem] overflow-hidden p-0 sm:p-0 max-sm:w-full max-sm:max-h-dvh max-sm:rounded-none max-sm:border-0">
          <div className="resource-dialog-viewport">
            <header className="resource-dialog-header">
              <div>
                <DialogTitle className="resource-dialog-title">
                  {t("reviewTitle")}
                </DialogTitle>
                <DialogDescription className="resource-dialog-description">
                  {t("reviewHelp")}
                </DialogDescription>
              </div>
              <DialogDismiss />
            </header>
            <div className="resource-dialog-body purchase-review-body">
              <p className="purchase-balances">
                {cost(request.purchases?.balances ?? {})}
              </p>
              {!preview ? (
                <p role="status">{t("reviewPending")}</p>
              ) : (
                [251, 264, 277, 232, 245, 258].map((level) => {
                  const candidates = orderedCandidates.filter(
                    (c) =>
                      catalog.byItemId.get(c.instance.itemId)?.itemLevel ===
                      level,
                  );
                  if (!candidates.length) return null;
                  return (
                    <details
                      className="purchase-review-group"
                      key={level}
                      open={expanded[level] ?? false}
                      onToggle={(event) => {
                        const next = event.currentTarget.open;
                        setExpanded((previous) =>
                          previous[level] === next
                            ? previous
                            : { ...previous, [level]: next },
                        );
                      }}
                    >
                      <summary>
                        <strong>
                          {t("tierValue", {
                            tier: level < 250 || level === 258 ? 9 : 10,
                          })}{" "}
                          · {level}
                        </strong>
                        <span>
                          {t("availableIncludedCount", {
                            count: candidates.filter(
                              (c) => c.included && c.available,
                            ).length,
                          })}
                        </span>
                      </summary>
                      {candidates.map((candidate) => {
                        const { itemId } = candidate.instance;
                        const recipe = catalog.byItemId.get(itemId)!;
                        const included =
                          !request.purchases?.excludedItemIds[
                            profile
                          ]?.includes(itemId);
                        return (
                          <article
                            className="purchase-review-item"
                            data-purchase-id={itemId}
                            key={itemId}
                          >
                            <div className="purchase-review-item-heading">
                              <ItemIcon item={candidate.instance} />
                              <div>
                                <ItemName item={candidate.instance} />
                                <p>
                                  {level} ·{" "}
                                  {t(
                                    candidate.available
                                      ? "available"
                                      : "unavailable",
                                  )}
                                </p>
                              </div>
                              <label>
                                <input
                                  type="checkbox"
                                  checked={included}
                                  onChange={() =>
                                    onChange(
                                      setPurchaseExcluded(
                                        request,
                                        itemId,
                                        included,
                                      ),
                                    )
                                  }
                                  aria-label={t("includeItem", {
                                    name: name(itemId),
                                    level,
                                  })}
                                />
                                {t(
                                  included
                                    ? candidate.available
                                      ? "included"
                                      : "includeWhenAvailable"
                                    : "excluded",
                                )}
                              </label>
                            </div>
                            <Button
                              className="purchase-enhancement-action"
                              aria-label={t("editEnhancements", {
                                name: name(itemId),
                              })}
                              variant="ghost"
                              onClick={() => {
                                returnFocus.current =
                                  document.activeElement as HTMLElement;
                                setEditing(itemId);
                              }}
                            >
                              {t("editEnhancementsShort")}
                            </Button>
                            <p>
                              {t("directCost", { cost: cost(recipe.cost) })}
                            </p>
                            {recipe.prerequisiteItemId && (
                              <p>
                                {t("requiresExact", {
                                  name: name(recipe.prerequisiteItemId),
                                  itemId: recipe.prerequisiteItemId,
                                })}
                              </p>
                            )}
                            {candidate.paths.map((path, index) => (
                              <div className="purchase-review-path" key={index}>
                                <ol>
                                  {path.steps.map((step) => (
                                    <li key={step.resultId}>
                                      {name(step.itemId)} · {cost(step.cost)}
                                      {step.prerequisite?.instanceId && (
                                        <p>
                                          {t("consumedOwned", {
                                            name: name(
                                              step.prerequisite.itemId,
                                            ),
                                            instanceId:
                                              step.prerequisite.instanceId,
                                          })}
                                        </p>
                                      )}
                                    </li>
                                  ))}
                                </ol>
                                <strong>
                                  {t("totalCost", { cost: cost(path.spent) })}
                                </strong>
                              </div>
                            ))}
                            {!candidate.available &&
                              recipe.prerequisiteItemId && (
                                <div className="purchase-review-path">
                                  <p>{t("fullChain")}</p>
                                  <ol>
                                    {fullChain(recipe).map((step) => (
                                      <li key={step.id}>
                                        {name(step.itemId)} · {cost(step.cost)}
                                      </li>
                                    ))}
                                  </ol>
                                  <strong>
                                    {t("totalCost", {
                                      cost: cost(
                                        fullChain(
                                          recipe,
                                        ).reduce<ResourceAmounts>(
                                          (total, step) => {
                                            for (const [
                                              id,
                                              amount,
                                            ] of Object.entries(step.cost))
                                              total[id as ResourceId] =
                                                (total[id as ResourceId] ?? 0) +
                                                amount;
                                            return total;
                                          },
                                          {},
                                        ),
                                      ),
                                    })}
                                  </strong>
                                </div>
                              )}
                            {!candidate.available && (
                              <p className="purchase-missing">
                                {t("missing", {
                                  amounts: candidate.missing
                                    .map(
                                      (m) =>
                                        `${m.quantity} ${m.resourceId ? resourceName(m.resourceId) : name(m.itemId!)}`,
                                    )
                                    .join(" + "),
                                })}
                              </p>
                            )}
                          </article>
                        );
                      })}
                    </details>
                  );
                })
              )}
              <p className="purchase-review-help">{t("consumedHelp")}</p>
              <p className="purchase-review-help">{t("exclusionHelp")}</p>
            </div>
            <footer className="resource-dialog-footer">
              <Button variant="secondary" onClick={() => changeOpen(false)}>
                {t("done")}
              </Button>
            </footer>
          </div>
        </DialogContent>
      )}
      {open && editedItem && preview && (
        <ItemEnhancementEditor
          key={editedItem.instanceId}
          item={editedItem}
          request={{
            ...request,
            snapshot: preview.snapshot,
            selection: preview.selection,
          }}
          initialField={0}
          onApply={(edited) =>
            onChange(
              setPurchaseEnhancements(
                request,
                editedItem.itemId,
                edited.snapshot.itemEnhancements?.[editedItem.instanceId] ?? {},
              ),
            )
          }
          onClose={() => setEditing(null)}
          returnFocus={returnFocus}
        />
      )}
    </DialogRoot>
  );
}
