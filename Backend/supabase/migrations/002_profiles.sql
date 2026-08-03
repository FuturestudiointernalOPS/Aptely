-- =============================================================================
-- 002_profiles.sql — Table profiles (extension de auth.users)
-- Dépend de : 001_enums.sql
-- Note : la FK vers institutions sera ajoutée dans 003_institutions.sql
--        via ALTER TABLE pour éviter la dépendance circulaire.
-- =============================================================================

CREATE TABLE profiles (
  -- Même ID que auth.users : clé primaire ET clé étrangère
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  full_name     TEXT,
  avatar_url    TEXT,
  role          user_role NOT NULL DEFAULT 'CANDIDATE',
  -- institution_id ajouté dans 003_institutions.sql (dépendance circulaire évitée)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index sur email pour les lookups rapides lors de l'auth
CREATE INDEX idx_profiles_email ON profiles(email);

-- Index sur role pour filtrer HR vs CANDIDATE rapidement
CREATE INDEX idx_profiles_role ON profiles(role);

-- ──────────────────────────────────────────────────────────────
-- Trigger : crée automatiquement un profil à chaque inscription
-- Supabase appelle auth.signUp() → insère dans auth.users
-- → ce trigger insère automatiquement dans public.profiles
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER  -- s'exécute avec les droits du créateur (bypass RLS)
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    -- Le frontend passe full_name et role dans les metadata au moment du register
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(
      (NEW.raw_user_meta_data->>'role')::user_role,
      'CANDIDATE'  -- valeur par défaut si non spécifié
    )
  );
  RETURN NEW;
END;
$$;

-- Attache la fonction au moment de l'INSERT dans auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ──────────────────────────────────────────────────────────────
-- Trigger : met à jour updated_at automatiquement
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
