"use client";

import { useEffect } from "react";
import { ROUTES } from "@/lib/routes";
import { useRouter } from "next/navigation";

/**
 * Traite les fragments d'URL envoyés par Supabase Auth (liens par email, reset password, etc.)
 * Supabase envoie: http://localhost:3000/#access_token=...&type=recovery
 * On redirige vers: /reset-password?token_hash=...
 */
export function SupabaseAuthHandler() {
  const router = useRouter();

  useEffect(() => {
    // Vérifier s'il y a un fragment avec access_token
    const fragment = window.location.hash.slice(1); // Enlever le #
    if (!fragment) return;

    const params = new URLSearchParams(fragment);
    const accessToken = params.get("access_token");
    const type = params.get("type");

    if (!accessToken) return;

    if (type === "recovery") {
      window.location.href = `${ROUTES.reset}?token_hash=${encodeURIComponent(accessToken)}`;
    }
  }, [router]);

  return null;
}
