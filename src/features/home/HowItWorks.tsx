const steps = [
  {
    number: "01",
    title: "IMPORT.",
    body: "Bring your character, talents and bag items straight from the addon.",
  },
  {
    number: "02",
    title: "PICK.",
    body: "Choose the items you want to compare. We’ll build the possible sets.",
  },
  {
    number: "03",
    title: "SEND IT.",
    body: "Run the simulation. See your strongest loadout and every DPS gain.",
  },
];
export function HowItWorks() {
  return (
    <section id="how-it-works" className="home-section scroll-mt-8">
      <h2 className="home-section-title">GEAR UP. IN THREE MOVES.</h2>
      <ol className="mt-10 grid gap-10 md:grid-cols-3 md:gap-14">
        {steps.map((step) => (
          <li key={step.number} className="border-t border-border pt-6">
            <span className="font-brand text-sm text-action">
              / {step.number}
            </span>
            <h3 className="mt-4 font-display text-4xl font-bold sm:text-5xl">
              {step.title}
            </h3>
            <p className="mt-4 max-w-80 text-base leading-7 text-muted">
              {step.body}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
