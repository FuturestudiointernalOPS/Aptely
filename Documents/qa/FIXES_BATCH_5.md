# Fixes batch 5 — Aptely

Branche : `qa/demo-accounts-smoke-test`  
Date démarrage : 2026-10-29  
Règle : un fix à la fois ; validation manuelle utilisateur entre chaque.

---

## P1 — Dashboard Recruiter/HM vide (403 analytics.view)

**Statut :** FIXED (validé utilisateur — dashboard compteurs OK)

### Fichiers touchés
- `Backend/src/modules/hr-dashboard/hr-dashboard.router.ts`

### Choix technique
**Option B** — séparer dashboard recrutement et analytics RH.

- `/hr/dashboard/*` sert le **command center recrutement** (stats roles/apps/activité).
- `analytics.view` reste pour `/analytics/*` (funnel Phase 2 + métriques RH Phase 4).
- RECRUITER et HIRING_MANAGER ont déjà `applications.view` → plus de 403 silencieux, sans élargir l’accès analytics RH.

Option A (ajouter `analytics.view` aux deux rôles) aurait mélangé le droit « voir le pipeline » avec « analytics RH / Phase 4 ».

### Steps de test manuels

1. Vérifier Backend UP : `curl http://localhost:4000/health` → `ok`  
   (si le Backend tourne déjà avec nodemon, il a dû recharger tout seul).
2. Login **`recruiter@aptely.demo`** / `AptelyDemo123!`
3. Aller sur **`/company/dashboard`** (ou `/en/company/dashboard`).
4. **Attendu :** compteurs non tous à 0 si des candidatures/rôles existent ; section « Recent job posts » / activité peuplée (ou au moins cohérente avec `/company/recruitment/applications`).
5. Logout → login **`hiring-manager@aptely.demo`** / `AptelyDemo123!` → même check dashboard.
6. (Optionnel API) avec token Recruiter :
   ```bash
   # après login, accessToken dans session
   curl -sS -H "Authorization: Bearer <TOKEN>" http://localhost:4000/hr/dashboard/stats
   ```
   **Attendu :** HTTP **200** + `totalRoles` / `totalApplications` > 0 (pas 403).
7. Contrôle négatif : MEMBER (`member@aptely.demo`) → toujours **403** sur `/hr/dashboard/stats` (pas `applications.view`).

### Résultat attendu
- Plus de dashboard « Start your first pipeline » à tort pour Recruiter/HM quand la data existe.
- `/analytics/*` Phase 4 reste protégé par `analytics.view` (Recruiter/HM sans ce droit → 403 analytics OK).

---

## P2 — Resend cassé (API key invalid / email_queue)

**Statut :** FIXED (mode dégradé local) — validé utilisateur pour enchaîner ; envoi réel **BLOCKED** sans vraie clé Resend

### Fichiers touchés
- `Backend/src/config/env.ts` — `EMAIL_LOG_ONLY`
- `Backend/src/services/email.service.ts` — log-only, fail-fast auth, soft-fail métier
- `Backend/src/app.ts` — `/health` expose `email.mode`
- `Backend/src/modules/auth/auth.controller.ts` — OTP + forgot-password via `sendEmailDirect`
- `Backend/src/modules/institution/institution.controller.ts` — invite via `sendEmailDirect`
- `Backend/.env` — `EMAIL_LOG_ONLY=true` (local, **ne pas committer**)

### Choix technique
La clé actuelle `RESEND_API_KEY` est bien au format `re_…` mais Resend répond **API key is invalid** → la file `email_queue` retryait en boucle.

Sans fabriquer de fausse clé :
1. **`EMAIL_LOG_ONLY=true`** : pas d’appel Resend ; log stdout ; flux métier continue.
2. Erreur auth permanente → job marqué **`failed`** tout de suite (plus de 5 retries inutiles).
3. Approval/rejection emails : **soft-fail** (warn) au lieu de throw qui casse la décision.
4. `/health` → `email: { mode, from, hint? }` pour diagnostiquer.

### Variables à corriger (quand tu as un vrai compte Resend)

Dans `Backend/.env` :

```bash
RESEND_API_KEY=re_xxxxxxxx          # Dashboard Resend → API Keys → Create
RESEND_FROM_EMAIL=onboarding@aptely.com   # doit être un domaine / sender VÉRIFIÉ dans Resend
RESEND_FROM_NAME=Aptely
RESEND_WEBHOOK_SECRET=whsec_...     # si webhooks activés
EMAIL_LOG_ONLY=false                # repasser à false pour envoyer réellement
```

