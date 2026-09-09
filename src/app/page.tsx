import Link from "next/link";
import { SampleReport } from "@/features/home/SampleReport";
import "@/features/home/home.css";
export default function Home() {
  return (
    <section id="content" className="home-refinement">
      <div className="home-hero">
        <div className="home-copy">
          <p className="eyebrow">WRATH OF THE LICH KING · TOP GEAR</p>
          <h1>
            MAKE EVERY
            <br />
            <span>ITEM COUNT.</span>
          </h1>
          <p className="home-description">
            Find the strongest combination of the gear you already own. Simulate
            your sets and see exactly what to equip.
          </p>
          <Link className="button" href="/top-gear">
            Find Top Gear <span aria-hidden="true">→</span>
          </Link>
        </div>
        <SampleReport />
      </div>
      <div className="home-steps">
        <h2>From your bags to your best set.</h2>
        <ol>
          <li>
            <span aria-hidden="true">01</span>
            <div>
              <h3>Import your character</h3>
              <p>
                Bring your equipped gear and bag items, complete with gems and
                enchants.
              </p>
            </div>
          </li>
          <li>
            <span aria-hidden="true">02</span>
            <div>
              <h3>Choose what to compare</h3>
              <p>
                Select your items and adjust buffs, consumables and encounter
                settings.
              </p>
            </div>
          </li>
          <li>
            <span aria-hidden="true">03</span>
            <div>
              <h3>Equip your best set</h3>
              <p>
                Compare ranked combinations and see every swap behind your DPS
                gain.
              </p>
            </div>
          </li>
        </ol>
      </div>
    </section>
  );
}
