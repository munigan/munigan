CREATE TABLE IF NOT EXISTS tg_budgets (
 day date PRIMARY KEY, reserved bigint NOT NULL DEFAULT 0 CHECK(reserved>=0), spent bigint NOT NULL DEFAULT 0 CHECK(spent>=0)
);
CREATE TABLE IF NOT EXISTS tg_jobs (
 id uuid PRIMARY KEY, owner_hash text NOT NULL, intent text NOT NULL, request_hash text NOT NULL,
 token_hash text UNIQUE NOT NULL, token_cipher text NOT NULL,
 request jsonb NOT NULL, policy jsonb NOT NULL, status text NOT NULL DEFAULT 'queued', phase text NOT NULL DEFAULT 'planning',
 plan jsonb, report jsonb, termination text, error text,
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days',
 budget_day date NOT NULL REFERENCES tg_budgets(day), reserved bigint NOT NULL,
 cancel_requested boolean NOT NULL DEFAULT false, lease uuid, lease_until timestamptz,
 settled boolean NOT NULL DEFAULT false, prior_job uuid REFERENCES tg_jobs(id),
 UNIQUE(owner_hash,intent)
);
CREATE INDEX IF NOT EXISTS tg_jobs_ready ON tg_jobs(status,created_at);
CREATE TABLE IF NOT EXISTS tg_work (
 job_id uuid NOT NULL REFERENCES tg_jobs(id) ON DELETE CASCADE, work_key text NOT NULL,
 attempts integer NOT NULL DEFAULT 0, result jsonb, error text, PRIMARY KEY(job_id,work_key)
);
CREATE TABLE IF NOT EXISTS tg_outbox (
 job_id uuid PRIMARY KEY REFERENCES tg_jobs(id) ON DELETE CASCADE,
 dispatched_at timestamptz, attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tg_outbox ADD COLUMN IF NOT EXISTS generation integer NOT NULL DEFAULT 0;
ALTER TABLE tg_jobs ADD COLUMN IF NOT EXISTS source_hash text;

ALTER TABLE tg_jobs ADD COLUMN IF NOT EXISTS deadline_at timestamptz;
