CREATE TABLE IF NOT EXISTS source_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 source text NOT NULL, record_key text NOT NULL, url text NOT NULL,
 retrieved_at timestamptz NOT NULL DEFAULT now(), digest text NOT NULL,
 payload jsonb NOT NULL, UNIQUE(source, record_key, digest)
);
CREATE TABLE IF NOT EXISTS publications (
 pmid text PRIMARY KEY, doi text NOT NULL, nct text NOT NULL,
 title text NOT NULL, journal text NOT NULL, published text NOT NULL,
 source_id uuid NOT NULL REFERENCES source_versions(id)
);
