import { LibraryView } from "@/features/library/LibraryView";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "My Library",
  robots: { index: false, follow: false },
};
export default function LibraryPage() {
  return <LibraryView />;
}
