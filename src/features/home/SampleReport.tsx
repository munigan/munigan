"use client";
import { ItemIcon } from "@/features/inventory/Item";
import { ItemVersionContext } from "@/features/inventory/ItemVersionContext";

export function SampleGear({
  items,
  size = 48,
}: {
  items: number[];
  size?: number;
}) {
  return (
    <ItemVersionContext value="original">
      <div className="flex shrink-0 gap-2">
        {items.map((itemId, index) => (
          <ItemIcon
            key={`${itemId}-${index}`}
            size={size}
            item={{
              itemId,
              instanceId: `sample-${itemId}-${index}`,
              source: "bag",
              enchantId: 0,
              gemIds: [],
            }}
          />
        ))}
      </div>
    </ItemVersionContext>
  );
}
const sets = [
  {
    rank: "01",
    label: "THE WINNER",
    description: "Best combination",
    dps: "12,846",
    gain: "↑ +518 DPS",
    items: [48493, 47475, 47528],
  },
  {
    rank: "02",
    label: "THE CONTENDER",
    description: "Alternative set",
    dps: "12,703",
    gain: "↑ +375 DPS",
    items: [48493, 47475, 47156],
  },
  {
    rank: "03",
    label: "YOUR CURRENT SET",
    description: "Equipped baseline",
    dps: "12,328",
    gain: "Baseline",
    items: [48493, 47156, 47156],
  },
];
export function SampleReport() {
  return (
    <section
      id="sample-report"
      className="home-section scroll-mt-8"
      aria-label="Sample Top Gear report"
    >
      <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="font-brand text-xs tracking-wider">
            THE NUMBERS DON’T GUESS.
          </p>
          <h2 className="home-section-title mt-3">YOUR BAGS. RANKED.</h2>
          <p className="mt-3 text-sm text-muted sm:text-base">
            Complete combinations. Clear gains. Every swap explained.
          </p>
        </div>
        <div className="sm:text-right">
          <p className="font-brand text-5xl font-bold tracking-tight text-gain sm:text-6xl">
            ↗ 4.2%
          </p>
          <p className="mt-2 font-brand text-[11px] tracking-wider text-muted">
            SAMPLE DPS GAIN
          </p>
        </div>
      </div>
      <ol className="sample-rankings">
        {sets.map((set, index) => (
          <li
            key={set.rank}
            className={`sample-ranking ${index === 0 ? "sample-ranking-winner" : ""}`}
          >
            <span className="sample-rank font-display text-4xl font-semibold">
              {set.rank}
            </span>
            <div className="sample-name">
              <h3 className="font-brand text-base font-bold sm:text-lg">
                {set.label}
              </h3>
              <p className="mt-1 text-xs text-muted">{set.description}</p>
            </div>
            <div className="sample-gear">
              <SampleGear items={set.items} />
            </div>
            <strong className="sample-dps font-brand text-3xl tracking-tight tabular-nums sm:text-4xl">
              {set.dps}
            </strong>
            <span
              className={`sample-gain font-brand text-xs tabular-nums ${index < 2 ? "text-gain" : "text-muted"}`}
            >
              {set.gain}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs text-muted">
        Illustrative results. Your gains depend on your character and gear.
      </p>
    </section>
  );
}
