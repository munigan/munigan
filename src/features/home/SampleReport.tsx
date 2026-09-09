"use client";
import { ItemIcon } from "@/features/inventory/Item";
import { ItemVersionContext } from "@/features/inventory/ItemVersionContext";
const sets = [
  {
    rank: "01",
    name: "Best combination",
    dps: "12,846",
    gain: "+4.2%",
    items: [48493, 47475, 47528],
    winner: true,
  },
  {
    rank: "02",
    name: "Alternative set",
    dps: "12,703",
    gain: "+3.0%",
    items: [48493, 47475, 47156],
    winner: false,
  },
  {
    rank: "03",
    name: "Currently equipped",
    dps: "12,328",
    gain: "Baseline",
    items: [48493, 47156, 47156],
    winner: false,
  },
];
export function SampleReport() {
  return (
    <ItemVersionContext value="original">
      <aside className="home-sample" aria-label="Sample Top Gear report">
        <div className="home-sample-heading">
          <span className="eyebrow">SAMPLE RESULTS</span>
          <span className="badge">Illustrative DPS</span>
        </div>
        <h2>A better set, already in your bags.</h2>
        <div className="home-sample-columns">
          <span>Gear combination</span>
          <span>DPS / gain</span>
        </div>
        <ol>
          {sets.map((set) => (
            <li
              key={set.rank}
              className={set.winner ? "home-sample-winner" : ""}
            >
              <span className="home-sample-rank">{set.rank}</span>
              <div className="home-sample-set">
                <strong>{set.name}</strong>
                <div>
                  {set.items.map((itemId, index) => (
                    <ItemIcon
                      key={index}
                      size={32}
                      item={{
                        itemId,
                        instanceId: `sample-${set.rank}-${index}`,
                        source: "bag",
                        enchantId: 0,
                        gemIds: [],
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="home-sample-score">
                <strong>{set.dps}</strong>
                <span>{set.gain}</span>
              </div>
            </li>
          ))}
        </ol>
        <p>Compare complete sets. See the gear changes behind every gain.</p>
      </aside>
    </ItemVersionContext>
  );
}
