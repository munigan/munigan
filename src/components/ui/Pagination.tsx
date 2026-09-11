"use client";
import { useTranslations } from "next-intl";
import { Button } from "./Button";
import styles from "./Pagination.module.css";

type SharedProps = {
  range?: { start: number; end: number; total: number };
  pending?: boolean;
  hasNext: boolean;
  label?: string;
};
type PaginationProps = SharedProps &
  (
    | {
        variant?: "pages";
        page: number;
        hasPrevious: boolean;
        onPrevious: () => void;
        onNext: () => void;
      }
    | {
        variant: "load-more";
        onLoadMore: () => void;
      }
  );

/** Controlled navigation: callers own cursors and loaded data; this never changes scroll or focus. */
export function Pagination(props: PaginationProps) {
  const t = useTranslations("common.pagination");
  return (
    <nav
      className={styles.pagination}
      aria-label={props.label ?? t("label")}
      aria-busy={props.pending || undefined}
    >
      {props.range && (
        <span className={styles.summary}>{t("range", props.range)}</span>
      )}
      <div className={styles.controls}>
        {props.variant === "load-more" ? (
          <Button
            variant="secondary"
            disabled={props.pending || !props.hasNext}
            onClick={props.onLoadMore}
          >
            {t("showMore")}
            <Chevron direction="down" />
          </Button>
        ) : (
          <>
            <Button
              variant="secondary"
              disabled={props.pending || !props.hasPrevious}
              onClick={props.onPrevious}
            >
              <Chevron direction="left" />
              {t("previous")}
            </Button>
            <span className={styles.page} aria-current="page">
              {t("page", { number: props.page })}
            </span>
            <Button
              variant="secondary"
              disabled={props.pending || !props.hasNext}
              onClick={props.onNext}
            >
              {t("next")}
              <Chevron direction="right" />
            </Button>
          </>
        )}
      </div>
    </nav>
  );
}
function Chevron({ direction }: { direction: "left" | "right" | "down" }) {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d={
          direction === "left"
            ? "m14 6-6 6 6 6"
            : direction === "right"
              ? "m10 6 6 6-6 6"
              : "m6 9 6 6 6-6"
        }
      />
    </svg>
  );
}
