-- Company knowledge that the AI may use (products, prices, FAQs, scripts, objection answers...)
-- campaign_code NULL = general knowledge for every campaign
CREATE TABLE IF NOT EXISTS ai_knowledge (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_code text,
  title         text NOT NULL,
  content       text NOT NULL,
  active        boolean NOT NULL DEFAULT true,
  created_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_knowledge_campaign_idx ON ai_knowledge (campaign_code) WHERE active;

-- Last analysis per lead + language (so opening the lead again does not call Gemini again)
CREATE TABLE IF NOT EXISTS lead_ai_analyses (
  lead_id    uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  lang       text NOT NULL,
  input_hash text NOT NULL,
  result     jsonb NOT NULL,
  model      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lead_id, lang)
);
