# Aptely — Login / Register case (diagnostic)

Date : 2026-10-08

## Symptôme

En local, la création de compte échoue et renvoie toujours sur la page « Créer un compte ».
La connexion avec les mêmes identifiants échoue aussi.

## Cause principale : projet Supabase injoignable

Le `SUPABASE_URL` configuré (`https://tfpdcxdmwazzizcqddch.supabase.co`) ne résout plus en DNS (`NXDOMAIN`).
Le réseau local fonctionne (supabase.com et google.com répondent).

Log backend :

```
getaddrinfo ENOTFOUND tfpdcxdmwazzizcqddch.supabase.co
```

Résultats des appels (via le proxy front `/api/backend/...`) :

| Appel | Réponse |
|---|---|
| `POST /auth/register/request-otp` | `500 Failed to create OTP` |
| `POST /auth/login` | `401 Invalid email or password` |

Au démarrage du backend, le stockage, la file d'emails et les rappels échouent aussi (`fetch failed`).

Hypothèse : projet supprimé ou en pause depuis longtemps → à vérifier sur le dashboard Supabase.

## Pourquoi la boucle

1. **Register** : l'étape 1 insère un OTP dans `email_otps` (Supabase). Elle échoue → on ne passe jamais à l'étape « code ».
2. **Login** : aucun compte n'existe. De plus, `Backend/src/modules/auth/auth.controller.ts` (login) renvoie
   `401 Invalid email or password` pour toute erreur, y compris réseau, ce qui masque la vraie cause.

## Problèmes secondaires

- **Resend** : `RESEND_API_KEY` non renseignée → l'envoi de l'OTP par email échouera même avec un Supabase valide.
- **Redirection locale sur `/api`** : chaque appel `/api/backend/...` reçoit un `307` vers `/fr/api/backend/...`
  (`FrontEnd/middleware.ts`). Ça fonctionne après redirection mais ce n'est pas voulu (le matcher exclut `api`).
  Il y a à la fois `FrontEnd/middleware.ts` et `FrontEnd/src/proxy.ts` (Next 16) — probablement en cause.

## Pistes de correction

1. Vérifier le projet `tfpdcxdmwazzizcqddch` sur Supabase (Restore s'il est en pause).
2. Sinon : créer un nouveau projet, remplacer les variables `SUPABASE_*` (backend) et `NEXT_PUBLIC_SUPABASE_*` (front),
   puis appliquer `Backend/supabase/migrations`.
3. Renseigner une vraie clé Resend, ou en dev logger l'OTP dans la console au lieu de l'envoyer.
4. Optionnel : remonter les erreurs réseau dans le login au lieu de « Invalid email or password » ;
   corriger la redirection locale sur `/api`.