Notes :
- Domaine à vérifier dans Resend (DNS) sinon `from` rejeté même avec clé OK.
- En local sans domaine : Resend autorise parfois `onboarding@resend.dev` selon le compte — à vérifier dans leur doc/dashboard.
- **Ne committe jamais** `.env`.

### Steps de test manuels

**A — Mode dégradé (défaut actuel)**
1. Relancer / laisser nodemon recharger le Backend.
2. `curl -sS http://localhost:4000/health | jq .email`  
   **Attendu :** `"mode": "log-only"` + hint `EMAIL_LOG_ONLY=true`.
3. Logs Backend au boot : `EMAIL_LOG_ONLY=true — Resend disabled…`
4. Declencher un email (ex. forgot-password sur `/forgot-password` avec `candidate@aptely.demo`, ou une action invite/decision).  
   **Attendu :** pas de crash UI ; logs `[EMAIL][LOG_ONLY] to=…` ; **pas** de spam `API key is invalid` en boucle.

**B — Envoi réel (quand tu as la clé)**
1. Coller ta vraie `RESEND_API_KEY` + `EMAIL_LOG_ONLY=false`.
2. Restart Backend.
3. `curl health` → `email.mode: "live"`.
4. Forgot-password ou invite → email reçu (ou erreur claire une fois, pas de queue zombie).

### Résultat attendu
- Local utilisable sans Resend valide.
- File d’attente ne tourne plus en vain sur clé invalide.
- Instructions claires pour activer l’envoi réel.

---

## P3 — Phase 4 nav OFF (Sidebar hardcodée false)

**Statut :** FIXED (validé utilisateur — enchaînement P4)

### Fichiers touchés
- `FrontEnd/src/components/Sidebar.tsx`

### Choix technique
1. Restaurer le gating commenté :
   - `showEmployees` / `showPayroll` / `showRetention` → FULL_HR (ou perm CUSTOM)
   - `showGoals` → HR_FAMILY (inclut **HIRING_MANAGER** via rôle, ou `goals.view` CUSTOM)
2. Ajouter `alwaysShow: true` sur Employés / Goals / Paie (comme Retention déjà)  
   → sinon la nav restait invisible même pour OWNER car `institution_modules` a `hr/payroll/goals` à `is_active:false` sur Aptely Demo.

**Qui voit quoi (rôles démo) :**
| Compte | Employés | Congés | Goals | Retention/Analytics | Paie |
|--------|----------|--------|-------|---------------------|------|
| OWNER / ADMIN / HR_LEAD / STANDARD_HR | oui | oui | oui | oui | oui |
| HIRING_MANAGER | non | non | **oui** | non | non |
| RECRUITER | non | non | non | non | non |
| MEMBER | non | non | non | non | non |

### Steps de test manuels

1. Front UP : `http://localhost:3000` (hard refresh si besoin).
2. Login **`owner@aptely.demo`** / `AptelyDemo123!`  
   **Attendu sidebar :** sections **Employés** (Équipe + Congés), **Goals & OKRs**, **Analyse & Rétention**, **Paie**.
3. Logout → **`hiring-manager@aptely.demo`**  
   **Attendu :** **Goals & OKRs** visible ; **pas** Employés / Paie / Rétention.
4. Logout → **`recruiter@aptely.demo`**  
   **Attendu :** **aucune** de ces sections Phase 4.
5. (Optionnel) MEMBER : pas de Phase 4.
6. Cliquer les liens OWNER : pages chargent sans crash (liste vide OK).

### Résultat attendu
- Nav Phase 4 pilotée par permissions/rôles, plus de `false` hardcodé.
- Recruiter/HM sans droits RH ne voient pas paie/employés.

---

## P4 — Offres + fiches (nav + perms Recruiter/HM)

**Statut :** FIXED (en attente validation manuelle)

### Fichiers touchés
- `Backend/src/middleware/permissions.middleware.ts` — DEFAULT_PERMISSIONS RECRUITER
- `FrontEnd/src/components/Sidebar.tsx` — nav Roles + Offres

