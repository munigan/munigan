import {
  PRO_CONSENT_VERSION,
  proLaunchSources,
  type JoinProLaunchInput,
  type ProLaunchLocale,
  type ProLaunchSource,
} from "@/domain/pro-launch/contracts";
import { AccountError } from "@/server/auth/errors";

export function parseJoinProLaunchInput(
  fields: Record<string, unknown>,
): JoinProLaunchInput {
  const validKeys = ["expectedUserId", "source", "locale", "consentVersion"];
  if (
    Object.keys(fields).length !== validKeys.length ||
    !validKeys.every((key) => Object.hasOwn(fields, key)) ||
    typeof fields.expectedUserId !== "string" ||
    fields.expectedUserId.length < 1 ||
    fields.expectedUserId.length > 256 ||
    !proLaunchSources.includes(fields.source as ProLaunchSource) ||
    !["en-US", "pt-BR"].includes(fields.locale as ProLaunchLocale) ||
    fields.consentVersion !== PRO_CONSENT_VERSION
  ) {
    throw new AccountError("INVALID_REQUEST", 400);
  }

  return fields as JoinProLaunchInput;
}
