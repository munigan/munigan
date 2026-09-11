import type { AbstractIntlMessages } from "next-intl";
import type { AppLocale } from "./config";
export type MessageArea = "home" | "workbench";
export type Messages = AbstractIntlMessages;
const loaders = {
  "en-US": () => import("./messages-en"),
  "pt-BR": () => import("./messages-pt"),
};
export async function loadMessages(
  locale: AppLocale,
  area: MessageArea,
): Promise<Messages> {
  if (area === "home")
    return (
      await (locale === "en-US"
        ? import("./messages-home-en")
        : import("./messages-home-pt"))
    ).messages;
  const { messages } = await loaders[locale]();
  return messages;
}