### Choix technique
| Rôle | Fiches (liste) | Créer/éditer fiche | Offres |
|------|----------------|--------------------|--------|
| **RECRUITER** | oui (nav HR_FAMILY) | oui (`roles.create` + `roles.update`) | oui (`offers.manage`) |
| **HIRING_MANAGER** | oui (nav) | non (pas de create/update) | non (offre = geste RH/recruteur) |
| FULL_HR | oui | selon perms existantes | oui |

- **Pas de nouveau `roles.view`** : la liste API est déjà gated par `applications.view` ; la création reste sur `roles.create` (page create + RolesClient).
- Nav Offres via `hasPermission("offers.manage")` (plus le groupe FULL_HR seul) pour que le Recruiter la voie après ajout DEFAULT.
- HM : voit les fiches pour le contexte pipeline, sans créer de poste ni gérer les offres.

### Steps de test manuels

1. Hard refresh Front ; **logout / login** Recruiter (rafraîchir les perms workspace).
2. **`recruiter@aptely.demo`**  
   - Sidebar : **Fiches de poste** + **Offres** (+ Entretiens).  
   - `/company/recruitment/roles` → liste OK ; bouton créer présent.  
   - `/company/recruitment/offers` → page OK (liste vide possible), **pas** 403.
3. **`hiring-manager@aptely.demo`** (relogin)  
   - Sidebar : **Fiches de poste** oui ; **Offres** **absentes**.  
   - `/company/recruitment/roles` → liste OK ; **pas** de création (ou redirect).  
   - Deep-link `/company/recruitment/offers` → **403**/accès refusé côté API (attendu).
4. (Optionnel API) Recruiter `GET /offers` → 200 ; HM → 403.

### Résultat attendu
- Recruiter opère fiches + offres.
- HM lit fiches, pas offres / pas create role.

---

## Bonus — Erreurs overlay Next.js (captures 12:29 / 12:31 / 12:16)

**Statut :** FIXED

### Symptômes (captures)
1. `GET /onboarding/templates` → 403 `onboarding.manage`
2. `GET /decisions/.../state` + `audit-logs` → 403 `applications.decide`
3. `GET /applications/.../email-preview` → 404 (pas de templates)

### Correctifs
- `permissions.middleware.ts` — RECRUITER : `applications.decide` + `onboarding.manage`
- `decisions.router.ts` — GET state/history/audit-logs → `applications.view` (lecture)
- `applications.controller.ts` — email-preview → **200** `{ templates: null, ready: false }` si pas encore généré
- `apiHelper.ts` — 403/404 en `console.warn` (plus d’overlay rouge Next sur cas attendus)
- `ApplicationPanel.tsx` — n’appelle `listOnboardingTemplates` que si `onboarding.manage`
- `email-preview/page.tsx` — gère payload `ready: false`

### Retest
1. Logout/login **recruiter@**
2. Ouvrir une candidature détail — plus d’overlay Permission denied
3. Deep-link email-preview sans finalize — plus de 404 overlay

---

## P5 — Completeness % (+ WebSocket messages overlay)

**Statut :** FIXED (validé utilisateur — enchaînement P6)

### Fichiers touchés
- `FrontEnd/src/app/candidate/profile/page.tsx` — score via `vaultMyScoreApi` (plus de `computeProfileScore` local) ; refresh après save
- `FrontEnd/src/app/company/recruitment/applications/[id]/messages/page.tsx` — guard WebSocket + poll 8s + `console.warn`
- `FrontEnd/src/app/candidate/messages/page.tsx` — idem

### Choix technique
- **Une source de vérité** : `GET /vault/me/score` (même payload que le dashboard candidat).
- Realtime Supabase : si `WebSocket` absent ou `subscribe` throw / `CHANNEL_ERROR` → **poll REST** + warn (plus d’overlay Next `console.error` / throw non catché).

### Steps de test manuels
1. Login **`candidate@aptely.demo`** → `/candidate/dashboard` note le % completeness.
2. Ouvrir `/candidate/profile` → **même %** (et nudges alignés).
3. Sauver une modification (ex. headline) → le % se met à jour sans reload dashboard.
4. Login recruiter → messages candidature (`…/applications/[id]/messages`) → **pas** d’overlay rouge `WebSocket not available` ; envoi/réception OK (realtime ou poll).

### Résultat attendu
- Profil et dashboard affichent le même Completeness %.
- Page messages utilisable sans overlay Next.js.

---

## P6 — `/talents` 404 (INV-007)

