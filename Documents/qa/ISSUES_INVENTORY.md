# Inventaire des dysfonctionnements — Aptely

| Métadonnée | Valeur |
|------------|--------|
| Date | 2026-10-29 ~10:31 UTC |
| Branche | `qa/demo-accounts-smoke-test` (ahead 1 vs remote tracking) |
| Front | **UP** — `http://localhost:3000` → HTTP 307→200 (`/en/…`) |
| Backend | **UP** — `http://localhost:4000/health` → `{"status":"ok","db":"ok"}` |
| Mode | AUDIT ONLY (pas de fix, pas de commit) |
| Runtime | Serveurs démarrés pour cet audit ; smoke API + Browser MCP (login recruiter) |

---

## Synthèse

- **P0 :** 0
- **P1 :** 4
- **P2 :** 10
- **P3 :** 4

### Top 5 à traiter en premier

1. **INV-001** — Dashboard company vide pour Recruiter/HM (`/hr/dashboard/*` exige `analytics.view`)
2. **INV-002** — Resend : clé API invalide → emails en échec (file d’attente saturée)
3. **INV-006** — Modules Phase 4 (employés, paie, goals, retention) **hard-disabled** dans la sidebar
4. **INV-005 / INV-014** — Offres + fiches de poste absentes / inaccessibles pour Recruiter (nav + RBAC seed)
5. **INV-004** — Completeness profil incohérente (calcul local vs `/vault/me/score`)

---

## Tableau global

| ID | Sévérité | Zone | Statut | Symptôme | Preuve (URL/fichier) | Compte testé | Déjà connu? |
|----|----------|------|--------|----------|----------------------|--------------|-------------|
| INV-001 | P1 | C Company dashboard | PARTIAL | Stats / rôles / apps récents à **0** alors que `/roles` et `/applications` renvoient des données | UI `/en/company/dashboard` ; API `GET /hr/dashboard/stats` → **403 analytics.view** ; `Backend/src/modules/hr-dashboard/hr-dashboard.router.ts` | recruiter@, hiring-manager@ | **non** (nouveau runtime) |
| INV-002 | P1 | H Emails / Resend | BROKEN | Envois email échouent ; queue retry → failed | Logs Backend : `API key is invalid` / `[EMAIL_QUEUE] Marked as failed` ; `Backend/.env` `RESEND_API_KEY` | n/a (worker) | partiel (DX env) — **confirmé runtime** |
| INV-003 | P2 | B Super Admin | PARTIAL | Drawer institution : JOB POSTINGS (0) vs metrics 4 rôles | `Documents/qa-partie2/notes/s1_super_admin.json` P2-S1-01 ; code `admin.controller.ts` query `roles` (fix surface erreur) | SA session QA antérieure | **oui** P2-S1-01 OPEN |
| INV-004 | P2 | D Candidate profile | PARTIAL | % completeness différent profil vs dashboard | Profile : `computeProfileScore` local (`candidate/profile/page.tsx`) ; Dashboard : `vaultMyScoreApi` → score **25** ; QA 45 vs 25 | candidate@ | **oui** P2-S3-01 OPEN |
| INV-005 | P2 | C Offers | PARTIAL | Nav Offres **commentée** ; Recruiter/HM `403 offers.manage` ; OWNER OK liste vide | `Sidebar.tsx` L179 « Offres temporarily disabled » ; `GET /offers` recruiter/HM 403, owner 200 | recruiter, HM, owner | **oui** (désactivation volontaire + RBAC) |
| INV-006 | P1 | E RH Phase 4 | PARTIAL | Sidebar : `showEmployees/Payroll/Goals/Retention = false` — modules absents de la nav malgré pages/API | `FrontEnd/src/components/Sidebar.tsx` L182–191 ; modules institution `hr/payroll/goals` souvent `is_active:false` (recruiter `/institution/me/modules`) | recruiter | **oui** (flag code) |
| INV-007 | P2 | Marketing | MISSING | `/talents` → **404** | `curl -L http://localhost:3000/talents` → 404 ; pas de `FrontEnd/src/app/talents` | anonyme | **non** (signalé brief) |
| INV-008 | P2 | B Admin | MISSING | `ROUTES.admin.metrics` sans page | `routes.ts` `admin.metrics` ; `curl -L …/admin/metrics` → 404 ; pas de `app/admin/metrics` | anonyme | **non** |
| INV-009 | P2 | B Super Admin | DX | SA non rejouable : `gclud79@gmail.com` + mdp démo → invalid | `POST /auth/login` → Invalid email or password ; `ROLE_MAPPING.md` | tentative SA | **oui** BLOCKED |
| INV-010 | P2 | C Calendar | PARTIAL | Calendar charge ; Cal.com non connecté | QA notes recruiter/member ; pas d’intégration Google/Outlook dans Backend | recruiter/member (docs) | **oui** |
| INV-011 | P3 | H Rate-limit | DX | `AUTH_RATE_LIMIT_MAX_REQUESTS=200` laissé (bump QA) | `Backend/.env` ; `Documents/qa/CORRECTION_LOG.md` | n/a | **oui** |
| INV-012 | P2 | J Roadmap P2 | MISSING | Sync calendrier Google/Outlook + génération auto Meet/Zoom non trouvés | Roadmap Phase 2 ; code entretiens = `meeting_link` / providers manuels (`GOOGLE_MEET`,`TEAMS`,`MANUAL`,`JITSI`) | — | **oui** (écart roadmap) |
| INV-013 | P3 | C Permissions UI | COSMETIC→DX | Labels « Employés (à venir) » / « Paie (à venir) » alors que modules existent (désactivés nav) | `settings/permissions/page.tsx` | — | **oui** |
| INV-014 | P2 | C Recruiter nav | PARTIAL | Recruiter : pas de « Fiches de poste » (canRoles = FULL_HR only) ; candidatures retirées de la sidebar | `Sidebar.tsx` L168–176 | recruiter Browser | **non** clair / design actuel |
| INV-015 | P3 | DX Front | DX | Warning Turbopack : plusieurs lockfiles (root parent FUTURE_STUDIO) | Log `next dev` FrontEnd | n/a | **non** |
| INV-016 | P2 | D Talent API | PARTIAL | Note OPEN : candidat `GET /applications/:id` → 403 (workspace personnel) | `qa-partie2/notes/s4_talent_apply.json` step 7 | candidate (QA) | **oui** note OPEN |
| INV-017 | P3 | Marketing demo | PARTIAL | Vidéo landing non branchée (`youtube.com` générique) | `FrontEnd/src/lib/landingMedia.ts` | — | **oui** (volontaire) |
| INV-018 | P2 | H Notifications | MISSING | Notifications E2E « Not Implemented » (acceptation Partie 2) | `APTELY_Partie2_E2E_…REPORT.md` § Acceptance | — | **oui** |
| INV-019 | P3 | F Matching | DX | `GET/POST /match` 404 — route réelle `POST /match/role` | `matching.router.ts` ; smoke 404 puis 422 validation sur `/match/role` | recruiter | **non** (pas un bug produit si clients utilisent le bon path) |
| INV-020 | P2 | C Interviews HM | PARTIAL→à clore | Historique OPEN P2-S2-01 (liste assigned vide) ; **API runtime : 4 entretiens** | `GET /interviews/assigned-to-me` HM 200 len=4 ; OPEN dans SUMMARY partie2 | hiring-manager@ | **oui** P2-S2-01 — **symptôme API ne reproduit plus** (reconfirmer UI) |

