export const metadata = {
  title: "Top Gear",
  robots: { index: false, follow: true },
};
import { TopGearApp } from "@/features/inventory/TopGearApp";
export default async function TopGear({
  searchParams,
}: {
  searchParams: Promise<{ restore?: string | string[] }>;
}) {
  const { restore } = await searchParams;
  return <TopGearApp autoRestore={restore === "1"} />;
}
