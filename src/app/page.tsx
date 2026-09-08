import Link from "next/link";
export default function Home() {
  return (
    <section id="content" className="intro">
      <p className="eyebrow">YOUR GEAR. YOUR NEXT UPGRADE.</p>
      <h1>
        MAKE EVERY
        <br />
        <span>ITEM COUNT.</span>
      </h1>
      <p>Find the strongest combination of the gear you already own.</p>
      <Link className="button" href="/top-gear">
        Find Top Gear →
      </Link>
      <div className="how-it-works">
        <h2>From your bags to your best set.</h2>
        <ol>
          <li>Import your character and bag items.</li>
          <li>Select your gear and simulation settings.</li>
          <li>Compare complete sets and see every swap.</li>
        </ol>
      </div>
    </section>
  );
}
