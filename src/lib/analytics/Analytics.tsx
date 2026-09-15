"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAccount } from "@/features/auth/AuthProvider";
import { identifyAccount, trackPage } from "./client";
export function Analytics() {
  const pathname = usePathname();
  const { status, account } = useAccount();
  const lastPath = useRef<string | null>(null);
  useEffect(() => {
    if (status === "authenticated") identifyAccount(account?.id ?? null);
    else if (status === "anonymous" || status === "unavailable")
      identifyAccount(null);
  }, [status, account?.id]);
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    trackPage(pathname);
  }, [pathname]);
  return null;
}
