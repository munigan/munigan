import type { Metadata } from "next";
import { AuthReturn } from "@/features/auth/AuthReturn";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Discord · munigan.app",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function Page() {
  return <AuthReturn />;
}
