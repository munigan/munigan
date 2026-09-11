"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { useAccount } from "@/features/auth/AuthProvider";
import { SignInDialog } from "@/features/auth/SignInDialog";
import { CharacterPortrait } from "@/features/inventory/CharacterPortrait";
import { listSpecs } from "@/features/settings/registry";
import { accountResponseError, useLibrary } from "./use-library";
import { DeleteReportDialog } from "./DeleteReportDialog";
import "./library.css";
const specs = listSpecs();
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
  const { data, pending, error, refresh } = useLibrary({
    search: query,
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
  const empty = data?.items.length === 0;
  return (
    <section id="content" className="library-view">
      <header className="library-heading">
        <div>
          <p className="library-eyebrow">{t("private")}</p>
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
        </Button>
      </header>
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
        <>
          {isAccount && (
            <div className="library-search">
              <label htmlFor="library-search">{t("search")}</label>
              <input
                id="library-search"
                type="search"
                maxLength={100}
                placeholder={t("searchPlaceholder")}
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value.slice(0, 100))
                }
              />
            </div>
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
            <div className="library-list" aria-busy={pending}>
              <div className="library-columns" aria-hidden="true">
                <span>{t("savedItem")}</span>
                <span>{t("summary")}</span>
                <span>{t("saved")}</span>
                <span />
              </div>
              <ul>
                {data.items.map((item) => {
                  const spec = specs.find(
                    (spec) => spec.id === item.summary.specKey,
                  );
                  return (
                    <li key={item.id} className="library-row">
                      <div className="library-item">
                        <CharacterPortrait
                          className={item.summary.classKey}
                          talentsString={spec?.talents.talentsString}
                        />
                        <div>
                          <button
                            className="library-open"
                            aria-label={t("openNamed", {
                              name: item.summary.characterName,
                            })}
                            disabled={opening !== null || pending}
                            onClick={() => void openReport(item.id)}
                          >
                            {item.summary.characterName}
                          </button>
                          <p className="library-item-title">{item.title}</p>
                          <p className="library-item-context">
                            Gear Lab · {t("report")}
                            {spec ? ` · ${spec.name}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="library-metric">
                        <strong>
                          {new Intl.NumberFormat(locale, {
                            maximumFractionDigits: 0,
                          }).format(item.summary.dps)}{" "}
                          <span>DPS</span>
                        </strong>
                        {item.summary.gainDps !== null && (
                          <small>
                            {new Intl.NumberFormat(locale, {
                              maximumFractionDigits: 0,
                              signDisplay: "exceptZero",
                            }).format(item.summary.gainDps)}{" "}
                            DPS {t("gain")}
                          </small>
                        )}
                      </div>
                      <time dateTime={item.savedAt}>
                        {new Intl.DateTimeFormat(locale, {
                          dateStyle: "medium",
                          timeZone: "UTC",
                        }).format(new Date(item.savedAt))}
                      </time>
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
            </div>
          )}
          {empty && !error && !pending && (
            <div className="library-empty">
              <h2>
                {t(
                  cursors.length > 1
                    ? "pageEmpty"
                    : query
                      ? "searchEmpty"
                      : "empty",
                )}
              </h2>
              <p>
                {t(
                  cursors.length > 1
                    ? "pageEmptyDescription"
                    : query
                      ? "searchEmptyDescription"
                      : "emptyDescription",
                )}
              </p>
              {query && (
                <Button variant="secondary" onClick={() => setSearch("")}>
                  {t("clearSearch")}
                </Button>
              )}
            </div>
          )}
          {data && (cursors.length > 1 || data.nextCursor) && (
            <nav className="library-pagination" aria-label={t("pagination")}>
              <Button
                variant="secondary"
                disabled={pending || cursors.length === 1}
                onClick={() => setCursors((value) => value.slice(0, -1))}
              >
                {t("back")}
              </Button>
              <span>{t("page", { number: cursors.length })}</span>
              <Button
                variant="secondary"
                disabled={pending || !!error || !data.nextCursor}
                onClick={() =>
                  setCursors((value) => [...value, data.nextCursor!])
                }
              >
                {t("next")}
              </Button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
