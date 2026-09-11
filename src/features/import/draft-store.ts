import { importFormDraftKey } from "./import-form-draft";
import { encodeRequest, decodeDraft } from "@/domain/top-gear/request-schema";
import type { TopGearRequest } from "@/domain/top-gear/model";
export const draftKey = "wow-droptimizer.top-gear.v1";
export function saveDraft(request: TopGearRequest) {
  localStorage.setItem(draftKey, JSON.stringify(encodeRequest(request)));
  localStorage.removeItem(importFormDraftKey);
}
export function loadDraft() {
  const raw = localStorage.getItem(draftKey);
  if (!raw) return null;
  return decodeDraft(JSON.parse(raw));
}
export function clearDraft() {
  localStorage.removeItem(draftKey);
  localStorage.removeItem(importFormDraftKey);
}

/** A report must not discard a newer setup saved while its request was pending. */
export function clearMatchingDraft(
  submitted: ReturnType<typeof encodeRequest>,
) {
  if (localStorage.getItem(draftKey) !== JSON.stringify(submitted))
    return false;
  localStorage.removeItem(draftKey);
  return true;
}
