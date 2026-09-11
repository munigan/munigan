import { useId } from "react";

/** Static illustration: it does not run a second encounter behind the setup screen. */
export function PlacementPreview({ bossPortrait }: { bossPortrait: string }) {
  const clip = useId().replaceAll(":", "");
  const tokens = [
    { name: "priest", x: 195, y: 193, size: 18 },
    { name: "warrior", x: 174, y: 224, size: 18 },
    { name: "mage", x: 212, y: 226, size: 18 },
    { name: "druid", x: 200, y: 251, size: 18 },
    { name: "deathknight", x: 309, y: 164, size: 22 },
  ];
  return (
    <figure
      className="rt-placement-preview"
      aria-label="Placement example: take Defile away from teammates, then move out of the pool."
    >
      <svg viewBox="0 0 424 338" aria-hidden="true">
        <defs>
          <clipPath id={`${clip}-boss`}>
            <circle cx="211" cy="162" r="15" />
          </clipPath>
          {tokens.map((token) => (
            <clipPath key={token.name} id={`${clip}-${token.name}`}>
              <circle
                cx={token.x + token.size / 2}
                cy={token.y + token.size / 2}
                r={token.size / 2 - 1}
              />
            </clipPath>
          ))}
        </defs>
        <image
          href="/raid-trainer/art/arena-sculpted-ice.png"
          x="58"
          y="18"
          width="308"
          height="308"
          opacity="0.8"
        />
        <circle cx="211" cy="162" r="18" fill="#101920" stroke="#6F8EA0" />
        <image
          href={bossPortrait}
          x="196"
          y="147"
          width="30"
          height="30"
          clipPath={`url(#${clip}-boss)`}
        />
        <circle
          cx="281"
          cy="233"
          r="31"
          fill="#302139"
          stroke="#B296C5"
          strokeWidth="1.5"
        />
        <circle
          cx="281"
          cy="233"
          r="24"
          fill="none"
          stroke="#A688BC"
          strokeDasharray="3 4"
        />
        <path
          d="M235 213 Q253 231 281 233 Q312 234 320 190"
          fill="none"
          stroke="#9CD6F0"
          strokeWidth="2"
          strokeDasharray="4 4"
        />
        <path
          d="M312 196L320 184L326 198"
          fill="none"
          stroke="#9CD6F0"
          strokeWidth="2"
        />
        {tokens.map((token) => (
          <g key={token.name}>
            <circle
              cx={token.x + token.size / 2}
              cy={token.y + token.size / 2}
              r={token.size / 2}
              fill="#101920"
              stroke={token.name === "deathknight" ? "#E6BF78" : "#9CD6F0"}
            />
            <image
              href={`/raid-trainer/art/classes/${token.name}.jpg`}
              x={token.x}
              y={token.y}
              width={token.size}
              height={token.size}
              clipPath={`url(#${clip}-${token.name})`}
            />
          </g>
        ))}
        <text x="304" y="156" fill="#E6BF78" fontSize="10">
          YOU
        </text>
      </svg>
      <figcaption>
        <span>Placement preview</span>
        <span>Illustrated example</span>
      </figcaption>
    </figure>
  );
}
