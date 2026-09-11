import { ReportView } from "@/features/reports/ReportView";
import { getTranslations } from "next-intl/server";
export async function generateMetadata() {
  const t = await getTranslations("shell");
  return {
    title: t("reportTitle"),
    robots: { index: false, follow: false },
    referrer: "no-referrer" as const,
  };
}
export default async function Report({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return <ReportView token={(await params).token} />;
}
