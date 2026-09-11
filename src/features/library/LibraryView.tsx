"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Select, SelectOption } from "@/components/ui/Select";
import { ToolIcon, FutureTag } from "@/features/shell/ToolIcon";
import type { LibraryCharacter } from "@/domain/accounts/contracts";
import { Pagination } from "@/components/ui/Pagination";
import { Button } from "@/components/ui/Button";
import { useAccount } from "@/features/auth/AuthProvider";
import { SignInDialog } from "@/features/auth/SignInDialog";
import { CharacterPortrait } from "@/features/inventory/CharacterPortrait";
import { listSpecs } from "@/features/settings/registry";
import { accountResponseError, useLibrary } from "./use-library";
import { DeleteReportDialog } from "./DeleteReportDialog";
import "./library.css";
const specs = listSpecs();
const libraryTools = [
  { icon: "trainer", name: "Raid Trainer" },
  { icon: "raid", name: "Raid Upgrades" },
  { icon: "balance", name: "Gear Balance" },
  { icon: "talents", name: "Talent Lab" },
  { icon: "logs", name: "Log Review" },
] as const;
function characterKey(entry: Pick<LibraryCharacter, "name" | "classKey">) {
  return JSON.stringify([entry.name, entry.classKey]);
}
function LibraryIcon({ name }: { name: "search" | "arrow" | "clock" }) {
  const paths = {
    search: "m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
    arrow: "M4 12h16m-6-6 6 6-6 6",
    clock: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  };
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
export function LibraryView() {
  const auth = useAccount();
  return <LibraryContent key={`${auth.status}:${auth.account?.id ?? ""}`} />;
}
function LibraryContent() {
  const auth = useAccount(),
    t = useTranslations("library"),
    locale = useLocale(),
    router = useRouter();
  const [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [cursors, setCursors] = useState<Array<string | undefined>>([undefined]),
    [signIn, setSignIn] = useState(false),
    [opening, setOpening] = useState<string | null>(null),
    [openError, setOpenError] = useState<string | null>(null);
  const [character, setCharacter] = useState("");
  const [specFilter, setSpecFilter] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const heading = useRef<HTMLHeadingElement>(null);
  const [deletionRevision, setDeletionRevision] = useState(0);
  useEffect(() => {
    if (deletionRevision) heading.current?.focus({ preventScroll: true });
  }, [deletionRevision]);
  const mounted = useRef(true),
    openingRef = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (search.trim() === query) return;
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setCursors([undefined]);
    }, 200);
    return () => clearTimeout(timer);
  }, [search, query]);
  const [characterName, characterClass] = character
    ? (JSON.parse(character) as [string, string])
    : ["", ""];
  const { data, pending, error, refresh } = useLibrary({
    search: query,
    character: characterName || undefined,
    classKey: characterClass || undefined,
    spec: specFilter || undefined,
    sort,
    cursor: cursors.at(-1),
  });
  const isAccount = auth.status === "authenticated";
  async function openReport(id: string) {
    if (openingRef.current) return;
    openingRef.current = true;
    setOpening(id);
    setOpenError(null);
    try {
      const response = await fetch(
        `/api/library/${encodeURIComponent(id)}/open`,
        { credentials: "same-origin", cache: "no-store" },
      );
      if (!response.ok) {
        const code = await accountResponseError(response);
        if (mounted.current) setOpenError(code);
        return;
      }
      const result = await response.json();
      if (
        typeof result.reportPath !== "string" ||
        !/^\/reports\/[A-Za-z0-9_-]+$/.test(result.reportPath)
      )
        throw new Error("invalid path");
      if (mounted.current) router.push(result.reportPath);
    } catch {
      if (mounted.current) setOpenError("AUTH_UNAVAILABLE");
    } finally {
      openingRef.current = false;
      if (mounted.current) setOpening(null);
    }
  }
  const characters = data?.characters ?? [];
  // Keep the chosen label readable if another tab removes its last report.
  const selectedCharacter =
    characters.find((entry) => characterKey(entry) === character) ??
    (character
      ? {
          name: characterName,
          classKey: characterClass,
          count: 0,
          specKeys: [],
          lastSavedAt: "",
        }
      : undefined);
  const characterOptions =
    selectedCharacter &&
    !characters.some((entry) => characterKey(entry) === character)
      ? [...characters, selectedCharacter]
      : characters;
  const total = data?.total ?? data?.items.length ?? 0;
  const filteredTotal = data?.filteredTotal ?? data?.items.length ?? 0;
  const availableSpecKeys = new Set(
    (selectedCharacter ? [selectedCharacter] : characters).flatMap(
      (entry) => entry.specKeys,
    ),
  );
  const availableSpecs = specs.filter(
    (entry) => availableSpecKeys.has(entry.id) || entry.id === specFilter,
  );
  const latestSavedAt =
    selectedCharacter?.lastSavedAt ?? characters[0]?.lastSavedAt;
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
      new Date(value),
    );
  function chooseCharacter(value: string) {
    setCharacter(value);
    setSpecFilter("");
    setCursors([undefined]);
  }
  const clearFilters = () => {
    setSearch("");
    setQuery("");
    setSpecFilter("");
    chooseCharacter("");
  };
  const hasFilters = !!(query || character || specFilter);
  const empty = data?.items.length === 0;
  return (
    <section id="content" className="library-view">
      <header className="library-heading">
        <div>
          <h1 ref={heading} tabIndex={-1}>
            {t("title")}
          </h1>
          <p>{t("description")}</p>
        </div>
        <Button
          render={<Link href="/top-gear" />}
          nativeButton={false}
          role="link"
        >
          {t("openGearLab")}
          <LibraryIcon name="arrow" />
        </Button>
      </header>
      <div className="library-tools" role="tablist" aria-label={t("tools")}>
        <button
          type="button"
          id="library-gear-tab"
          role="tab"
          aria-selected="true"
          aria-controls="library-gear-panel"
        >
          <ToolIcon name="gear" />
          Gear Lab
          {isAccount && <span className="library-tab-count">{total}</span>}
        </button>
        {libraryTools.map((tool) => (
          <button
            type="button"
            role="tab"
            aria-selected="false"
            disabled
            key={tool.icon}
          >
            <ToolIcon name={tool.icon} />
            {tool.name}
            <FutureTag />
          </button>
        ))}
      </div>
      <div
        id="library-gear-panel"
        role="tabpanel"
        aria-labelledby="library-gear-tab"
      >
        {auth.status === "anonymous" ? (
          <div className="library-empty">
            <h2>{t("signedOut")}</h2>
            <p>{t("signedOutDescription")}</p>
            <Button onClick={() => setSignIn(true)}>{t("signIn")}</Button>
            <SignInDialog
              open={signIn}
              onOpenChange={setSignIn}
              callbackPath="/library"
            />
          </div>
        ) : auth.status === "unavailable" ? (
          <div className="library-empty" role="alert">
            <p>{t("errors.AUTH_UNAVAILABLE")}</p>
            <Button variant="secondary" onClick={() => void auth.refresh()}>
              {t("retry")}
            </Button>
          </div>
        ) : (
          <div className="library-layout">
            {isAccount && (
              <aside
                className="library-characters"
                aria-label={t("characters")}
              >
                <h2>{t("characters")}</h2>
                <button
                  type="button"
                  className="library-character"
                  aria-pressed={!character}
                  onClick={() => chooseCharacter("")}
                >
                  <span className="library-all-icon">
                    <ToolIcon name="more" />
                  </span>
                  <span className="library-character-copy">
                    <strong>{t("allCharacters")}</strong>
                  </span>
                  <span className="library-character-count">{total}</span>
                </button>
                {characters.map((entry) => (
                  <button
                    type="button"
                    key={characterKey(entry)}
                    className="library-character"
                    aria-pressed={character === characterKey(entry)}
                    onClick={() => chooseCharacter(characterKey(entry))}
                  >
                    <CharacterPortrait className={entry.classKey} />
                    <span className="library-character-copy">
                      <strong>{entry.name}</strong>
                      <small>{t(`classes.${entry.classKey}`)}</small>
                    </span>
                    <span className="library-character-count">
                      {entry.count}
                    </span>
                  </button>
                ))}
              </aside>
            )}
            <div className="library-main">
              {isAccount && (
                <>
                  <div className="library-mobile-character">
                    <Select
                      aria-label={t("characters")}
                      value={character}
                      onValueChange={chooseCharacter}
                    >
                      <SelectOption value="">
                        <span className="library-character-option">
                          <ToolIcon name="more" />
                          <span>
                            <strong>{t("allCharacters")}</strong>
                            <small>{t("reportCount", { count: total })}</small>
                          </span>
                        </span>
                      </SelectOption>
                      {characterOptions.map((entry) => (
                        <SelectOption
                          key={characterKey(entry)}
                          value={characterKey(entry)}
                        >
                          <span className="library-character-option">
                            <CharacterPortrait className={entry.classKey} />
                            <span>
                              <strong>{entry.name}</strong>
                              <small>
                                {t(`classes.${entry.classKey}`)} ·{" "}
                                {t("reportCount", { count: entry.count })}
                              </small>
                            </span>
                          </span>
                        </SelectOption>
                      ))}
                    </Select>
                  </div>
                  <div className="library-character-heading">
                    {selectedCharacter ? (
                      <CharacterPortrait
                        className={selectedCharacter.classKey}
                      />
                    ) : (
                      <span className="library-all-icon">
                        <ToolIcon name="more" />
                      </span>
                    )}
                    <div>
                      <h2>{selectedCharacter?.name ?? t("allCharacters")}</h2>
                      <p>
                        {selectedCharacter &&
                          `${t(`classes.${selectedCharacter.classKey}`)} · `}
                        {t("reportCount", {
                          count: selectedCharacter?.count ?? total,
                        })}
                      </p>
                    </div>
                    {latestSavedAt && (
                      <span className="library-last-saved">
                        <LibraryIcon name="clock" />
                        {t("lastSaved", { date: formatDate(latestSavedAt) })}
                      </span>
                    )}
                  </div>
                  <div className="library-filters">
                    <div className="library-search">
                      <LibraryIcon name="search" />
                      <input
                        aria-label={t("search")}
                        type="search"
                        maxLength={100}
                        placeholder={t("searchPlaceholder")}
                        value={search}
                        onChange={(event) =>
                          setSearch(event.target.value.slice(0, 100))
                        }
                      />
                    </div>
                    <Select
                      className="library-spec-filter"
                      aria-label={t("specialization")}
                      value={specFilter}
                      onValueChange={(value) => {
                        setSpecFilter(value);
                        setCursors([undefined]);
                      }}
                    >
                      <SelectOption value="">
                        <span className="library-wide-label">
                          {t("allSpecs")}
                        </span>
                        <span className="library-narrow-label">
                          {t("allSpecsShort")}
                        </span>
                      </SelectOption>
                      {availableSpecs.map((entry) => (
                        <SelectOption key={entry.id} value={entry.id}>
                          {entry.name}
                        </SelectOption>
                      ))}
                    </Select>
                    <Select
                      className="library-sort-filter"
                      aria-label={t("sort")}
                      value={sort}
                      onValueChange={(value) => {
                        setSort(value as "newest" | "oldest");
                        setCursors([undefined]);
                      }}
                    >
                      <SelectOption value="newest">{t("newest")}</SelectOption>
                      <SelectOption value="oldest">{t("oldest")}</SelectOption>
                    </Select>
                  </div>
                </>
              )}
              <div className="library-feedback" aria-live="polite">
                {(pending || auth.status === "loading") && (
                  <span role="status">{t("loading")}</span>
                )}
              </div>
              {(error || openError) && (
                <div className="library-error" role="alert">
                  <p>{t(`errors.${error || openError}`)}</p>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setOpenError(null);
                      refresh();
                    }}
                  >
                    {t("retry")}
                  </Button>
                </div>
              )}
              {data && data.items.length > 0 && (
                <>
                  <div className="library-section-heading">
                    <h3>{t("gearReports")}</h3>
                    <p>{t("gainContext")}</p>
                  </div>
                  <ul className="library-list" aria-busy={pending}>
                    {data.items.map((item) => {
                      const spec = specs.find(
                        (entry) => entry.id === item.summary.specKey,
                      );
                      const baseDps =
                        item.summary.gainDps === null
                          ? null
                          : item.summary.dps - item.summary.gainDps;
                      const gainPercent =
                        baseDps !== null && baseDps > 0
                          ? item.summary.gainDps! / baseDps
                          : null;
                      const latest = item.savedAt === latestSavedAt;
                      const context = item.context;
                      const contextParts = context
                        ? [
                            t(
                              context.itemVersion === "original"
                                ? "original"
                                : "classic",
                            ),
                            context.targetCount
                              ? t("targets", { count: context.targetCount })
                              : null,
                            context.duration
                              ? t("duration", { seconds: context.duration })
                              : null,
                          ].filter(Boolean)
                        : [];
                      return (
                        <li key={item.id} className="library-row">
                          <button
                            className="library-open"
                            aria-label={t("openNamed", {
                              name: item.summary.characterName,
                            })}
                            disabled={opening !== null || pending}
                            onClick={() => void openReport(item.id)}
                          >
                            <span className="library-row-portrait">
                              <CharacterPortrait
                                className={item.summary.classKey}
                                talentsString={spec?.talents.talentsString}
                              />
                            </span>
                            <span className="library-item-copy">
                              <span className="library-item-title">
                                {item.summary.characterName}
                                {latest && (
                                  <span className="library-latest">
                                    {t("latest")}
                                  </span>
                                )}
                              </span>
                              <span className="library-item-context">
                                <ToolIcon name="gear" />
                                Gear Lab · {spec?.name ?? t("report")}
                                {spec &&
                                  ` ${t(`classes.${item.summary.classKey}`)}`}
                                {context?.combinations != null &&
                                  ` · ${t("combinations", { count: context.combinations })}`}
                              </span>
                              <span className="library-item-detail">
                                {contextParts.length
                                  ? contextParts.join(" · ")
                                  : item.title !== item.summary.characterName
                                    ? item.title
                                    : t("created", {
                                        date: formatDate(item.createdAt),
                                      })}
                              </span>
                            </span>
                            <span className="library-metric">
                              <strong>
                                {new Intl.NumberFormat(locale, {
                                  minimumFractionDigits: 1,
                                  maximumFractionDigits: 1,
                                }).format(item.summary.dps)}
                              </strong>
                              <small
                                className={
                                  gainPercent === null
                                    ? ""
                                    : gainPercent >= 0
                                      ? "library-gain"
                                      : "library-loss"
                                }
                              >
                                DPS
                                {gainPercent !== null &&
                                  ` · ${new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2, signDisplay: "exceptZero" }).format(gainPercent)}`}
                              </small>
                              <time dateTime={item.savedAt}>
                                {formatDate(item.savedAt)}
                              </time>
                            </span>
                            <span
                              className={`library-open-arrow${latest ? " library-gain" : ""}`}
                            >
                              <LibraryIcon name="arrow" />
                            </span>
                          </button>
                          <DeleteReportDialog
                            item={item}
                            onDeleted={() => {
                              refresh();
                              setDeletionRevision((value) => value + 1);
                            }}
                          />
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
              {empty && !error && !pending && (
                <div className="library-empty">
                  <h2>
                    {t(
                      cursors.length > 1
                        ? "pageEmpty"
                        : hasFilters
                          ? "searchEmpty"
                          : "empty",
                    )}
                  </h2>
                  <p>
                    {t(
                      cursors.length > 1
                        ? "pageEmptyDescription"
                        : hasFilters
                          ? "searchEmptyDescription"
                          : "emptyDescription",
                    )}
                  </p>
                  {hasFilters && (
                    <Button variant="secondary" onClick={clearFilters}>
                      {t("clearFilters")}
                    </Button>
                  )}
                </div>
              )}
              {data &&
                (filteredTotal > 0 ||
                  cursors.length > 1 ||
                  data.nextCursor) && (
                  <Pagination
                    label={t("pagination")}
                    page={cursors.length}
                    pending={pending}
                    hasPrevious={cursors.length > 1}
                    hasNext={!error && !!data.nextCursor}
                    onPrevious={() => setCursors((value) => value.slice(0, -1))}
                    onNext={() =>
                      setCursors((value) => [...value, data.nextCursor!])
                    }
                    range={{
                      start: data.items.length
                        ? (cursors.length - 1) * (data.pageSize ?? 20) + 1
                        : 0,
                      end: data.items.length
                        ? (cursors.length - 1) * (data.pageSize ?? 20) +
                          data.items.length
                        : 0,
                      total: filteredTotal,
                    }}
                  />
                )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
