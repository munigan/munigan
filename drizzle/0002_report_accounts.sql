CREATE TABLE account_lifecycle (
  user_id text PRIMARY KEY REFERENCES auth_user(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','deleting')),
  deletion_requested_at timestamptz
);

CREATE FUNCTION create_account_lifecycle() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO account_lifecycle(user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER auth_user_create_lifecycle
AFTER INSERT ON auth_user
FOR EACH ROW EXECUTE FUNCTION create_account_lifecycle();

INSERT INTO account_lifecycle(user_id)
SELECT id FROM auth_user
ON CONFLICT DO NOTHING;

CREATE FUNCTION enforce_active_session_account() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  lifecycle_status text;
BEGIN
  SELECT status INTO lifecycle_status
    FROM account_lifecycle
   WHERE user_id = NEW.user_id
   FOR KEY SHARE;
  IF lifecycle_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'auth sessions require an active account lifecycle';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER auth_session_active_account
BEFORE INSERT ON auth_session
FOR EACH ROW EXECUTE FUNCTION enforce_active_session_account();

ALTER TABLE tg_jobs ADD COLUMN account_id text REFERENCES auth_user(id) ON DELETE SET NULL;
ALTER TABLE tg_jobs ADD COLUMN deleted_at timestamptz;
ALTER TABLE tg_jobs ADD COLUMN scrubbed_at timestamptz;
ALTER TABLE tg_jobs ADD COLUMN published_at timestamptz;
CREATE INDEX tg_jobs_account_created ON tg_jobs(account_id, created_at);

ALTER TABLE tg_jobs ALTER COLUMN request DROP NOT NULL;
ALTER TABLE tg_jobs ALTER COLUMN policy DROP NOT NULL;
ALTER TABLE tg_jobs ALTER COLUMN token_cipher DROP NOT NULL;
ALTER TABLE tg_jobs ADD CONSTRAINT tg_jobs_scrubbed_payload
CHECK (
  (request IS NOT NULL AND policy IS NOT NULL AND token_cipher IS NOT NULL)
  OR (deleted_at IS NOT NULL AND scrubbed_at IS NOT NULL AND settled)
);

ALTER TABLE tg_jobs DROP CONSTRAINT tg_jobs_prior_job_fkey;
ALTER TABLE tg_jobs ADD CONSTRAINT tg_jobs_prior_job_fkey
FOREIGN KEY (prior_job) REFERENCES tg_jobs(id) ON DELETE SET NULL;

CREATE TABLE library_items (
  id uuid PRIMARY KEY,
  user_id text NOT NULL REFERENCES auth_user(id),
  job_id uuid NOT NULL UNIQUE REFERENCES tg_jobs(id),
  tool text NOT NULL CHECK(tool='top-gear'),
  kind text NOT NULL CHECK(kind='report'),
  title text NOT NULL CHECK(length(title)<=160),
  character_name text NOT NULL CHECK(length(character_name)<=80),
  summary jsonb NOT NULL CHECK(octet_length(summary::text)<=4096),
  created_at timestamptz NOT NULL,
  saved_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX library_user_page ON library_items(user_id,saved_at DESC,id DESC)
WHERE deleted_at IS NULL;

CREATE TABLE report_save_intents (
  token_hash text PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES tg_jobs(id) ON DELETE CASCADE,
  owner_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes',
  completed_at timestamptz,
  completed_by text REFERENCES auth_user(id) ON DELETE SET NULL
);
CREATE INDEX save_intent_expiry ON report_save_intents(expires_at);
