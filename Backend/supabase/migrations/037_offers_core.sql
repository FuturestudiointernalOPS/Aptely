-- =============================================================================
-- 037_offers_core.sql — Tables pour Offer Core & Versioning (Owner A - Sprint 4)
-- =============================================================================

-- ─── Table offers ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS offers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  status          offer_status NOT NULL DEFAULT 'DRAFT',
  current_version INT NOT NULL DEFAULT 1,
  created_by      UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un seul offer par candidature (on peut lever cette contrainte plus tard)
CREATE UNIQUE INDEX idx_offers_application_id ON offers (application_id);

-- Index par statut pour les listes
CREATE INDEX idx_offers_status ON offers (status);

-- ─── Table offer_versions ─────────────────────────────────────────────────────
-- Chaque modification crée une nouvelle version immutable.
-- Le payload_json contient : position, compensation, start_date, benefits, etc.
CREATE TABLE IF NOT EXISTS offer_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id      UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  version_no    INT NOT NULL,
  payload_json  JSONB NOT NULL DEFAULT '{}'::jsonb,
  change_reason TEXT,
  author_id     UUID NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Contrainte d'unicité : pas deux versions avec le même numéro pour un offer
CREATE UNIQUE INDEX idx_offer_versions_unique
  ON offer_versions (offer_id, version_no);

-- Index pour récupérer l'historique d'un offer
CREATE INDEX idx_offer_versions_offer_created
  ON offer_versions (offer_id, created_at DESC);

-- ─── Trigger pour auto-update updated_at sur offers ──────────────────────────
CREATE OR REPLACE FUNCTION update_offers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_offers_updated_at
  BEFORE UPDATE ON offers
  FOR EACH ROW
  EXECUTE FUNCTION update_offers_updated_at();

-- ─── RLS Policies ─────────────────────────────────────────────────────────────
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on offers"
  ON offers FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on offer_versions"
  ON offer_versions FOR ALL USING (true) WITH CHECK (true);