**Statut :** FIXED (validé utilisateur — enchaînement P7)

### Fichiers touchés
- `FrontEnd/next.config.mjs` — redirect 308 `/talents` (+ `/[locale]/talents`) → `/offers`
- `FrontEnd/src/lib/routes.ts` — `ROUTES.talents` alias → `/offers`

### Choix technique
Pas de page marketing séparée : la découverte publique existe déjà (`ROUTES.discover` = `/offers`). Redirect permanent pour bookmarks / liens externes.

### Steps de test manuels
1. **Restart Front** (changement `next.config` — pas hot-reload).
2. Ouvrir `http://localhost:3000/talents` (ou `/en/talents`).  
   **Attendu :** arrive sur **Discover / Offres** (`/…/offers`), HTTP redirect, **pas** 404.
3. `curl -sSI http://localhost:3000/talents | head` → `308`/`301` Location vers offers (middleware peut intercaler locale).

### Résultat attendu
- Plus de 404 sur `/talents` ; même UX que `/offers`.

---

## P7 — `/admin/metrics` 404 (INV-008)

**Statut :** FIXED (validé utilisateur — enchaînement P8)

### Fichiers touchés
- `FrontEnd/src/app/admin/metrics/page.tsx` — **nouvelle page** (funnel + KPI + weekly via `adminMetricsApi`)
- `FrontEnd/src/app/admin/layout.tsx` — lien nav **Métriques**

### Choix technique
`ROUTES.admin.metrics` existait déjà ; l’API `GET /admin/metrics` aussi (consommée sur `/admin` overview). Il manquait seulement la route App Router + entrée nav.

### Steps de test manuels (détaillés)

**A — Sans Super Admin (tout le monde peut vérifier le 404)**
1. Front UP : `http://localhost:3000`
2. Terminal :
   ```bash
   curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3000/en/admin/metrics
   ```
   **Attendu :** `200` (plus `404`). La page charge ; le layout admin renverra vers `/login` si tu n’es pas SA.
3. Navigateur : ouvre `http://localhost:3000/en/admin/metrics`  
   **Attendu :** pas de page « 404 » Next ; redirection login ou shell admin.

**B — Avec Super Admin (si tu as un compte `super_admins`)**
1. Login SA → `/admin`
2. Sidebar admin : lien **Métriques** visible entre Vue d’ensemble et Utilisateurs.
3. Cliquer **Métriques** → URL `…/admin/metrics`  
   **Attendu :** KPIs (entreprises actives, réembauche, délai, rétention) + funnel + 3 barres hebdo ; pas d’écran d’erreur.
4. (Optionnel) Comparer les chiffres funnel avec l’onglet Vue d’ensemble — même source API.

> **Note INV-009 :** le compte doc `gclud79@gmail.com` + mdp démo ne fonctionne pas actuellement. Le test A suffit pour valider « plus de 404 ».

### Résultat attendu
- `/admin/metrics` (et `/en/admin/metrics`) résolvent une page réelle.
- Nav admin expose l’entrée Métriques.

---

## P8 — Super Admin non rejouable (INV-009)

**Statut :** FIXED (validé utilisateur — enchaînement P9)

### Fichiers touchés
- `Backend/scripts/ensure-demo-superadmin.cjs` — seed idempotent SA démo
- `Backend/package.json` — script `ensure:demo-superadmin`
- `Documents/qa-partie2/ROLE_MAPPING.md` — compte documenté

### Compte créé (runtime local)
| | |
|--|--|
| Email | **`superadmin@aptely.demo`** |
| Password | **`AptelyDemo123!`** (comme les autres démo) |
| Effet | row `super_admins` + claim JWT `is_super_admin` |

> Ancien `gclud79@gmail.com` : obsolète, ne plus utiliser.

### Relancer le seed (si besoin)
```bash
cd Backend && npm run ensure:demo-superadmin
```

### Steps de test manuels (détaillés)

1. Backend UP : `curl -sS http://localhost:4000/health`
2. UI : logout → login  
   - email : `superadmin@aptely.demo`  
   - password : `AptelyDemo123!`
