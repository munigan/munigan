export type AccountIdentity = {
  id: string;
  name: string;
  image: string | null;
  sessionId: string;
  authenticatedAt: string;
};
export type RequestIdentity = {
  account: AccountIdentity | null;
  ownerHash: string | null;
};
export type PublicAccount = Pick<AccountIdentity, "id" | "name" | "image">;
export type AuthMode = "account" | "anonymous";
export type ReportAccess = {
  saved: boolean;
  effectiveExpiresAt: string | null;
  anonymousExpiresAt: string;
  canManage: boolean;
  canSave: boolean;
  canDelete: boolean;
};
export type LibrarySummary = {
  characterName: string;
  classKey: string;
  specKey: string;
  level: number;
  dps: number;
  gainDps: number | null;
};
export type LibraryItem = {
  id: string;
  tool: "top-gear";
  kind: "report";
  title: string;
  summary: LibrarySummary;
  createdAt: string;
  savedAt: string;
};
export type LibraryQuery = {
  search?: string;
  cursor?: string;
  tool?: "top-gear";
};
export type LibraryPage = {
  items: LibraryItem[];
  nextCursor: string | null;
  tools: Array<"top-gear">;
};
export type ClaimResult = { itemId: string; reportPath: string };
export type SaveIntent = { token: string; expiresAt: string };
export type ReportViewState = {
  version: 1;
  reportPath: string;
  locale: "en-US" | "pt-BR";
  cursor: number;
  selectedId: string | null;
  difference: "equipped" | "highest";
  scrollY: number;
};
export type AccountErrorCode =
  | "SIGN_IN_REQUIRED"
  | "AUTH_UNAVAILABLE"
  | "NOT_FOUND"
  | "REPORT_EXPIRED"
  | "OWNER_COOKIE_REQUIRED"
  | "INTENT_EXPIRED"
  | "REPORT_NOT_READY"
  | "CLAIM_CONFLICT"
  | "ACCOUNT_DELETING"
  | "FRESH_LOGIN_REQUIRED"
  | "ACCOUNT_CHANGED"
  | "SAVING_UNAVAILABLE"
  | "INVALID_REQUEST"
  | "RATE_LIMITED";
