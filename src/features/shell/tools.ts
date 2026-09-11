export const futureTools = [
  {
    id: "raid",
    name: "Raid Upgrades",
    description:
      "Choose a raid. Rank its drops by the DPS they add to your character.",
  },
  {
    id: "balance",
    name: "Gear Balance",
    description:
      "Fit your new drop with alternate items and gems. Keep your caps.",
  },
  {
    id: "talents",
    name: "Talent Lab",
    description: "See average DPS change with every talent point you add.",
  },
  {
    id: "logs",
    name: "Log Review",
    description:
      "Compare your fight with the top 5 uwu-logs and find what to improve.",
  },
] as const;
export type ToolIconName =
  | "library"
  | "overview"
  | "gear"
  | "trainer"
  | "more"
  | "help"
  | (typeof futureTools)[number]["id"];
