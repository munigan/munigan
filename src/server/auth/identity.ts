import type { NextRequest } from "next/server";
import type {
  AccountIdentity,
  RequestIdentity,
} from "@/domain/accounts/contracts";
import { owner } from "@/server/http/api";
import { unlimitedLocalAdmission } from "@/server/jobs/policy";
import { digest } from "@/server/jobs/capabilities";
import { authConfigured, authFlags, getAuth } from "./config";
import { AccountError, authUnavailable } from "./errors";
import { assertActiveAccount } from "./account-lock";

export async function readAccountSession(request: Request, refresh = false) {
  try {
    if (!authConfigured()) {
      const flags = authFlags();
      const hasCookie =
        /(?:^|;\s*)(?:__Secure-)?better-auth\.session_token=/.test(
          request.headers.get("cookie") ?? "",
        );
      const localAnonymous =
        unlimitedLocalAdmission() &&
        !flags.savingEnabled &&
        !flags.enrollmentEnabled;
      if (
        flags.savingEnabled ||
        flags.enrollmentEnabled ||
        (hasCookie && !localAnonymous)
      )
        throw authUnavailable();
      const headers = new Headers();
      if (hasCookie && localAnonymous) {
        // A local preview can outlive its optional OAuth setup. Expire that
        // obsolete login while retaining the independent anonymous owner cookie.
        headers.append(
          "set-cookie",
          "better-auth.session_token=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax",
        );
        headers.append(
          "set-cookie",
          "__Secure-better-auth.session_token=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax; Secure",
        );
      }
      return { account: null, headers };
    }
    const { response, headers } = await getAuth().api.getSession({
      headers: request.headers,
      query: refresh ? undefined : { disableRefresh: true },
      returnHeaders: true,
    });
    if (!response) return { account: null, headers };
    await assertActiveAccount(response.user.id);
    const account: AccountIdentity = {
      id: response.user.id,
      name: response.user.name,
      image: response.user.image ?? null,
      sessionId: response.session.id,
      authenticatedAt: response.session.createdAt.toISOString(),
    };
    return { account, headers };
  } catch (error) {
    if (error instanceof AccountError) throw error;
    throw authUnavailable();
  }
}
export async function getIdentity(
  request: NextRequest,
): Promise<RequestIdentity> {
  const { account } = await readAccountSession(request);
  const key = owner(request);
  return {
    account,
    ownerHash: key && /^[\w-]{43}$/.test(key) ? digest(key) : null,
  };
}
export function requireAccount(identity: RequestIdentity): AccountIdentity {
  if (!identity.account) throw new AccountError("SIGN_IN_REQUIRED", 401);
  return identity.account;
}
