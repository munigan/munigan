"use client";

import {
  Alert,
  AlertAction,
  AlertActions,
  AlertContent,
} from "@/components/ui/Alert";
import { localizeDiagnostic } from "@/i18n/diagnostics";
import type { ErrorDescriptor } from "@/i18n/error";
import { useLocale, useTranslations } from "next-intl";
import type { WarmaneImportMeta } from "./warmane";
import { formatWarmaneAge } from "./warmane-import-meta";

function RetrievedAt({ retrievedAt }: { retrievedAt: string }) {
  const locale = useLocale();
  const t = useTranslations("import");
  const date = new Date(retrievedAt);
  const absolute = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
  return (
    <time dateTime={retrievedAt} title={date.toISOString()}>
      {t("armoryRetrieved", { date: absolute })} ·{" "}
      {formatWarmaneAge(retrievedAt, locale)}
    </time>
  );
}

export function WarmaneImportStatus({
  meta,
  pending,
  error,
  onRefresh,
}: {
  meta: WarmaneImportMeta | null;
  pending: boolean;
  error: ErrorDescriptor | null;
  onRefresh: () => void;
}) {
  const t = useTranslations("import");
  const td = useTranslations("diagnostics");
  return (
    <Alert tone={error ? "error" : "info"}>
      <AlertContent icon={error ? "error" : "history"}>
        <strong>
          {t(meta ? `armorySource${meta.source}` : "armorySourceUnknown")}
        </strong>
        {meta && (
          <p className="muted">
            <RetrievedAt retrievedAt={meta.retrievedAt} />
          </p>
        )}
        {error && <p>{localizeDiagnostic(error, td)}</p>}
      </AlertContent>
      <AlertActions>
        <AlertAction disabled={pending} aria-busy={pending} onClick={onRefresh}>
          {t(pending ? "armoryRefreshing" : "refreshArmory")}
        </AlertAction>
      </AlertActions>
    </Alert>
  );
}

export function WarmaneSavedProfileOffer({
  retrievedAt,
  pending,
  onUse,
}: {
  retrievedAt: string;
  pending: boolean;
  onUse: () => void;
}) {
  const t = useTranslations("import");
  return (
    <Alert tone="warning">
      <AlertContent icon="history">
        <strong>{t("armorySavedAvailable")}</strong>
        <p className="muted">
          <RetrievedAt retrievedAt={retrievedAt} />
        </p>
      </AlertContent>
      <AlertActions>
        <AlertAction disabled={pending} aria-busy={pending} onClick={onUse}>
          {t(pending ? "armoryFetchingSaved" : "useSavedProfile")}
        </AlertAction>
      </AlertActions>
    </Alert>
  );
}
