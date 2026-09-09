"use client";
import { useEffect, useRef } from "react";
import type { GemmingSettings, Snapshot } from "@/domain/top-gear/model";
import { getCatalog } from "@/domain/equipment/catalog";
import {
  defaultGemming,
  hasJewelcrafting,
  supportedMetaGem,
} from "@/domain/equipment/gemming";
import { GemColor, Profession } from "@/generated/wotlk/common";
import { ItemIcon } from "./Item";

export function GemmingPanel({
  snapshot,
  onChange,
  onClose,
}: {
  snapshot: Snapshot;
  onChange: (snapshot: Snapshot) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  function close() {
    dialog.current?.close();
    onClose();
  }
  const catalog = getCatalog(snapshot.itemVersion);
  const config = snapshot.gemming ?? defaultGemming(snapshot);
  const gems = [...catalog.gems.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  function update(patch: Partial<GemmingSettings>) {
    onChange({ ...snapshot, gemming: { ...config, ...patch } });
  }
  const fields = [
    {
      key: "defaultGemId" as const,
      label: "Default gem",
      options: gems.filter(
        (g) =>
          g.color !== GemColor.GemColorMeta &&
          !g.requiredProfession &&
          !g.unique,
      ),
    },
    {
      key: "metaGemId" as const,
      label: "Meta gem",
      options: gems.filter(
        (g) => g.color === GemColor.GemColorMeta && supportedMetaGem(g.id),
      ),
    },
    ...(hasJewelcrafting(snapshot)
      ? [
          {
            key: "jcGemId" as const,
            label: "Jewelcrafting gem",
            options: gems.filter(
              (g) => g.requiredProfession === Profession.Jewelcrafting,
            ),
          },
        ]
      : []),
  ];
  return (
    <dialog
      ref={dialog}
      className="settings-dialog enhancement-dialog"
      aria-labelledby="enhancement-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <div className="enhancement-dialog-header section-top">
        <div>
          <p className="eyebrow">ITEM ENHANCEMENTS</p>
          <h2 id="enhancement-title">Gems, enchants & sockets</h2>
        </div>
        <button onClick={close}>Done</button>
      </div>
      <div className="gemming-settings">
        <section className="enhancement-section">
          <h3>Enchants & profession bonuses</h3>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={snapshot.autoEnchant ?? true}
              onChange={(e) =>
                onChange({ ...snapshot, autoEnchant: e.target.checked })
              }
            />
            Copy enchants & profession bonuses
          </label>
          <p className="muted small">
            Copy compatible equipped enchants and use eligible profession
            bonuses.
          </p>
        </section>
        <section className="enhancement-section">
          <h3>Gems & sockets</h3>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => update({ enabled: e.target.checked })}
            />
            Automatically fill empty sockets
          </label>
          {config.enabled && (
            <div className="gemming-fields">
              {fields.map((field) => (
                <label key={field.key} className="gemming-field">
                  {field.label}
                  <span>
                    <ItemIcon
                      item={{
                        instanceId: field.key,
                        itemId: config[field.key],
                        enchantId: 0,
                        gemIds: [],
                        source: "bag",
                      }}
                      size={32}
                    />
                    <select
                      aria-label={field.label}
                      value={config[field.key]}
                      onChange={(e) =>
                        update({ [field.key]: Number(e.target.value) })
                      }
                    >
                      {field.options.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </span>
                </label>
              ))}
              <p className="muted small">
                {hasJewelcrafting(snapshot)
                  ? "Maintains 3 Dragon’s Eyes, replacing regular gems when needed. "
                  : ""}
                Includes Eternal Belt Buckles and eligible blacksmith sockets.
                Keeps meta gems active where possible.
              </p>
            </div>
          )}
        </section>
        <p className="muted small enhancement-baseline">
          Changes apply to tested combinations. Your equipped reference stays as
          imported.
        </p>
      </div>
    </dialog>
  );
}

export function EnhancementSummary({
  snapshot,
  onOpen,
}: {
  snapshot: Snapshot;
  onOpen: () => void;
}) {
  const config = snapshot.gemming ?? defaultGemming(snapshot);
  const gemIds = config.enabled
    ? [
        config.defaultGemId,
        config.metaGemId,
        ...(hasJewelcrafting(snapshot) ? [config.jcGemId] : []),
      ]
    : [];
  return (
    <div className="enhancement-summary">
      <button
        className="text-button"
        onClick={onOpen}
        aria-haspopup="dialog"
        aria-label="Gems, enchants & sockets"
      >
        Gems, enchants & sockets <span aria-hidden="true">→</span>
      </button>
      <div className="enhancement-preview">
        {gemIds.map((itemId, index) => (
          <ItemIcon
            key={index}
            size={24}
            item={{
              instanceId: `preview-${index}`,
              itemId,
              enchantId: 0,
              gemIds: [],
              source: "bag",
            }}
          />
        ))}
        <small className="muted">
          {config.enabled ? "Auto gems" : "Imported gems"} ·{" "}
          {(snapshot.autoEnchant ?? true)
            ? "Auto enchants"
            : "Imported enchants"}
        </small>
      </div>
    </div>
  );
}
