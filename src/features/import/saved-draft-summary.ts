import { Class } from "@/generated/wotlk/common";
import type { ItemInstance } from "@/domain/top-gear/model";
import { getSpec, listSpecs } from "@/features/settings/registry";
import { loadDraft } from "./draft-store";
import { loadImportFormDraft } from "./import-form-draft";
import { parseExport } from "./parse-export";

export type SavedDraftSummary = {
  name: string;
  className?: string;
  specName?: string;
  talentsString?: string;
  stage: "selection" | "review" | "import";
  needsPreset?: boolean;
  counts?: { equipped: number; bag: number | null; custom: number };
};
function countItems(items: ItemInstance[]) {
  return {
    equipped: items.filter((item) => item.source === "equipped").length,
    bag: items.filter((item) => item.source === "bag").length,
    custom: items.filter((item) => item.source === "custom").length,
  };
}

// Match the same precedence and validation as the explicit Restore action.
// A broken draft must still leave Restore/Discard usable.
export function loadSavedDraftSummary(): SavedDraftSummary | null {
  try {
    const form = loadImportFormDraft();
    if (form) {
      const summary: SavedDraftSummary = {
        name: form.kind === "warmane" ? form.armory.name : "",
        stage: form.reviewing ? "review" : "import",
      };
      try {
        const parsed = parseExport(
          form.character,
          form.kind === "profile" ? "profile" : "character",
        );
        const player = parsed.settingsJson.player;
        if (!player || typeof player !== "object" || Array.isArray(player))
          return summary;
        const spec = listSpecs().find(
          (choice) =>
            choice.id === form.preset && choice.classId === parsed.classId,
        );
        summary.name =
          typeof player.name === "string" ? player.name : summary.name;
        summary.className = parsed.classId
          ? Class[parsed.classId]
              .replace(/^Class/, "")
              .replace("Deathknight", "Death Knight")
          : undefined;
        summary.specName = spec?.name;
        summary.talentsString =
          typeof player.talentsString === "string"
            ? player.talentsString
            : spec?.talents.talentsString;
        summary.needsPreset = form.reviewing && !spec;
        summary.counts = countItems(parsed.inventory);
        try {
          summary.counts.bag = form.bags.trim()
            ? parseExport(form.bags, "bags").inventory.length
            : 0;
        } catch {
          summary.counts.bag = null;
        }
      } catch {
        // Partial text can be saved before it becomes a valid character export.
      }
      return summary;
    }
    const saved = loadDraft();
    if (!saved) return null;
    const spec = getSpec(saved.snapshot.specId);
    return {
      name: saved.snapshot.settings.player?.name ?? "",
      className: spec.className.replace("Deathknight", "Death Knight"),
      specName: spec.name,
      talentsString: saved.snapshot.settings.player?.talentsString,
      stage: "selection",
      counts: countItems(saved.snapshot.inventory),
    };
  } catch {
    return null;
  }
}
