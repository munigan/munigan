import { expect, it } from "vitest";
import { fixtureRequest } from "../../../tests/support/fixtures";
import { itemVersions } from "./item-version";
import { loadoutKey } from "@/domain/equipment/enumerate";
import {
  decodeDraft,
  decodeSnapshot,
  encodeRequest,
  encodeSnapshot,
} from "./request-schema";

it("new imports default to original itemization", () => {
  expect(fixtureRequest().snapshot.itemVersion).toBe("original");
});

it("keeps pre-selector drafts and reports on Classic", () => {
  const request = fixtureRequest();
  delete request.snapshot.itemVersion;
  delete request.snapshot.itemDataRevision;
  expect(decodeDraft(encodeRequest(request)).snapshot.itemVersion).toBe(
    "classic",
  );
  expect(decodeSnapshot(encodeSnapshot(request.snapshot)).itemVersion).toBe(
    "classic",
  );
});

it("rejects unknown profiles and outdated original data", () => {
  const request = encodeRequest(fixtureRequest());
  expect(() =>
    decodeDraft({
      ...request,
      snapshot: { ...request.snapshot, itemVersion: "retail" },
    }),
  ).toThrow();
  expect(() =>
    decodeDraft({
      ...request,
      snapshot: {
        ...request.snapshot,
        itemVersion: "original",
        itemDataRevision: "outdated",
      },
    }),
  ).toThrow(/item data/i);
});

it("persists the selected version and isolates reusable work", () => {
  const request = fixtureRequest();
  const originalKey = loadoutKey(request.snapshot, request.snapshot.equipped);
  request.snapshot.itemVersion = "classic";
  request.snapshot.itemDataRevision = itemVersions.classic.revision;
  const restored = decodeDraft(encodeRequest(request));
  expect(restored.snapshot.itemVersion).toBe("classic");
  expect(restored.snapshot.itemDataRevision).toBe(
    itemVersions.classic.revision,
  );
  expect(loadoutKey(restored.snapshot, restored.snapshot.equipped)).not.toBe(
    originalKey,
  );
});