**Régressions :** aucune régression confirmée des bugs FIXED (BUG-001…003, P2-S5-*, P2-S7-*). MEMBER `GET /applications` → **403** toujours (P2-S7-01 OK). Isolation cross-org UI **non rejouée** ce tour (pas Org B login exhaustif).

---

## Détail par zone

### INV-001 — Dashboard Recruiter/HM vide (P1)

- **Steps :** Login `recruiter@aptely.demo` → `/company/dashboard`
- **Attendu :** Compteurs / rôles / file alignés aux données réelles
- **Obtenu :** To Process / Active Roles / Recent job posts = 0 ; CTA « Start your first pipeline » ; alors `/applications` UI liste ~12 apps ; API `/roles` → 6
- **Cause :** `hr-dashboard.router.ts` gate **`analytics.view`** ; perms Recruiter = `applications.view`, `communications.send`, `interviews.manage` seulement
- **Impact :** Parcours démo principal trompeur ; stats inutilisables pour Recruiter/HM

### INV-002 — Resend cassé (P1)

- **Steps :** Démarrer Backend ; observer logs email queue
- **Attendu :** Emails candidature / auth délivrés (ou skip explicite en dev)
- **Obtenu :** `Failed to send … API key is invalid` ; nombreuses entrées `Marked as failed`
- **Impact :** Forgot-password, invites, notifs décision non fiables en local/staging

### INV-003 — SA drawer jobs (P2) — connu OPEN

- **Steps :** SA → institutions → détail Aptely Demo
- **Attendu :** Liste fiches (= `roles`)
- **Obtenu (QA) :** 0 postings vs metrics 4
- **Note :** Code a amélioré la query/`500` si erreur SQL ; symptôme data/lien `institution_id` peut rester
- **Blocked runtime :** pas de SA (INV-009)

### INV-004 — Completeness % (P2) — connu OPEN

- **Steps :** Candidate profile vs dashboard
- **Attendu :** Même %
- **Obtenu :** Deux formules — local `computeProfileScore` vs API vault score (25% runtime)
- **Impact :** Confiance produit / UX talent

