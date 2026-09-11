"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
export function DocumentControls() {
  const pathname = usePathname(),
    t = useTranslations("common"),
    shell = useTranslations("shell");
  useEffect(() => {
    if (pathname === "/gear-lab")
      document.title = `${shell("gearLab")} · munigan.app`;
    else if (pathname.startsWith("/reports/"))
      document.title = `${shell("reportTitle")} · munigan.app`;
  }, [pathname, shell]);
  return (
    <a className="skip-link" href="#content">
      {t("skipContent")}
    </a>
  );
}
