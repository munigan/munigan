import { TabsRoot, TabsList, TabsTab } from "@/components/ui/Tabs";
import { Select, SelectOption } from "@/components/ui/Select";
import { useSettingsMobile } from "./SettingsNavigation";
import { SettingsIcon } from "./SettingsIcon";
export function SettingsSegments({
  label,
  value,
  onChange,
  options,
  mobileSelect = false,
}: {
  mobileSelect?: boolean;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; icon: string }[];
}) {
  const mobile = useSettingsMobile();
  if (mobile && mobileSelect)
    return (
      <Select aria-label={label} value={value} onValueChange={onChange}>
        {options.map((o) => (
          <SelectOption key={o.value} value={o.value}>
            {o.label}
          </SelectOption>
        ))}
      </Select>
    );
  return (
    <TabsRoot value={value} onValueChange={(v) => onChange(String(v))}>
      <TabsList className="settings-segments" aria-label={label}>
        {options.map((o) => (
          <TabsTab
            key={o.value}
            value={o.value}
            className="min-h-[34px] py-0 px-3.5 text-[13px] font-normal data-active:font-semibold data-active:bg-[#25282e]"
          >
            <SettingsIcon name={o.icon} size={16} />
            {o.label}
          </TabsTab>
        ))}
      </TabsList>
    </TabsRoot>
  );
}
