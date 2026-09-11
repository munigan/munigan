import type { Diagnostic } from "@/domain/top-gear/model";
import type { InventoryTranslation } from "../item-labels";

/** Translate catalog requirement diagnostics while retaining unknown details. */
export function enhancementDiagnosticText(
  issue: Diagnostic,
  t: InventoryTranslation,
) {
  if (
    [
      "profession-gem",
      "profession-enchant",
      "profession-rank",
      "profession-rank-unknown",
    ].includes(issue.code)
  ) {
    const requirement = issue.message.match(
      /(?:Requires|Verify) (\w+).*?(\d+)/,
    );
    if (requirement)
      return t(
        issue.code === "profession-rank-unknown"
          ? "editor.verifyRank"
          : "editor.requiresRank",
        {
          profession: t(`editor.professions.${requirement[1]}`),
          rank: Number(requirement[2]),
        },
      );
  }
  if (issue.code === "socket")
    return t(
      issue.message.includes("unavailable")
        ? "editor.unavailableSocket"
        : "editor.incompatibleGem",
    );
  if (issue.code === "enchant") return t("editor.incompatibleEnchant");
  if (issue.code === "unknown-gem" || issue.code === "unknown-item")
    return t("editor.unknownEnhancement");
  return t("editor.requirement", { details: issue.message });
}
