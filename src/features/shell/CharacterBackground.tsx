"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { characterBackground } from "./background-theme";

const BackgroundContext = createContext<{
  register: (owner: string, theme: string, path: string) => () => void;
  path: string;
} | null>(null);

export function BackgroundProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [entries, setEntries] = useState<
    Record<string, { theme: string; path: string }>
  >({});
  const register = useCallback((owner: string, theme: string, path: string) => {
    setEntries((current) => ({ ...current, [owner]: { theme, path } }));
    return () =>
      setEntries((current) => {
        const next = { ...current };
        delete next[owner];
        return next;
      });
  }, []);
  const context = useMemo(
    () => ({ register, path: pathname }),
    [register, pathname],
  );
  const theme =
    Object.values(entries).findLast((entry) => entry.path === pathname)
      ?.theme ?? "naxxramas";
  const isHome = ["/", "/en-us", "/pt-br"].includes(pathname);
  const hasCharacterArtwork =
    pathname === "/gear-lab" || pathname.startsWith("/reports/");
  return (
    <BackgroundContext.Provider value={context}>
      {isHome && <div className="home-artwork" aria-hidden="true" />}
      {hasCharacterArtwork && (
        <div
          className="workbench-backdrop"
          aria-hidden="true"
          data-theme={theme}
        >
          <picture>
            <source
              media="(max-width: 767px)"
              type="image/avif"
              srcSet={`/images/backgrounds/${theme}-960.avif`}
            />
            <source
              media="(max-width: 767px)"
              type="image/webp"
              srcSet={`/images/backgrounds/${theme}-960.webp`}
            />
            <source
              type="image/avif"
              srcSet={`/images/backgrounds/${theme}-1672.avif`}
            />
            {/* Native picture chooses one already optimized decorative asset. */}
            <img
              src={`/images/backgrounds/${theme}-1672.webp`}
              alt=""
              width={1672}
              height={941}
              decoding="async"
            />
          </picture>
        </div>
      )}
      {children}
    </BackgroundContext.Provider>
  );
}

/** Mounted only while this character is visible; navigation restores the fallback. */
export function CharacterBackground({ specId }: { specId?: string | null }) {
  const context = useContext(BackgroundContext);
  const register = context?.register;
  const path = context?.path ?? "";
  const owner = useId();
  const theme = characterBackground(specId);
  useEffect(() => {
    if (theme !== "naxxramas") return register?.(owner, theme, path);
  }, [register, owner, theme, path]);
  return null;
}
