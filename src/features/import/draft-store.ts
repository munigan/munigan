import { encodeRequest, decodeDraft } from "@/domain/top-gear/request-schema";
import type { TopGearRequest } from "@/domain/top-gear/model";
export const draftKey = "wow-droptimizer.top-gear.v1";
export function saveDraft(request: TopGearRequest) {
  localStorage.setItem(draftKey, JSON.stringify(encodeRequest(request)));
}
export function loadDraft() {
  const raw = localStorage.getItem(draftKey);
  if (!raw) return null;
  return decodeDraft(JSON.parse(raw));
}
export function clearDraft() {
  localStorage.removeItem(draftKey);
}
