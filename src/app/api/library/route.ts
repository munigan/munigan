import { NextRequest, NextResponse } from "next/server";
import type { LibraryQuery } from "@/domain/accounts/contracts";
import { accountFailure, accountHeaders } from "@/server/auth/errors";
import { getIdentity, requireAccount } from "@/server/auth/identity";
import { listLibrary } from "@/server/library/repository";

export async function GET(request: NextRequest) {
  try {
    const account = requireAccount(await getIdentity(request));
    const search = request.nextUrl.searchParams.get("search") ?? undefined;
    const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;
    const tool = request.nextUrl.searchParams.get("tool") ?? undefined;
    const query: LibraryQuery = {
      character: request.nextUrl.searchParams.get("character") ?? undefined,
      classKey: request.nextUrl.searchParams.get("classKey") ?? undefined,
      spec: request.nextUrl.searchParams.get("spec") ?? undefined,
      sort: (request.nextUrl.searchParams.get("sort") ??
        undefined) as LibraryQuery["sort"],
      search,
      cursor,
      tool: tool as LibraryQuery["tool"],
    };
    return NextResponse.json(await listLibrary(account.id, query), {
      headers: accountHeaders,
    });
  } catch (error) {
    return accountFailure(error);
  }
}
