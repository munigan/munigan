import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BackgroundProvider, CharacterBackground } from "./CharacterBackground";

const navigation = vi.hoisted(() => ({ path: "/gear-lab" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.path }));

describe("character artwork lifecycle", () => {
  it("switches with the active spec and restores the fallback on unmount or navigation", async () => {
    const page = (spec?: string) => (
      <BackgroundProvider>
        {spec && <CharacterBackground specId={spec} />}
      </BackgroundProvider>
    );
    const { container, rerender } = render(page());
    const theme = () =>
      container.querySelector("[data-theme]")?.getAttribute("data-theme");
    expect(theme()).toBe("naxxramas");
    rerender(page("warrior:FuryTalents"));
    await waitFor(() => expect(theme()).toBe("warrior-fury"));
    rerender(page("mage:ArcaneTalents"));
    await waitFor(() => expect(theme()).toBe("mage-arcane"));
    rerender(page());
    await waitFor(() => expect(theme()).toBe("naxxramas"));
    rerender(page("deathknight:FrostTalents"));
    await waitFor(() => expect(theme()).toBe("deathknight-frost"));
    navigation.path = "/en-us";
    rerender(page());
    expect(theme()).toBeUndefined();
    navigation.path = "/gear-lab";
  });
});
