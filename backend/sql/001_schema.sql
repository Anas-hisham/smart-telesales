-- SalesFlow CRM schema. Runs once (tracked in table schema_migrations).
-- Works on Neon and on a local PostgreSQL 13+ (gen_random_uuid is built in).

-- ───────────── people & teams ─────────────
CREATE TABLE users (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username          text NOT NULL,
  name              text NOT NULL,
  email             text NOT NULL,
  password_hash     text NOT NULL,
  role              text NOT NULL CHECK (role IN ('admin','operation_manager','team_leader','agent','quality')),
  team_id           uuid,                       -- agent: his team / team_leader: the team he leads
  initials          text NOT NULL,
  color             text NOT NULL,
  daily_call_target int  NOT NULL DEFAULT 0 CHECK (daily_call_target BETWEEN 0 AND 500),
  lob               text,                       -- operation_manager / quality only (REG, DJ)
  quality_id        uuid REFERENCES users(id) ON DELETE SET NULL,   -- agents only
  active            boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_username_uq ON users (lower(username));
CREATE UNIQUE INDEX users_email_uq    ON users (lower(email));
CREATE INDEX users_team_idx    ON users (team_id);
CREATE INDEX users_quality_idx ON users (quality_id);

CREATE TABLE teams (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  leader_id  uuid NOT NULL,
  manager_id uuid REFERENCES users(id) ON DELETE SET NULL,   -- Operation Manager (optional)
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX teams_name_uq ON teams (lower(btrim(name)));
-- user <-> team point at each other, so both links are checked at COMMIT time
ALTER TABLE users ADD CONSTRAINT users_team_fk   FOREIGN KEY (team_id)   REFERENCES teams(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE teams ADD CONSTRAINT teams_leader_fk FOREIGN KEY (leader_id) REFERENCES users(id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE refresh_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id);

-- ───────────── campaigns & leads ─────────────
CREATE TABLE workflows (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_code text NOT NULL UNIQUE,            -- always stored in UPPER CASE
  name          text NOT NULL,
  touch_points  jsonb NOT NULL,                  -- [{order,type,label,dayOffset}]
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE leads (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_code          text NOT NULL,
  campaign_code      text NOT NULL REFERENCES workflows(campaign_code),
  company_name       text NOT NULL,
  contact_name       text NOT NULL,
  phone              text NOT NULL DEFAULT '',
  email              text NOT NULL,
  status             text NOT NULL DEFAULT 'new' CHECK (status IN ('new','discovery','lvm','nvm','no_response','arranged_meeting')),
  agent_id           uuid REFERENCES users(id),  -- current (or last) holder
  assigned_at        timestamptz NOT NULL DEFAULT now(),
  touch_points       jsonb NOT NULL DEFAULT '[]', -- this round's steps with their status
  current_touch_point int NOT NULL DEFAULT -1,    -- order of the first pending step, -1 = none
  next_due_at        timestamptz,                 -- due date of that step
  stopped            boolean NOT NULL DEFAULT false,
  removed_from_queue boolean NOT NULL DEFAULT true,  -- true = the lead is free in the pool
  removed_at         timestamptz,
  expired_at         timestamptz,                 -- waiting for its Team Leader to reassign it
  round              int NOT NULL DEFAULT 0,
  last_activity_at   timestamptz NOT NULL DEFAULT now(),
  discovery_reached  boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX leads_code_uq     ON leads (lower(lead_code));
CREATE INDEX leads_agent_idx          ON leads (agent_id) WHERE NOT removed_from_queue;
CREATE INDEX leads_campaign_idx       ON leads (campaign_code);
CREATE INDEX leads_activity_idx       ON leads (last_activity_at) WHERE NOT removed_from_queue;

-- every finished round of a lead (who had it, what happened)
CREATE TABLE lead_assignments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  round         int NOT NULL,
  agent_id      uuid NOT NULL REFERENCES users(id),
  agent_name    text NOT NULL,
  assigned_at   timestamptz NOT NULL,
  ended_at      timestamptz NOT NULL DEFAULT now(),
  ended_by      text NOT NULL,                   -- user id or 'system'
  ended_by_name text NOT NULL,
  touch_points  jsonb NOT NULL DEFAULT '[]'
);
CREATE INDEX lead_assignments_lead_idx ON lead_assignments (lead_id);

CREATE TABLE call_logs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id             uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  agent_id            uuid NOT NULL REFERENCES users(id),
  type                text NOT NULL CHECK (type IN ('nvm','lvm','discovery')),
  reason              text CHECK (reason IN ('interested','callback','price','timing','not_interested','wrong_contact','no_answer','voicemail','other')),
  description         text NOT NULL,
  timestamp           timestamptz NOT NULL DEFAULT now(),
  edited_at           timestamptz,
  touch_point_order   int NOT NULL,
  touch_point_label   text,
  round               int NOT NULL
);
CREATE INDEX call_logs_lead_idx  ON call_logs (lead_id);
CREATE INDEX call_logs_agent_idx ON call_logs (agent_id, timestamp);

CREATE TABLE lead_history (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id            uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  action             text NOT NULL,
  timestamp          timestamptz NOT NULL DEFAULT now(),
  user_id            text NOT NULL,              -- user id or 'system'
  user_name          text NOT NULL,
  detail             text,
  round              int,
  agent_id           uuid,
  touch_point_order  int,
  touch_point_label  text,
  touch_point_type   text,
  meta               jsonb
);
CREATE INDEX lead_history_lead_idx ON lead_history (lead_id, timestamp);

-- ───────────── meetings, updates, tasks, tips ─────────────
CREATE TABLE meetings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type             text NOT NULL CHECK (type IN ('lead_meeting','internal_meeting')),
  lead_id          uuid REFERENCES leads(id) ON DELETE SET NULL,
  lead_name        text,
  company_name     text,
  agent_id         uuid REFERENCES users(id),
  participant_ids  uuid[] NOT NULL DEFAULT '{}',
  title            text NOT NULL,
  date             date NOT NULL,                -- Cairo calendar date
  time             text NOT NULL,                -- 'HH:mm' on the Cairo clock
  duration         int  NOT NULL,                -- minutes
  notes            text NOT NULL DEFAULT '',
  outcome          text,
  status           text NOT NULL DEFAULT 'arranged' CHECK (status IN ('arranged','completed','no_show','cancelled','rescheduled')),
  priority         text NOT NULL DEFAULT 'normal' CHECK (priority IN ('high','normal')),
  created_by       uuid NOT NULL REFERENCES users(id),
  reminder_sent_at timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX meetings_lead_idx ON meetings (lead_id);
CREATE INDEX meetings_date_idx ON meetings (date);

CREATE TABLE team_updates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audience        text NOT NULL CHECK (audience IN ('all','team_leaders','quality','specific_team')),
  team_id         uuid REFERENCES teams(id),
  author_id       uuid NOT NULL REFERENCES users(id),
  title           text NOT NULL,
  content         text NOT NULL,
  recipient_ids   uuid[] NOT NULL DEFAULT '{}',
  acknowledged_by uuid[] NOT NULL DEFAULT '{}',
  seen_by         uuid[] NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tasks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id    uuid NOT NULL REFERENCES users(id),
  title        text NOT NULL,
  description  text NOT NULL DEFAULT '',
  deadline     text NOT NULL,
  assigned_to  uuid[] NOT NULL DEFAULT '{}',
  completed_by uuid[] NOT NULL DEFAULT '{}',
  seen_by      uuid[] NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tips (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       uuid NOT NULL REFERENCES users(id),
  agent_id        uuid NOT NULL REFERENCES users(id),
  title           text NOT NULL,
  content         text NOT NULL,
  acknowledged_at timestamptz,
  seen_by         uuid[] NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tips_agent_idx ON tips (agent_id);

-- ───────────── sales, escalations ─────────────
CREATE TABLE sales (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      uuid NOT NULL REFERENCES users(id),
  campaign_code text NOT NULL,
  lead_id       uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  sale_type     text NOT NULL CHECK (sale_type IN ('BP','PPI','MUA','ATEP','Activation','Retention','Transition')),
  date          date NOT NULL,
  created_by    uuid NOT NULL REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sales_agent_date_idx ON sales (agent_id, date);
CREATE INDEX sales_lead_idx       ON sales (lead_id);

CREATE TABLE escalations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id  uuid NOT NULL REFERENCES users(id),
  about_id   uuid NOT NULL REFERENCES users(id),
  title      text NOT NULL,
  details    text NOT NULL,
  handler_id uuid NOT NULL REFERENCES users(id),
  status     text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE escalation_steps (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escalation_id uuid NOT NULL REFERENCES escalations(id) ON DELETE CASCADE,
  at            timestamptz NOT NULL DEFAULT now(),
  by_id         uuid NOT NULL REFERENCES users(id),
  action        text NOT NULL CHECK (action IN ('created','forwarded','resolved')),
  to_id         uuid REFERENCES users(id),
  note          text
);
CREATE INDEX escalation_steps_idx ON escalation_steps (escalation_id, at);

-- ───────────── notifications & safety ─────────────
CREATE TABLE notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       text NOT NULL CHECK (type IN ('meeting','update','task','overdue','email','tip','escalation')),
  title      text NOT NULL,
  message    text NOT NULL,
  timestamp  timestamptz NOT NULL DEFAULT now(),
  read       boolean NOT NULL DEFAULT false,
  lead_id    uuid,
  meeting_id uuid
);
CREATE INDEX notifications_user_idx ON notifications (user_id, timestamp DESC);

-- double-click protection (Idempotency-Key header)
CREATE TABLE idempotency_keys (
  user_id     uuid NOT NULL,
  route       text NOT NULL,
  key         text NOT NULL,
  state       text NOT NULL DEFAULT 'in_progress',
  status_code int,
  response    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, route, key)
);
