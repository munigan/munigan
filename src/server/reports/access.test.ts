import { expect, it } from "vitest";
import { reportAccess } from "./access";

it("does not give the original browser account-owned management after sign-out", () => {
  const access = reportAccess(
    {
      ownerHash: "browser",
      accountId: "account-a",
      deletedAt: null,
      accountDeleting: false,
      retained: true,
      expiresAt: new Date(0),
      eligible: true,
    },
    { account: null, ownerHash: "browser" },
    new Date(),
  );
  expect(access).toMatchObject({
    saved: true,
    effectiveExpiresAt: null,
    canManage: false,
    canSave: false,
  });
});

it("gates anonymous save and account deletion capabilities", () => {
  const expiresAt = new Date("2030-01-01T00:00:00.000Z");
  const anonymous = reportAccess(
    {
      ownerHash: "browser",
      accountId: null,
      deletedAt: null,
      accountDeleting: false,
      retained: false,
      expiresAt,
      eligible: true,
    },
    { account: null, ownerHash: "browser" },
    new Date("2029-01-01T00:00:00.000Z"),
  );
  expect(anonymous).toMatchObject({
    canManage: true,
    canSave: true,
    canDelete: false,
  });

  const account = reportAccess(
    {
      ownerHash: "browser",
      accountId: "account-a",
      deletedAt: null,
      accountDeleting: false,
      retained: true,
      expiresAt,
      eligible: true,
    },
    {
      account: {
        id: "account-a",
        name: "A",
        image: null,
        sessionId: "session",
        authenticatedAt: "2029-01-01T00:00:00.000Z",
      },
      ownerHash: null,
    },
    new Date("2029-01-01T00:00:00.000Z"),
  );
  expect(account).toMatchObject({
    canManage: true,
    canSave: false,
    canDelete: true,
  });
});

it("removes all capabilities from deleted, deleting, or expired reports", () => {
  const base = {
    ownerHash: "browser",
    accountId: null,
    deletedAt: null,
    accountDeleting: false,
    retained: false,
    expiresAt: new Date("2029-01-01T00:00:00.000Z"),
    eligible: true,
  };
  const viewer = { account: null, ownerHash: "browser" };
  for (const record of [
    base,
    {
      ...base,
      expiresAt: new Date("2031-01-01T00:00:00.000Z"),
      deletedAt: new Date(),
    },
    {
      ...base,
      expiresAt: new Date("2031-01-01T00:00:00.000Z"),
      accountDeleting: true,
    },
  ]) {
    expect(
      reportAccess(record, viewer, new Date("2030-01-01T00:00:00.000Z")),
    ).toMatchObject({
      canManage: false,
      canSave: false,
      canDelete: false,
    });
  }
});
