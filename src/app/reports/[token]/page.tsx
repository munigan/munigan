import { ReportView } from "@/features/reports/ReportView";
export const metadata = {
  title: "Top Gear report · WoW Droptimizer",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function Report({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return <ReportView token={(await params).token} />;
}
