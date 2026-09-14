export const PRO_CONSENT_VERSION = "pro-discord-launch-v1" as const;
export const PRO_OFFER_VERSION = "pro-launch-v1" as const;
export const proLaunchSources = [
  "header",
  "gear_limit",
  "iterations_limit",
] as const;

export type ProLaunchSource = (typeof proLaunchSources)[number];
export type ProLaunchLocale = "en-US" | "pt-BR";
export type ProLaunchMembership = {
  status: "joined";
  joinedAt: string;
  offerVersion: typeof PRO_OFFER_VERSION;
};
export type ProLaunchStatus = { status: "not_joined" } | ProLaunchMembership;
export type JoinProLaunchInput = {
  expectedUserId: string;
  source: ProLaunchSource;
  locale: ProLaunchLocale;
  consentVersion: typeof PRO_CONSENT_VERSION;
};
