import { afterEach, expect, it } from "vitest";
import { draftKey, loadDraft, saveDraft } from "./draft-store";
import { fixtureRequest } from "../../../tests/support/fixtures";
import {
  encodeRequest,
  validateRequest,
} from "@/domain/top-gear/request-schema";

afterEach(() => localStorage.clear());

it("restores an editable draft with an imported profession below 450 without weakening admission", () => {
  const request = fixtureRequest();
  request.snapshot.professionLevels = { 4: 425 };
  saveDraft(request);
  const restored = loadDraft();
  expect(restored?.snapshot.professionLevels).toEqual({ 4: 425 });
  expect(restored?.snapshot.inventory).toEqual(request.snapshot.inventory);
  expect(restored?.selection).toEqual(request.selection);
  expect(() => validateRequest(encodeRequest(restored!))).toThrow(
    /profession/i,
  );
});

it("restores other correctable settings but rejects malformed and outdated drafts", () => {
  const request = fixtureRequest();
  request.snapshot.settings.encounter!.duration = 0;
  saveDraft(request);
  expect(loadDraft()?.snapshot.settings.encounter?.duration).toBe(0);
  expect(() => validateRequest(encodeRequest(request))).toThrow(/encounter/i);
  request.snapshot.versions = {
    ...request.snapshot.versions,
    engine: "old-version",
  };
  saveDraft(request);
  expect(() => loadDraft()).toThrow(/older simulator version/i);
  localStorage.setItem(draftKey, '{"tool":"unknown"}');
  expect(() => loadDraft()).toThrow();
});
