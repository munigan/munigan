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

function AccountMenuIcon({
  name,
}: {
  name: "library" | "arrow" | "signOut" | "delete";
}) {
  const paths = {
    library: "M3 5h5v15H3zM10 5h5v15h-5zM17 6l3-1 3 14-3 1z",
    arrow: "M5 12h14m-5-5 5 5-5 5",
    signOut: "M9 4H4v16h5M13 7l5 5-5 5M8 12h11",
    delete: "M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7",
  };
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}

export function AccountMenu({
  mobile = false,
  showLibrary = true,
  onNavigate,
}: {
  mobile?: boolean;
  showLibrary?: boolean;
  onNavigate?: () => void;
}) {
  const auth = useAccount();
  const t = useTranslations("auth");
  const pathname = usePathname();
  const [signInOpen, setSignInOpen] = useState(false);
  const [callbackPath, setCallbackPath] = useState(pathname);
  const [signOutError, setSignOutError] = useState(false);
  const className = mobile
    ? "auth-control auth-control-mobile"
    : "auth-control";

  if (auth.status === "loading")
    return (
      <div className={`${className} auth-loading`} aria-label={t("loading")} />
    );
  if (auth.status === "unavailable")
    return (
      <div className={className}>
        <span className="sr-only" role="alert">
          {t("errors.AUTH_UNAVAILABLE")}
        </span>
        <button
          className="auth-utility-button"
          onClick={() => void auth.refresh()}
        >
          {t("retry")}
        </button>
      </div>
    );
  if (auth.status === "anonymous")
    return (
      <div className={className}>
        <button
          className="auth-utility-button auth-sign-in"
          onClick={() => {
            setCallbackPath(
              `${window.location.pathname}${window.location.search}${window.location.hash}`,
            );
            setSignInOpen(true);
          }}
        >
          <DiscordIcon />
          {t("signIn")}
        </button>
        <SignInDialog
          open={signInOpen}
          onOpenChange={setSignInOpen}
          callbackPath={callbackPath}
        />
      </div>
    );
  const account = auth.account!;
  async function attemptSignOut() {
    setSignOutError(false);
    try {
      await auth.signOut();
    } catch {
      setSignOutError(true);
    }
  }
  if (mobile)
    return (
      <div className={className}>
        <div className="auth-mobile-profile">
          {account.image ? (
            <Image
              className="auth-avatar"
              src={account.image}
              alt=""
              width={36}
              height={36}
              unoptimized
            />
          ) : (
            <span className="auth-avatar">
              {account.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div>
            <strong>{account.name}</strong>
            <small>{t("discordAccount")}</small>
          </div>
        </div>
        {showLibrary && (
          <Link
            className="auth-mobile-library"
            href="/library"
            onClick={onNavigate}
          >
            {t("library")}
          </Link>
        )}
        <button
          className="auth-mobile-action"
          onClick={() => void attemptSignOut()}
        >
          <AccountMenuIcon name="signOut" />
          {t("signOut")}
        </button>
        <button
          className="auth-mobile-action auth-menu-danger"
          onClick={() => {
            onNavigate?.();
            window.dispatchEvent(
              new CustomEvent("munigan:account-delete-request"),
            );
          }}
        >
          <AccountMenuIcon name="delete" />
          {t("deleteAccount")}
        </button>
        {signOutError && (
          <div className="auth-mobile-error" role="alert">
            <span>{t("signOutFailed")}</span>
            <button onClick={() => void attemptSignOut()}>
              {t("retrySignOut")}
            </button>
          </div>
        )}
      </div>
    );
  return (
    <div className={className}>
      <Menu.Root>
        <Menu.Trigger
          className="auth-account-trigger"
          aria-label={t("accountMenu")}
        >
          {account.image ? (
            <Image
              src={account.image}
              alt=""
              width={32}
              height={32}
              unoptimized
            />
          ) : (
            <span>{account.name.slice(0, 1).toUpperCase()}</span>
          )}
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner
            className="auth-menu-positioner"
            sideOffset={8}
            align="end"
            collisionPadding={12}
          >
            <Menu.Popup className="auth-menu">
              <div className="auth-menu-profile">
                {account.image ? (
                  <Image
                    className="auth-avatar"
                    src={account.image}
                    alt=""
                    width={48}
                    height={48}
                    unoptimized
                  />
                ) : (
                  <span className="auth-avatar" aria-hidden="true">
                    {account.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="auth-menu-identity">
                  <strong>{account.name}</strong>
                  <small>
                    <DiscordIcon />
                    {t("discordAccount")}
                  </small>
                </div>
              </div>
              <div className="auth-menu-library-section">
                <Menu.Item
                  className="auth-menu-item auth-menu-library"
                  render={<Link href="/library" />}
                  onClick={onNavigate}
                >
                  <AccountMenuIcon name="library" />
                  <span>{t("library")}</span>
                  <span className="auth-menu-library-arrow">
                    <AccountMenuIcon name="arrow" />
                  </span>
                </Menu.Item>
                <p>{t("libraryHint")}</p>
              </div>
              <div className="auth-menu-actions">
                <Menu.Item
                  className="auth-menu-item"
                  onClick={() => void attemptSignOut()}
                >
                  <AccountMenuIcon name="signOut" />
                  <span>{t("signOut")}</span>
                </Menu.Item>
                <Menu.Item
                  className="auth-menu-item auth-menu-danger"
                  onClick={() => {
                    onNavigate?.();
                    window.dispatchEvent(
                      new CustomEvent("munigan:account-delete-request"),
                    );
                  }}
                >
                  <AccountMenuIcon name="delete" />
                  <span>{t("deleteAccount")}</span>
                </Menu.Item>
              </div>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      {signOutError && (
        <div className="auth-sign-out-error" role="alert">
          <span>{t("signOutFailed")}</span>
          <button onClick={() => void attemptSignOut()}>
            {t("retrySignOut")}
          </button>
        </div>
      )}
    </div>
  );
}
