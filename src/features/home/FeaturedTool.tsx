import { useTranslations, useLocale } from "next-intl";
import { formatNumber } from "@/i18n/format";
import type { AppLocale } from "@/i18n/config";
import { ToolLink } from "@/features/shell/ToolLink";
import { Button } from "@/components/ui/Button";
import { ToolIcon } from "@/features/shell/ToolIcon";
import { SampleGear } from "./SampleReport";

function ExampleResult() {
  const t = useTranslations("home"),
    locale = useLocale() as AppLocale;
  return (
    <aside className="home-example" aria-label={t("exampleLabel")}>
      <div className="home-example-header">
        <span>{t("example")}</span>
        <span className="home-recommended">{t("recommended")}</span>
      </div>
      <div className="home-example-dps">
        <strong>{formatNumber(11375.7, locale)}</strong>
        <span>DPS</span>
        <span className="text-action">↑ +{formatNumber(19.7, locale)}</span>
      </div>
      <SampleGear items={[48493, 47434, 47475, 47528]} size={46} />
      <div className="home-example-caps">
        <span>
          Hit <strong>{t("capped")}</strong>
        </span>
        <span>
          Expertise <strong>{t("capped")}</strong>
        </span>
        <span>{t("changes", { count: 4 })}</span>
      </div>
    </aside>
  );
}
export function FeaturedTool() {
  const t = useTranslations("home");
  return (
    <section className="home-featured" aria-labelledby="gear-lab-title">
      <div className="home-tool-intro">
        <div className="home-tool-heading">
          <ToolIcon
            name="gear"
            width="26"
            height="26"
            className="text-action"
          />
          <h2 id="gear-lab-title">Gear Lab</h2>
          <span>{t("available")}</span>
        </div>
        <div>
          <p className="home-tool-lead">{t("lead")}</p>
          <p className="home-tool-description">{t("description")}</p>
        </div>
        <Button
          render={<ToolLink href="/gear-lab" />}
          nativeButton={false}
          role="link"
          className="home-tool-cta"
        >
          {t("open")} <span aria-hidden="true">→</span>
        </Button>
        <details id="how-it-works" className="home-import-guide">
          <summary>{t("how")}</summary>
          <ol>
            <li>{t("step1")}</li>
            <li>{t("step2")}</li>
            <li>{t("step3")}</li>
          </ol>
        </details>
      </div>
      <ExampleResult />
    </section>
  );
}