3. **Attendu :** accès **`/admin`** (Vue d’ensemble), pas redirigé vers login.
4. Sidebar admin : **Métriques** → `/admin/metrics` → KPIs / funnel visibles (chiffres ok même à 0).
5. Ouvrir **Utilisateurs** et **Entreprises** → listes chargent (200).
6. Contrôle API (optionnel) :
   ```bash
   # login
   curl -sS -X POST http://localhost:4000/auth/login \
     -H 'Content-Type: application/json' \
     -d '{"email":"superadmin@aptely.demo","password":"AptelyDemo123!"}'
   # puis avec le accessToken :
   curl -sS -H "Authorization: Bearer <TOKEN>" http://localhost:4000/admin/stats
   curl -sS -H "Authorization: Bearer <TOKEN>" http://localhost:4000/admin/metrics
   ```
   **Attendu :** HTTP **200** (pas 403).
7. Contrôle négatif : login `recruiter@aptely.demo` → deep-link `/admin` → renvoyé au login (pas SA).

### Résultat attendu
- Parcours Super Admin rejouable en local/QA sans dépendre de `gclud79@…`.
- P7 test B (métriques SA) maintenant possible.

---

## P9 — SA drawer job postings = 0 (INV-003 / P2-S1-01)

**Statut :** FIXED (validé utilisateur — enchaînement P10)

### Cause
Après migration **021** (JSON-only roles), `roles.title` n’existe plus — le titre est dans `role_dna.full_form_json`.  
`GET /admin/institutions/:id` sélectionnait encore `title` → **500** `column roles.title does not exist` (UI = liste vide / « 0 fiches »).  
Même bug sur `GET /admin/activity` (job_posted).  
UI comptait aussi `status === "PUBLISHED"` alors que l’enum est **`ACTIVE`**.

### Fichiers touchés
- `Backend/src/modules/admin/admin.controller.ts` — join `role_dna` + `deriveRoleFieldsFromFullForm` (detail + activity)
- `FrontEnd/src/app/admin/institutions/page.tsx` — compteur / couleurs `ACTIVE`

### Steps de test manuels (détaillés)

1. Backend rechargé (nodemon) ; Front UP.
2. Login **`superadmin@aptely.demo`** / `AptelyDemo123!`
3. Aller **`/admin/institutions`**
4. Ouvrir le drawer **Aptely Demo** (clic sur la ligne).
5. **Attendu :**
   - Section **Fiches de poste (N)** avec N ≥ 1 (souvent ~6–7)
   - Titres lisibles (ex. « React Architect », « Data Engineer »…)
   - Badge statut **ACTIVE** / DRAFT / …
   - KPI **Postes ouverts** = nombre de fiches **ACTIVE** (pas 0 si des ACTIVE existent)
6. Contrôle API :
   ```bash
   TOKEN=…  # login SA
   curl -sS -H "Authorization: Bearer $TOKEN" \
     http://localhost:4000/admin/institutions/14840bca-de5a-4cb0-8f25-a8c6505c93de \
     | jq '{n:(.jobPositions|length), titles:[.jobPositions[].title]}'
   ```
   **Attendu :** HTTP **200**, `n > 0`, titres non vides.
7. (Optionnel) `/admin` → activité récente peut montrer des `job_posted` avec labels corrects (plus de 500 silencieux).

### Résultat attendu
- Drawer SA aligne les fiches avec la réalité `/roles` / metrics funnel.

---

## P10 — Candidate `GET /applications/:id` 403 (INV-016)

**Statut :** FIXED (validé utilisateur — batch rapide P11+)

### Cause
La route était gated uniquement par `applications.view` (perm institution). Un talent en workspace perso n’a pas d’institution → **403** « You are not linked to any institution », alors que le controller savait déjà autoriser `candidate_id === user.id`.

### Fichiers touchés
- `Backend/src/middleware/permissions.middleware.ts` — `requirePermissionOrPersonalWorkspace`
- `Backend/src/modules/applications/applications.router.ts` — GET `/:id` utilise ce gate
- `Backend/src/modules/applications/applications.controller.ts` — workspace perso = **uniquement** sa propre app (plus de fallback membership, qui ouvrait MEMBER) ; `notes` HR masquées pour le talent

### Steps de test manuels (détaillés)

**Prérequis :** Backend UP (nodemon a rechargé).

**A — Talent (doit passer)**
1. Login **`candidate@aptely.demo`** / `AptelyDemo123!`
2. Récupère un id d’app :
   ```bash
   CTOKEN=<token login candidate>
   curl -sS -H "Authorization: Bearer $CTOKEN" -H "X-Workspace-Id: personal" \
     http://localhost:4000/individuals/me/applications | jq '.data[0].id'
   ```
