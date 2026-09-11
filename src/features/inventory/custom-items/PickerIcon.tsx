export function PickerIcon({
  name,
  size = 18,
}: {
  name: "plus" | "search" | "arrow" | "lock" | "trash";
  size?: number;
}) {
  const paths = {
    plus: "M12 5v14M5 12h14",
    search: "m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
    arrow: "M4 12h16m-6-6 6 6-6 6",
    lock: "M6 10h12v11H6ZM8 10V6a4 4 0 0 1 8 0v4",
    trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7",
  };
  return (
    <svg
      className="shrink-0"
      width={size}
      height={size}
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
