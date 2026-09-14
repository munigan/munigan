CREATE TABLE pro_launch_memberships (
  user_id text PRIMARY KEY REFERENCES auth_user(id) ON DELETE CASCADE,
  discord_account_id text NOT NULL UNIQUE,
  source text NOT NULL CHECK (source IN ('header','gear_limit','iterations_limit')),
  locale text NOT NULL CHECK (locale IN ('en-US','pt-BR')),
  consent_version text NOT NULL CHECK (consent_version = 'pro-discord-launch-v1'),
  offer_version text NOT NULL CHECK (offer_version = 'pro-launch-v1'),
  joined_at timestamptz NOT NULL DEFAULT now()
);
