import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";

export type RunSettingIconName = "version" | "settings" | "enhancements";

function RunSettingIcon({ name }: { name: RunSettingIconName }) {
  return (
    <svg
      className="run-setting-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === "version" ? (
        <>
          <path d="m12 2 10 5-10 5L2 7l10-5Z" />
          <path d="m2 12 10 5 10-5M2 17l10 5 10-5" />
        </>
      ) : name === "settings" ? (
        <>
          <path d="M5 2v4m0 6v10M12 2v10m0 6v4M19 2v4m0 6v10" />
          <rect x="2" y="6" width="6" height="6" rx="2" />
          <rect x="9" y="12" width="6" height="6" rx="2" />
          <rect x="16" y="6" width="6" height="6" rx="2" />
        </>
      ) : (
        <>
          <path d="M6 3h12l4 6-10 13L2 9l4-6Z" />
          <path d="M2 9h20M9 3 7 9l5 13 5-13-2-6" />
        </>
      )}
    </svg>
  );
}

export function RunSettingRow({
  icon,
  children,
  divider = true,
}: {
  icon: RunSettingIconName;
  children: ReactNode;
  divider?: boolean;
}) {
  return (
    <div className="run-setting-row" data-divider={divider}>
      <RunSettingIcon name={icon} />
      <div className="run-setting-content">{children}</div>
    </div>
  );
}

export function RunSettingAction({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      className="run-setting-action !min-h-0 !justify-between !gap-2 !rounded-none !border-0 !p-0 !text-sm !font-semibold !text-text hover:!bg-transparent hover:!text-action"
      onClick={onClick}
      aria-haspopup="dialog"
    >
      {children}
      <span className="run-setting-arrow" aria-hidden="true">
        →
      </span>
    </Button>
  );
}
