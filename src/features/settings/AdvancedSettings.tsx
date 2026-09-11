import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { SettingsIcon } from "./SettingsIcon";
export function AdvancedSettings({
  value,
  onChange,
  onApply,
  validated,
}: {
  value: string;
  onChange: (s: string) => void;
  onApply: () => void;
  validated?: boolean;
}) {
  const t = useTranslations("settings");
  return (
    <section className="advanced-settings">
      <div className="settings-list-heading">
        <label htmlFor="config-json">{t("advanced.json")}</label>
        <span className="badge">JSON</span>
      </div>
      <div className="settings-code-editor">
        <div aria-hidden="true">
          {value.split("\n").map((_, i) => (
            <span key={i}>{i + 1}</span>
          ))}
        </div>
        <textarea
          id="config-json"
          aria-label={t("advanced.json")}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          wrap="off"
          onScroll={(e) => {
            const gutter = e.currentTarget.previousElementSibling;
            if (gutter) gutter.scrollTop = e.currentTarget.scrollTop;
          }}
        />
      </div>
      <div className="settings-code-actions">
        <span className={validated ? "positive" : "muted"} role="status">
          {validated ? t("advanced.valid") : t("advanced.validateHelp")}
        </span>
        <Button variant="secondary" size="sm" onClick={onApply}>
          {t("advanced.validate")}
          <SettingsIcon name="check" />
        </Button>
      </div>
      <p className="settings-note">
        <SettingsIcon name="info" />
        {t("advanced.help")}
      </p>
    </section>
  );
}
