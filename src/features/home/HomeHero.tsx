import Image from "next/image";
import { useTranslations } from "next-intl";
export function HomeHero() {
  const t = useTranslations("home");
  return (
    <section className="home-hero">
      <div className="home-wrath-identity">
        <Image
          src="/images/wrath-logo.png"
          alt="World of Warcraft: Wrath of the Lich King"
          width={222}
          height={100}
          sizes="(max-width: 639px) 190px, 222px"
          loading="eager"
          className="home-wrath-logo"
        />
        <div className="home-wrath-label">
          <p>{t("builtForWrath")}</p>
          <p className="home-wrath-version">WotLK · 3.3.5a</p>
        </div>
      </div>
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
