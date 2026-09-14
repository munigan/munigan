import type { AccountIdentity } from "@/domain/accounts/contracts";
import {
  PRO_CONSENT_VERSION,
  PRO_OFFER_VERSION,
  type JoinProLaunchInput,
  type ProLaunchMembership,
  type ProLaunchStatus,
} from "@/domain/pro-launch/contracts";
import { lockActiveAccount } from "@/server/auth/account-lock";
import { AccountError } from "@/server/auth/errors";
import { transaction } from "@/server/db/client";

type MembershipRow = {
  joined_at: Date;
  offer_version: typeof PRO_OFFER_VERSION;
};

function membershipFromRow(row: MembershipRow): ProLaunchMembership {
  return {
    status: "joined",
    joinedAt: row.joined_at.toISOString(),
    offerVersion: row.offer_version,
  };
}

export async function readProLaunchStatus(
  account: AccountIdentity,
): Promise<ProLaunchStatus> {
  return transaction(async (client) => {
    await lockActiveAccount(client, account.id);
    const result = await client.query<MembershipRow>(
      "SELECT joined_at,offer_version FROM pro_launch_memberships WHERE user_id=$1",
      [account.id],
    );
    return result.rowCount
      ? membershipFromRow(result.rows[0])
      : { status: "not_joined" };
  });
}

export async function joinProLaunchList(
  account: AccountIdentity,
  input: JoinProLaunchInput,
): Promise<ProLaunchMembership> {
  if (account.id !== input.expectedUserId)
    throw new AccountError("ACCOUNT_CHANGED", 409);
  if (input.consentVersion !== PRO_CONSENT_VERSION)
    throw new AccountError("INVALID_REQUEST", 400);

  return transaction(async (client) => {
    await lockActiveAccount(client, account.id);
    const linked = await client.query<{ account_id: string }>(
      "SELECT account_id FROM auth_account WHERE user_id=$1 AND provider_id='discord'",
      [account.id],
    );
    if (linked.rowCount !== 1) throw new AccountError("AUTH_UNAVAILABLE", 503);
    await client.query(
      `INSERT INTO pro_launch_memberships
         (user_id,discord_account_id,source,locale,consent_version,offer_version)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (user_id) DO NOTHING`,
      [
        account.id,
        linked.rows[0].account_id,
        input.source,
        input.locale,
        PRO_CONSENT_VERSION,
        PRO_OFFER_VERSION,
      ],
    );
    const result = await client.query<MembershipRow>(
      "SELECT joined_at,offer_version FROM pro_launch_memberships WHERE user_id=$1",
      [account.id],
    );
    return membershipFromRow(result.rows[0]);
  });
}
