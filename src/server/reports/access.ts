import type {
  ReportAccess,
  RequestIdentity,
} from "@/domain/accounts/contracts";

export type OwnershipRecord = {
  ownerHash: string;
  accountId: string | null;
  deletedAt: Date | null;
  accountDeleting: boolean;
  retained: boolean;
  expiresAt: Date;
  eligible: boolean;
};

export function reportAccess(
  record: OwnershipRecord,
  identity: RequestIdentity,
  now: Date,
): ReportAccess {
  const owns =
    record.accountId !== null
      ? identity.account?.id === record.accountId
      : identity.ownerHash !== null && identity.ownerHash === record.ownerHash;
  const expired = !record.retained && record.expiresAt <= now;
  const available =
    record.deletedAt === null && !record.accountDeleting && !expired;
  const anonymousOwner = record.accountId === null && owns;
  const accountOwner = record.accountId !== null && owns;

  return {
    saved: record.retained,
    effectiveExpiresAt: record.retained ? null : record.expiresAt.toISOString(),
    anonymousExpiresAt: record.expiresAt.toISOString(),
    canManage: available && owns,
    canSave: available && anonymousOwner && record.eligible,
    canDelete: available && accountOwner && record.retained,
  };
}
