import { readFile } from "node:fs/promises";
const approval = JSON.parse(
  await readFile("docs/design/approval.json", "utf8"),
);
if (approval.topGear?.status !== "approved" || approval.topGear.revision !== 4)
  throw new Error("Missing scoped Top Gear design approval");
const screens = JSON.parse(
  await readFile("docs/design/screens.json", "utf8"),
) as Array<{ key: string; revision: number }>;
for (const key of [
  "IMPORT.desktop",
  "TG-SELECT.desktop",
  "TG-RESULT.desktop",
  "JOB.desktop",
  "FULL-SET.mobile",
])
  if (!screens.some((s) => s.key === key && s.revision === 4))
    throw new Error(`Missing revision 4 design: ${key}`);
const shell = await readFile("src/features/shell/AppShell.tsx", "utf8");
if (/Boss Droptimizer|Raid Droptimizer|Sign in|checkout/.test(shell))
  throw new Error("Out-of-scope navigation in Top Gear shell");
console.log(
  "Scoped Top Gear design contract and revision 4 references verified.",
);
