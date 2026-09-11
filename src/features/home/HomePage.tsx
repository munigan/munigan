import { HomeHero } from "./HomeHero";
import { FeaturedTool } from "./FeaturedTool";
import { FutureTools } from "./FutureTools";
import "./home.css";
export function HomePage({
  structuredData,
}: {
  structuredData: Record<string, unknown>;
}) {
  return (
    <div id="content" className="home-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <div className="home-artwork" aria-hidden="true" />
      <HomeHero />
      <FeaturedTool />
      <FutureTools />
    </div>
  );
}
