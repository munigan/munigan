"use client";
import { Menu } from "@base-ui/react/menu";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useAccount } from "./AuthProvider";
import { DiscordIcon } from "./DiscordIcon";
import { SignInDialog } from "./SignInDialog";

export function AccountMenu({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const auth = useAccount();
  const t = useTranslations("auth");
  const pathname = usePathname();
  const [signInOpen, setSignInOpen] = useState(false);
  const [callbackPath, setCallbackPath] = useState(pathname);
  const className = mobile ? "auth-control auth-control-mobile" : "auth-control";

  if (auth.status === "loading") return <div className={`${className} auth-loading`} aria-label={t("loading")} />;
  if (auth.status === "unavailable") return <div className={className}><button className="auth-utility-button" onClick={() => void auth.refresh()}>{t("retry")}</button></div>;
  if (auth.status === "anonymous") return (
    <div className={className}>
      <button className="auth-utility-button auth-sign-in" onClick={() => { setCallbackPath(`${window.location.pathname}${window.location.search}${window.location.hash}`); setSignInOpen(true); }}><DiscordIcon />{t("signIn")}</button>
      <SignInDialog open={signInOpen} onOpenChange={setSignInOpen} callbackPath={callbackPath} />
    </div>
  );
  const account = auth.account!;
  return (
    <div className={className}>
      {mobile && <Link className="auth-mobile-library" href="/library" onClick={onNavigate}>{t("library")}</Link>}
      <Menu.Root>
        <Menu.Trigger className="auth-account-trigger" aria-label={t("accountMenu")}>
          {account.image ? <Image src={account.image} alt="" width={32} height={32} unoptimized /> : <span>{account.name.slice(0, 1).toUpperCase()}</span>}
          <strong>{account.name}</strong>
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner className="auth-menu-positioner" sideOffset={8} align="end">
            <Menu.Popup className="auth-menu">
              <div className="auth-menu-profile"><span className="auth-avatar">{account.name.slice(0, 1).toUpperCase()}</span><div><strong>{account.name}</strong><small>{t("discordAccount")}</small></div></div>
              <Menu.Item className="auth-menu-item" render={<Link href="/library" />} onClick={onNavigate}>{t("library")}</Menu.Item>
              <Menu.Item className="auth-menu-item" onClick={() => void auth.signOut()}>{t("signOut")}</Menu.Item>
              <Menu.Item className="auth-menu-item auth-menu-danger" onClick={() => window.dispatchEvent(new CustomEvent("munigan:account-delete-request"))}>{t("deleteAccount")}</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </div>
  );
}
