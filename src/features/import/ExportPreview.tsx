"use client";
import { useEffect, useState } from "react";
import type { ItemInstance } from "@/domain/top-gear/model";
import { parseExport } from "./parse-export";
import { ImportedItemsPreview } from "./ImportedItemsPreview";

type ExportKind = Parameters<typeof parseExport>[1];

export function ExportPreview({
  text,
  kind,
}: {
  text: string;
  kind: ExportKind;
}) {
  const [parsed, setParsed] = useState<{
    text: string;
    kind: ExportKind;
    items: ItemInstance[];
  } | null>(null);

  useEffect(() => {
    // Wait for editing to settle. Keep parsing local and bounded by the same
    // limits as Review import, without resolving presets or checking gear sets.
    if (!text.trim() || text.length > 1024 * 1024) return;
    const timer = window.setTimeout(() => {
      try {
        setParsed({ text, kind, items: parseExport(text, kind).inventory });
      } catch {
        // Incomplete input is normal here; Review import owns error feedback.
        setParsed(null);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [text, kind]);

  // Never show the previous export's items while an edit is being parsed.
  if (!text.trim() || parsed?.text !== text || parsed.kind !== kind)
    return null;
  return <ImportedItemsPreview items={parsed.items} bags={kind === "bags"} />;
}
