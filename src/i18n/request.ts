import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { isLocale, localeCookie } from "./config";
import { resolveLocale } from "./resolve-locale";
import { loadMessages } from "./messages";
export default getRequestConfig(async ({ requestLocale }) => {
  const explicit = await requestLocale;
  const locale = isLocale(explicit)
    ? explicit
    : resolveLocale(
        (await cookies()).get(localeCookie)?.value,
        (await headers()).get("accept-language"),
      );
  return {
    locale,
    messages: await loadMessages(locale, "workbench"),
    timeZone: "UTC",
  };
});
