import { useTranslations } from "next-intl";
import type {
  ItemInstance,
  SetRow,
  TopGearReport,
} from "@/domain/top-gear/model";
import type {
  AcquisitionStep,
  ResourceAmounts,
  ResourceId,
  TokenFamily,
} from "@/domain/purchases/model";
import { ItemIcon, ItemLink, ItemName } from "@/features/inventory/Item";
import { optionForResource } from "@/features/inventory/purchases/resource-labels";
import "./purchase-plan.css";

const tokenFamilies = new Set<TokenFamily>([
  "vanquisher",
  "protector",
  "conqueror",
]);

function familyForResource(resourceId: ResourceId): TokenFamily {
  const family = resourceId.split(":").at(-1) as TokenFamily;
  return tokenFamilies.has(family) ? family : "vanquisher";
}

function itemForStep(
  report: TopGearReport,
  step: AcquisitionStep,
): ItemInstance {
  return (
    report.snapshot.inventory.find(
      (item) => item.instanceId === step.resultId,
    ) ??
    report.snapshot.inventory.find(
      (item) => item.source === "purchase" && item.itemId === step.itemId,
    ) ?? {
      instanceId: step.resultId,
      itemId: step.itemId,
      source: "purchase",
      gemIds: [],
      enchantId: 0,
    }
  );
}

export function PurchasePlanPanel({
  report,
  row,
}: {
  report: TopGearReport;
  row: SetRow;
}) {
  const t = useTranslations("reports.purchasePlan");
  const ti = useTranslations("inventory.purchases");
  const frozen = report.purchases;
  const plan = row.purchasePlan;
  if (!frozen || !plan) return null;

  const resourceName = (resourceId: ResourceId) => {
    const family = familyForResource(resourceId);
    const option = optionForResource(resourceId, family);
    return option
      ? ti(option.labelKey, { family: ti(`families.${family}`) })
      : resourceId;
  };
  const cost = (amounts: ResourceAmounts) =>
    Object.entries(amounts)
      .filter(([, amount]) => amount > 0)
      .map(
        ([resourceId, amount]) =>
          `${amount} ${resourceName(resourceId as ResourceId)}`,
      )
      .join(" + ");
  const recipeById = new Map(
    frozen.recipes.map((recipe) => [recipe.id, recipe]),
  );
  const selectedIds = new Set(Object.values(row.loadout).filter(Boolean));
  const finalSteps = plan.steps.filter((step) =>
    selectedIds.has(step.resultId),
  );
  const resources = Object.keys({
    ...plan.remaining,
    ...plan.spent,
  }) as ResourceId[];
  const consumedItems = plan.consumedInstanceIds
    .map((instanceId) =>
      report.snapshot.inventory.find((item) => item.instanceId === instanceId),
    )
    .filter((item): item is ItemInstance => !!item);

  return (
    <aside
      className="purchase-plan-panel"
      aria-labelledby="purchase-plan-title"
    >
      <header className="purchase-plan-header">
        <div>
          <h2 id="purchase-plan-title">{t("title")}</h2>
          {plan.steps.length > 0 && (
            <p>
              {t("summary", {
                items: finalSteps.length,
                steps: plan.steps.length,
              })}
            </p>
          )}
        </div>
      </header>

      {plan.steps.length === 0 ? (
        <div className="purchase-plan-empty">
          <strong>{t("none")}</strong>
          <p>{t("noneDescription")}</p>
        </div>
      ) : (
        <>
          <section className="purchase-plan-section purchase-plan-rewards">
            <h3>{t("finalItems")}</h3>
            <div className="purchase-plan-item-links">
              {finalSteps.map((step) => {
                const item = itemForStep(report, step);
                return (
                  <ItemIcon key={step.resultId} item={item} size={36}>
                    <ItemName item={item} />
                  </ItemIcon>
                );
              })}
            </div>
          </section>
          <section className="purchase-plan-section">
            <h3>{t("steps")}</h3>
            <ol className="purchase-plan-steps">
              {plan.steps.map((step, index) => {
                const item = itemForStep(report, step);
                const recipe = recipeById.get(step.recipeId);
                const prerequisiteStep = step.prerequisite?.stepId
                  ? plan.steps.findIndex(
                      (candidate) =>
                        candidate.resultId === step.prerequisite!.stepId,
                    ) + 1
                  : 0;
                return (
                  <li key={step.resultId}>
                    <span className="purchase-plan-step-number">
                      {t("step", { number: index + 1 })}
                    </span>
                    <div className="purchase-plan-step-copy">
                      <div className="purchase-plan-step-item">
                        <ItemIcon item={item} size={36} tooltipOnly />
                        <div>
                          <p>
                            {t("obtain")}{" "}
                            <ItemLink item={item}>
                              <ItemName item={item} />
                            </ItemLink>
                          </p>
                          {recipe && (
                            <small>
                              {t("tier", {
                                tier: recipe.tier,
                                level: recipe.itemLevel,
                              })}
                            </small>
                          )}
                        </div>
                      </div>
                      <p className="purchase-plan-step-cost">
                        {cost(step.cost)}
                      </p>
                      {step.prerequisite?.instanceId ? (
                        <p className="purchase-plan-prerequisite">
                          {t("usesOwned")}
                        </p>
                      ) : prerequisiteStep > 0 ? (
                        <p className="purchase-plan-prerequisite">
                          {t("usesStep", { number: prerequisiteStep })}
                        </p>
                      ) : step.prerequisite ? (
                        <p className="purchase-plan-prerequisite">
                          {t("usesPrerequisite")}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        </>
      )}

      {resources.length > 0 && (
        <section className="purchase-plan-section purchase-plan-resources">
          <h3>{t("resources")}</h3>
          <table>
            <thead>
              <tr>
                <th scope="col">{t("resource")}</th>
                <th scope="col">{t("spent")}</th>
                <th scope="col">{t("remaining")}</th>
              </tr>
            </thead>
            <tbody>
              {resources.map((resourceId) => (
                <tr key={resourceId}>
                  <th scope="row">{resourceName(resourceId)}</th>
                  <td>{plan.spent[resourceId] ?? 0}</td>
                  <td>{plan.remaining[resourceId] ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {consumedItems.length > 0 && (
        <section className="purchase-plan-section purchase-plan-consumed">
          <h3>{t("consumed")}</h3>
          <div className="purchase-plan-item-links">
            {consumedItems.map((item) => (
              <ItemIcon key={item.instanceId} item={item} size={36}>
                <ItemName item={item} />
              </ItemIcon>
            ))}
          </div>
          <p>{t("consumedDescription")}</p>
        </section>
      )}
    </aside>
  );
}
