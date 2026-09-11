import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { localeCookie, homepagePath } from "@/i18n/config";
import { resolveLocale } from "@/i18n/resolve-locale";
export default async function Entry({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = resolveLocale(
    (await cookies()).get(localeCookie)?.value,
    (await headers()).get("accept-language"),
  );
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (Array.isArray(value)) value.forEach((v) => query.append(key, v));
    else if (value !== undefined) query.set(key, value);
  }
  redirect(
    `${homepagePath(locale)}${query.size ? "?" + query.toString() : ""}`,
  );
}