### INV-005 / INV-014 — Offres & nav recrutement Recruiter (P2)

- Offres : sidebar désactivée + perm `offers.manage` absente Recruiter/HM
- Fiches : Recruiter hors `FULL_HR` → pas de lien Roles ; accès apps via bottom bar / URL directe OK
- **Impact :** Recruteur démo ne « voit » pas le cœur métier dans la sidebar

### INV-006 — Phase 4 nav off (P1 produit)

- Flags `showEmployees/Payroll/Goals/Retention = false`
- APIs existent (`/employees`, `/goals`, …) mais gated perms + modules souvent inactifs
- OWNER : `/employees` 200 data `[]` ; `/goals` HM 200 `[]`
- **Impact :** Roadmap Phase 4 non exposée en UI malgré code présent

### INV-007 / INV-008 — Routes manquantes (P2)

- `/talents` 404 (discover = `/offers` existe)
- `/admin/metrics` dans registry, page absente

### INV-009 — Super Admin BLOCKED (P2 audit)

- Compte documenté `gclud79@gmail.com` refusé avec mdp démo
- Pas trouvé de seed SA utilisable dans `.env` / docs publiques

### INV-010 / INV-012 — Calendrier (P2)

- UI calendar OK ; Cal.com non connecté
- Roadmap sync Google/Outlook / auto-liens vidéo : **MISSING** vs meeting_link manuel

### INV-016 — Candidate detail application API (P2)

- Note Partie 2 : 403 sur `GET /applications/:id` côté talent (routing workspace)
- Parcours talent passe plutôt par `/individuals/me/applications` (200 runtime)

### INV-020 — P2-S2-01 (P2, probablement stale)

- OPEN docs ; runtime `assigned-to-me` **non vide**
- À revalider UI `/company/recruitment/interviews` avant de garder OPEN

---

## Ce qui marche (rapide)

- Health API + proxy Next `/api/backend/health`
- Login API + UI : recruiter, candidate, HM, member, **owner@aptely.demo**
- Logout / redirect company shell (recruiter Browser)
- `/applications` Recruiter : liste candidatures visible
- Candidate API : `/individuals/me`, vault score, apps, offers hub
- `POST /match/role` existe (422 sans `roleId` = validation OK)
- CV Studio analyses endpoint 200 (liste vide)
- MEMBER isolation apps : **403** `applications.view`
- OWNER analytics/employees/payroll endpoints accessibles
- Landing `/`, `/demo`, `/tarifs`, `/login` 200
- Storage buckets init OK au boot Backend

---

## Non testable / Blocked

| Sujet | Pourquoi |
|-------|----------|
| Super Admin `/admin*` runtime | INV-009 — credentials SA inconnus |
| Régression cross-org P2-S7-02 UI | Org B comptes QA existent en notes ; non rejoués exhaustivement ce tour |
| Matching IA Gemini end-to-end | Smoke route seulement ; pas de run scoring complet |
| CV Studio analyse IA bout-en-bout | Pas d’upload fichier Browser MCP |
| Upload CV UI navigateur | Limite MCP file input (déjà noté Partie 2) ; API multipart Pass historiquement |
| Emails Resend livraison | Clé invalide (INV-002) |
| Paie / leave / retention parcours UI complets | Nav Phase 4 disabled + perms |
| P2-S1-01 drawer jobs | Dépend SA |

---

## Recommandations d’ordre de fix

1. **INV-001** — Découpler `/hr/dashboard/*` de `analytics.view` (ex. `applications.view` / `roles.*`) **ou** donner `analytics.view` aux rôles Recruiter/HM démo.
2. **INV-002** — Corriger / désactiver proprement Resend en local ; purger/échouer vite la queue dead letters.
3. **INV-006** — Trancher : réactiver nav Phase 4 derrière modules `is_active` **ou** documenter « code only / pas produit ».
4. **INV-005 + INV-014** — Réaligner sidebar Recruiter (Roles/Apps/Offers) avec perms seed et intention produit.
5. **INV-004** — Une seule source de vérité pour le % completeness (vault API partout).

Ensuite : INV-003 (SA jobs), INV-008 metrics page, INV-007 `/talents` redirect→`/offers`, INV-009 seed SA documenté, INV-012 calendrier roadmap.

---

## Annexes preuves runtime (extraits)

```
GET /hr/dashboard/stats  recruiter → 403 analytics.view
GET /hr/dashboard/stats  owner     → 200 totalRoles=6 totalApplications=12
GET /offers              recruiter → 403 offers.manage
GET /offers              owner     → 200 data=[]
GET /applications        member    → 403 applications.view
GET /interviews/assigned-to-me HM  → 200 (4 items)
POST /auth/login gclud79@gmail.com → Invalid email or password
Backend log: [EMAIL] Failed … API key is invalid
curl -L /talents → 404 ; /admin/metrics → 404
```
