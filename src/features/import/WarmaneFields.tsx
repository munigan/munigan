"use client";
import { useTranslations } from "next-intl";
import { Select, SelectOption } from "@/components/ui/Select";
import { warmaneRealms, type WarmaneLookup } from "./warmane";

export function WarmaneFields({
  value,
  onChange,
  onReview,
  pending,
  invalid,
}: {
  value: WarmaneLookup;
  onChange: (value: WarmaneLookup) => void;
  onReview: () => void;
  pending: boolean;
  invalid: boolean;
}) {
  const t = useTranslations("import");
  return (
    <form
      id="warmane-import"
      className="warmane-fields"
      onSubmit={(event) => {
        event.preventDefault();
        if (!pending) onReview();
      }}
    >
      <div className="warmane-lookup">
        <div className="import-input-section">
          <label htmlFor="warmane-name">{t("characterName")}</label>
          <input
            id="warmane-name"
            value={value.name}
            maxLength={12}
            required
            autoComplete="off"
            spellCheck={false}
            disabled={pending}
            aria-invalid={invalid}
            aria-describedby={
              invalid ? "warmane-help character-error" : "warmane-help"
            }
            onChange={(event) =>
              onChange({ ...value, name: event.target.value })
            }
            placeholder={t("armoryNamePlaceholder")}
          />
        </div>
        <div className="import-input-section">
          <label htmlFor="warmane-realm">{t("realm")}</label>
          <Select
            id="warmane-realm"
            aria-label={t("realm")}
            value={value.realm}
            disabled={pending}
            onValueChange={(realm) => onChange({ ...value, realm })}
          >
            {warmaneRealms.map((realm) => (
              <SelectOption key={realm} value={realm}>
                {realm}
              </SelectOption>
            ))}
          </Select>
        </div>
      </div>
      <p id="warmane-help" className="small muted">
        {t("armoryHelp")}
      </p>
      <p className="small muted">{t("armoryPresetHelp")}</p>
    </form>
  );
}
