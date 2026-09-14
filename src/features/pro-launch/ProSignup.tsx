"use client";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { PublicAccount } from "@/domain/accounts/contracts";
import { Button } from "@/components/ui/Button";
import { DiscordIcon } from "@/features/auth/DiscordIcon";

function Account({ account }: { account: PublicAccount }) {
  const t = useTranslations("pro");
  return (
    <div className="pro-account">
      {account.image ? (
        <Image
          className="pro-avatar"
          src={account.image}
          alt=""
          width={36}
          height={36}
          unoptimized
        />
      ) : (
        <span className="pro-avatar" aria-hidden="true">
          {account.name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="pro-account-copy">
        <strong>{account.name}</strong>
        <small>{t("discordAccount")}</small>
      </span>
    </div>
  );
}

export function ProSignup({
  account,
  joining,
  error,
  onSignIn,
  onJoin,
}: {
  account: PublicAccount | null;
  joining: boolean;
  error: string | null;
  onSignIn(): void;
  onJoin(): void;
}) {
  const t = useTranslations("pro");
  return (
    <section className="pro-signup">
      <div className="pro-offer">
        <h3>{t("offerTitle")}</h3>
        <p>{t("offerBody")}</p>
      </div>
      {account ? (
        <div className="pro-account-action">
          <Account account={account} />
          <Button className="pro-primary" disabled={joining} onClick={onJoin}>
            {t(joining ? "joining" : "join")}
          </Button>
          {joining && (
            <span className="sr-only" role="status">
              {t("joining")}
            </span>
          )}
        </div>
      ) : (
        <>
          <p className="pro-anonymous-body">{t("anonymousBody")}</p>
          <Button className="pro-primary" disabled={joining} onClick={onSignIn}>
            <span>{t(joining ? "signingIn" : "continueDiscord")}</span>
            <DiscordIcon />
          </Button>
          <p className="pro-return-note">{t("returnNotice")}</p>
        </>
      )}
      {error && (
        <p className="pro-error" role="alert">
          {error}
        </p>
      )}
      <p className="pro-consent">
        {account && t("consent")}
        <span>{t("noPayment")}</span>
      </p>
    </section>
  );
}

export { Account as ProAccount };
