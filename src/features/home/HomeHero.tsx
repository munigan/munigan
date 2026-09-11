import { useTranslations } from "next-intl";
export function HomeHero() {
  const t = useTranslations("home");
  return (
    <section className="home-hero">
      <p className="home-eyebrow">{t("welcome")}</p>
      <h1>
        {t("titleFirst")}
        <br />
        {t("titleLast")}
      </h1>
      <p className="home-introduction">
        {t("introFirst")}
        <br />
        {t("introLast")}
      </p>
    </section>
  );
}
