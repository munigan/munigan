export function accountErrorKey(code: unknown): string {
  switch (code) {
    case "SIGN_IN_REQUIRED":
    case "AUTH_UNAVAILABLE":
    case "OWNER_COOKIE_REQUIRED":
    case "NOT_FOUND":
    case "REPORT_EXPIRED":
    case "INTENT_EXPIRED":
    case "REPORT_NOT_READY":
    case "CLAIM_CONFLICT":
    case "ACCOUNT_DELETING":
    case "FRESH_LOGIN_REQUIRED":
    case "ACCOUNT_CHANGED":
    case "SAVING_UNAVAILABLE":
    case "INVALID_REQUEST":
    case "RATE_LIMITED":
      return `errors.${code}`;
    default:
      return "saveFailed";
  }
}
