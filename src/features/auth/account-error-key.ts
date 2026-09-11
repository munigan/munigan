export function accountErrorKey(code: unknown): string {
  switch (code) {
    case "SIGN_IN_REQUIRED":
      return "returnSignIn";
    case "SAVING_UNAVAILABLE":
    case "AUTH_UNAVAILABLE":
      return "saveUnavailable";
    case "OWNER_COOKIE_REQUIRED":
      return "ownerCookieRequired";
    case "NOT_FOUND":
    case "REPORT_EXPIRED":
    case "INTENT_EXPIRED":
      return "reportUnavailable";
    case "REPORT_NOT_READY":
      return "reportNotReady";
    case "CLAIM_CONFLICT":
    case "ACCOUNT_CHANGED":
      return "accountChanged";
    case "ACCOUNT_DELETING":
      return "accountDeleting";
    case "RATE_LIMITED":
      return "saveRateLimited";
    default:
      return "saveFailed";
  }
}
