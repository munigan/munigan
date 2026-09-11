import type { ErrorDescriptor } from "@/i18n/error";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { localizeDiagnostic } from "@/i18n/diagnostics";
import { Alert, AlertContent } from "@/components/ui/Alert";
import { PageHeading } from "@/components/ui/layout";
export function ReportLoading({ error }: { error: string | ErrorDescriptor }) {
  const t = useTranslations("reports");
  const diagnostics = useTranslations("diagnostics");
  return (
    <section id="content" className="report-view">
      <PageHeading className="page-heading">
        <h1>TOP GEAR</h1>
      </PageHeading>
      <Alert tone={error ? "error" : "info"} aria-busy={!error}>
        <AlertContent icon={error ? "error" : "history"}>
          <div className="flex flex-col gap-2">
            <p className="eyebrow">
              {error ? t("reportUnavailable") : t("reportLabel")}
            </p>
            <h2 className="font-display text-[28px] leading-8">
              {error ? t("loadFailed") : t("loading")}
            </h2>
            {error ? (
              <p>{localizeDiagnostic(error, diagnostics)}</p>
            ) : (
              <div className="report-loading-bar" aria-hidden="true" />
            )}
          </div>
        </AlertContent>
      </Alert>
      <p className="actions">
        <Link href="/top-gear">{t("back")}</Link>
      </p>
    </section>
  );
}
