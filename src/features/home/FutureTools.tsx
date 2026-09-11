import { useTranslations } from "next-intl";
import { FutureTag, ToolIcon } from "@/features/shell/ToolIcon";
import { futureTools } from "@/features/shell/tools";

export function FutureTools() {
  const t = useTranslations("home");
  return (
    <section className="home-future" aria-labelledby="future-tools-title">
      <div className="home-future-heading">
        <h2 id="future-tools-title">{t("more")}</h2>
        <span>{t("planned")}</span>
      </div>
      <ul>
        {futureTools.map((tool) => (
          <li key={tool.id}>
            <ToolIcon name={tool.id} width="25" height="25" />
            <h3>{tool.name}</h3>
            <p>{t(tool.id)}</p>
            <FutureTag />
          </li>
        ))}
      </ul>
    </section>
  );
}
