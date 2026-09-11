import { authFlags } from "@/server/auth/config";
import { readAccountSession } from "@/server/auth/identity";
import { accountFailure, accountHeaders } from "@/server/auth/errors";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { account, headers } = await readAccountSession(request, true);
    const response = Response.json(
      {
        account: account
          ? { id: account.id, name: account.name, image: account.image }
          : null,
        ...authFlags(),
      },
      { headers: accountHeaders },
    );
    for (const cookie of headers.getSetCookie())
      response.headers.append("Set-Cookie", cookie);
    return response;
  } catch (error) {
    return accountFailure(error);
  }
}
