import type { ReactNode } from "react";
export function Keycap({ children }: { children: ReactNode }) {
  return <kbd>{children}</kbd>;
}
export function GameIcon({
  name,
}: {
  name:
    | "play"
    | "pause"
    | "retry"
    | "replay"
    | "volume"
    | "muted"
    | "arrow"
    | "back"
    | "exit"
    | "timer"
    | "help"
    | "close";
}) {
  const paths: Record<typeof name, ReactNode> = {
    play: <path d="m8 5 11 7-11 7Z" />,
    pause: (
      <>
        <path d="M8 5v14M16 5v14" />
      </>
    ),
    retry: (
      <>
        <path d="M4 10a8 8 0 1 1 1 8M4 4v6h6" />
      </>
    ),
    replay: (
      <>
        <path d="M4 10a8 8 0 1 1 1 8M4 4v6h6" />
        <path d="m10 9 5 3-5 3Z" />
      </>
    ),
    volume: (
      <>
        <path d="m11 5-6 4H2v6h3l6 4ZM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14" />
      </>
    ),
    muted: (
      <>
        <path d="m11 5-6 4H2v6h3l6 4ZM16 9l6 6M16 15l6-6" />
      </>
    ),
    back: <path d="M20 12H4m6-6-6 6 6 6" />,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    exit: <path d="M9 3v6H3M15 21v-6h6M3 9l6-6m12 12-6 6" />,
    timer: (
      <>
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l3 2M9 2h6" />
      </>
    ),
    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3h.01" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
  };
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}
