import type { WarmaneImportMeta } from "./warmane";
import { isWarmaneImportMeta } from "./warmane-import-meta";

export const importFormDraftKey = "munigan.top-gear.import.v1";
export type ImportFormDraft = {
  kind: "character" | "profile" | "warmane";
  character: string;
  bags: string;
  armory: { name: string; realm: string };
  preset: string;
  reviewing: boolean;
  armoryMeta?: WarmaneImportMeta;
};
export function loadImportFormDraft(): ImportFormDraft | null {
  const raw = localStorage.getItem(importFormDraftKey);
  if (!raw) return null;
  const value = JSON.parse(raw);
  if (
    !value ||
    !["character", "profile", "warmane"].includes(value.kind) ||
    typeof value.character !== "string" ||
    typeof value.bags !== "string" ||
    typeof value.preset !== "string" ||
    typeof value.reviewing !== "boolean" ||
    typeof value.armory?.name !== "string" ||
    typeof value.armory?.realm !== "string" ||
    (value.armoryMeta !== undefined && !isWarmaneImportMeta(value.armoryMeta))
  )
    throw new Error("Invalid saved import draft.");
  return value;
}
