import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createPurchaseCatalog,
  normalizedPurchaseManifest,
  type PurchaseManifest,
} from "../../src/domain/purchases/catalog";
import {
  itemVersions,
  type ItemVersion,
} from "../../src/domain/top-gear/item-version";

/** The manifest is a reviewed input. Never generate purchase prices from names. */
export function validatePurchaseManifest(): void {
  const manifest = JSON.parse(
    readFileSync(resolve("data/wotlk/purchases.json"), "utf8"),
  ) as PurchaseManifest;
  const revision = `purchases-v1:${createHash("sha256").update(normalizedPurchaseManifest(manifest)).digest("hex")}`;
  if (manifest.revision !== revision)
    throw new Error(`Purchase revision mismatch: expected ${revision}`);
  for (const profile of Object.keys(itemVersions) as ItemVersion[])
    createPurchaseCatalog(manifest, profile);
}