3. Détail :
   ```bash
   curl -sS -w "\n%{http_code}\n" -H "Authorization: Bearer $CTOKEN" -H "X-Workspace-Id: personal" \
     http://localhost:4000/applications/<APP_ID>
   ```
   **Attendu :** **200** + `data.status` + `data.roles.title` ; pas de notes HR utiles (`notes` null/absent).

**B — MEMBER (doit rester bloqué — P2-S7-01)**
```bash
INST=14840bca-de5a-4cb0-8f25-a8c6505c93de
curl -sS -w "\n%{http_code}\n" -H "Authorization: Bearer <MEMBER_TOKEN>" \
  -H "X-Workspace-Id: $INST" http://localhost:4000/applications/<APP_ID>
```
**Attendu :** **403** `Permission denied: applications.view`  
Même avec `-H "X-Workspace-Id: personal"` → **403** Access denied.

**C — Recruiter (doit passer)**
```bash
curl -sS -w "\n%{http_code}\n" -H "Authorization: Bearer <RECRUITER_TOKEN>" \
  -H "X-Workspace-Id: $INST" http://localhost:4000/applications/<APP_ID>
```
**Attendu :** **200**.

### Résultat attendu
- Talent peut lire **sa** candidature via `GET /applications/:id`.
- MEMBER / cross-user toujours refusés.

---

## Batch rapide P11+ (deadline 16h) — clôture inventaire

**Statut :** FIXED / CLOSED / DEFERRED (ci-dessous)

### P11 — INV-013 Labels permissions « à venir »
- `permissions/page.tsx` : groupes **Employés** / **Paie** (sans « à venir ») — modules déjà livrés.

### P12 — INV-011 Rate-limit auth QA bump
- `Backend/.env` : `AUTH_RATE_LIMIT_MAX_REQUESTS=20` (était 200). **Local only, ne pas committer `.env`.**
- Redémarrer Backend pour prendre effet.

### P13 — INV-015 Turbopack multi-lockfile
- `FrontEnd/next.config.mjs` : `turbopack.root = import.meta.dirname`

### P14 — INV-019 `POST /match` 404 opaque
- `matching.router.ts` : `POST/GET /match` → 404 JSON hint `Use POST /match/role`

### P15 — INV-020 HM interviews (P2-S2-01)
- **CLOSED** : API `GET /interviews/assigned-to-me` renvoie des items pour `hiring-manager@` (symptôme « liste vide » stale). UI `/company/recruitment/interviews` à reconfirmer en 30 s.

### P16 — INV-017 Landing YouTube
- **CLOSED / N/A** : placeholder `youtube.com` déjà **non embarqué** (`isRealYoutubeVideoUrl` = false). Pas de vidéo produit à brancher.

### DEFERRED (hors scope 16h — pas un fix rapide)
| ID | Pourquoi |
|----|----------|
| **INV-010 / INV-012** | Sync Google/Outlook + auto Meet/Zoom = feature roadmap, pas un bug ponctuel |
| **INV-018** | Notifications E2E « Not Implemented » = chantier produit, pas un patch |

---

## Checklist smoke 16h (tout-en-un)

Serveurs : `curl -sS http://localhost:4000/health` + Front `:3000`.

| # | Check | Commande / UI | Attendu |
|---|--------|---------------|---------|
| 1 | Health | `curl -sS localhost:4000/health` | `ok` |
| 2 | `/talents` | navigateur `/talents` | → `/offers` |
| 3 | SA login | `superadmin@aptely.demo` / `AptelyDemo123!` | `/admin` |
| 4 | SA drawer | `/admin/institutions` → Aptely Demo | fiches > 0 |
| 5 | `/admin/metrics` | nav Métriques | 200 + KPIs |
| 6 | Candidate detail | script P10 (copier-coller) | HTTP 200 |
| 7 | Recruiter dash | `recruiter@` → `/company/dashboard` | compteurs ≠ faux zéro |
| 8 | Perms labels | `/company/settings/permissions` | Employés / Paie sans « à venir » |
| 9 | Match hint | `POST /match` (auth recruiter) | 404 + message `/match/role` |
| 10 | HM interviews | `hiring-manager@` → Entretiens | liste non vide si data |

Mot de passe démo partout : **`AptelyDemo123!`**
