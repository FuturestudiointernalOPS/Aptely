-- Super Admins — accès total à la plateforme Aptely
-- Un super admin est un user normal (dans profiles) dont le user_id
-- est inscrit dans cette table. On ne crée jamais un super admin
-- via un endpoint API — uniquement via le dashboard Supabase ou
-- une commande SQL manuelle par l'équipe technique.

CREATE TABLE public.super_admins (
  user_id    UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS : activé, mais seul le super admin lui-même peut lire sa propre ligne.
-- Les opérations d'écriture se font uniquement via service_role (MCP / dashboard).
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY super_admins_select_self ON public.super_admins
  FOR SELECT USING (user_id = (SELECT auth.uid()));

-- Index pour les lookups rapides dans authGuard (appelé à chaque requête authentifiée)
CREATE INDEX idx_super_admins_user_id ON public.super_admins(user_id);
