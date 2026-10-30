# AUDIT QA Aptely — Rapport auditeur

**Date audit :** 2026-10-22 ~15:20  
**Branche :** `qa/demo-accounts-smoke-test` (tracking `origin/dev`)  
**Auditeur :** AGENT AUDITEUR QA  
**Scope :** Vérification d’exécution de la mission QA (pas retest produit)

---

## Verdict global : **PASS AVEC RÉSERVES**

Les 4 PDF/MD + SUMMARY existent, 2 bugs P1 ont des fixes code plausibles, et les parcours principaux sont largement couverts en lecture.  
Toutefois : serveurs **DOWN** au moment de l’audit, actions Manager `(+1)` non exécutées, incohérences notes↔rapports, logout / authz Member incomplets, screenshots vides.

---

## Checklist conformité

| Critère brief | Statut | Preuve / commentaire |
|---------------|--------|----------------------|
| Branche `qa/demo-accounts-smoke-test` basée `origin/dev` | **CONFORME** | `git branch` = `qa/demo-accounts-smoke-test...origin/dev` |
| Front `localhost:3000` UP pendant QA | **PARTIEL** | Rapports affirment health OK ; **à l’audit (15:20) : Connection refused :3000** |
| Backend `localhost:4000/health` UP | **PARTIEL** | Idem ; **Connection refused :4000** — impossible de revalider |
| Browser MCP utilisé | **PARTIEL** | Notes JSON + détails UI cohérents avec navigation ; pas de screenshots pour prouver |
| Compte Manager testé | **CONFORME** | `QA_Manager_*` + `notes/manager.json` |
| Compte Recruteur testé | **CONFORME** | `QA_Recruiter_*` + `notes/recruiter.json` |
| Compte Candidat testé | **CONFORME** | `QA_Candidate_*` + `notes/candidate.json` |
| Compte Employé testé | **CONFORME** | `QA_Member_*` + `notes/member.json` |
| Smoke P0/P1 only | **CONFORME** | 2 bugs P1 ; overlay apiFetch noté non-P0 |
| Fix &lt;10 min sinon OPEN | **CONFORME** (déclaratif) | 2 FIXED, 0 OPEN ; pas de preuve durée |
| Pas de commit non demandé | **CONFORME** | Diffs locaux non commités ; `Documents/qa/` untracked |
| Screenshots si utile | **MANQUANT** | `Documents/qa/screenshots/` **vide** |
| PDF Manager + MD | **CONFORME** | Présents ; `pdftotext` aligné MD |
| PDF Recruiter + MD | **CONFORME** | Idem |
| PDF Candidate + MD | **CONFORME** | Idem |
| PDF Member + MD | **CONFORME** | Idem |
| Métadonnées / checklist / bugs / conclusion dans chaque rapport | **CONFORME** | Structure respectée |
| `SUMMARY.md` tableau global | **CONFORME** | Présent, totaux 2/2/0 |
| Parcours Manager URLs checklist | **PARTIEL** | Pages listées OK dans MD ; **pas de `roles (+1)` ni `applications (+1)`** (création) |
| Parcours Recruteur URLs | **CONFORME** | login→…→cv-studio→logout présents en MD |
| Parcours Candidat URLs | **PARTIEL** | Pages OK ; **Logout absent** checklist MD/notes |
| Parcours Employé sidebar + non-accès sensible | **PARTIEL** | Sidebar / denial employees / gate create OK ; **leave + settings/permissions SKIP** ; **Logout absent** |
| BUG FIXED → change code plausible | **CONFORME** | Voir section bugs ci-dessous |
| Cohérence notes JSON ↔ rapports finaux | **MANQUANT / NON-CONFORME** | `manager.json` : org/teams/analytics encore `PENDING` alors que MD/PDF = OK ; `member.json` calendar `SKIP` vs MD = OK |

---

## État serveurs (critère audit §6)

| Endpoint | Au lancement parent | À l’audit (~15:20) |
|----------|---------------------|---------------------|
| `http://localhost:3000` | code 000 (DOWN) | **DOWN** — `Connection refused` (IPv4/IPv6) |
| `http://localhost:4000/health` | code 000 (DOWN) | **DOWN** — `Connection refused` |

**Impact audit :** les claims « API health = OK » et les retests post-fix ne sont **pas rejouables** maintenant. Confiance basée uniquement sur artefacts écrits + diffs.

---

## Fixes code vs bugs FIXED

### BUG-001 (P1) — Sidebar CANDIDAT intermittente — **claim PROUVÉ**

- Rapport : `FrontEnd/src/lib/workspace.tsx`
- Diff réel : retry memberships, fallback `user.institutionId`, garde `kind: "institution"` pendant `loading` / échec hydrate
- **Plausible et aligné** au symptôme décrit

### BUG-002 (P1) — Member `/roles/create` sans `roles.create` — **claim PROUVÉ**

- Front : `roles/create/page.tsx` — gate `hasPermission('roles.create')` + redirect
- Backend : `roles.router.ts` — `requirePermission("roles.create")` sur `POST /`
- **Plausible et aligné**

Aucun autre fichier produit modifié hors ces 3 paths (+ livrables QA).

---

## Couverture parcours (détail manques)

### Manager — attendu : login → dashboard → **roles (+1)** → **applications (+1)** → interviews → offers → settings org/teams → analytics → logout

| Élément | Checklist | Écart |
|---------|-----------|-------|
| login / dashboard / roles / applications / interviews / offers / org / teams / analytics / logout | Lignes présentes (MD) | OK formel |
| **roles (+1)** création | **Absent** | Seulement liste (vide / race) — **pas d’action +1** |
| **applications (+1)** | **Absent** | TOTAL 0, pas de création |
| notes vs MD | org/teams/analytics | **PENDING dans notes**, **OK dans PDF** → preuve faible |

### Recruteur — **OK** (logout en MD ; absent notes — mineur)

### Candidat — pages OK ; **logout manquant** ; deep-link company create testé en bonus (OK)

### Employé — sidebar limitée + denial employees + gate create OK ; **leave SKIP**, **permissions SKIP**, **logout manquant** ; calendar notes/MD divergents

---

## Manques critiques

1. **Serveurs DOWN** au moment de l’audit → mission non revalidable ; health claim non confirmable maintenant.
2. **Actions Manager `(+1)` non faites** (création rôle / candidature) — écart direct au brief.
3. **Incohérence `notes/manager.json` (PENDING) vs rapports (OK)** sur org / teams / analytics — risque de checklist remplie sans retest tracé.
4. **Logout non checklisté** Candidate + Member (et Member notes incomplètes).
5. **Authz Member incomplet** : `settings/permissions` et `employees/leave` SKIP alors que le brief demande non-accès sensible/admin.
6. **Screenshots vides** — pas bloquant seuls, mais affaiblit la preuve (surtout pour BUG-001 race).

---

## Questions / messages à l’agent QA exécuteur

À compléter **avant 16:00** :

1. **Relancer Front + Backend**, confirmer `curl` 200 sur `:3000` et `:4000/health`, et noter l’heure dans SUMMARY.
2. **Manager :** exécuter réellement **roles (+1)** et **applications (+1)** (ou marquer **SKIP** avec raison bloquante — ex. perms HM sans `roles.*` déjà notée) ; mettre à jour MD/PDF/SUMMARY.
3. **Synchroniser `notes/manager.json`** : org / teams / analytics ne peuvent pas rester `PENDING` si les PDF disent OK — retester ou corriger le statut.
4. **Candidate + Member :** ajouter ligne **Logout** (OK/KO) dans notes + MD + régénérer PDF.
5. **Member :** tester au minimum un deep-link admin (`/settings/permissions`) et documenter KO attendu ; clarifier calendar SKIP vs OK.
6. **Optionnel mais utile :** 1–2 screenshots BUG-001 (avant/après) et denial Member create.
7. Confirmer si le bump `AUTH_RATE_LIMIT` dans `.env` a été **revert** (note QA only) — hors scope code audit, mais à signaler à l’équipe.

---

## Recommandations immédiates avant 16:00

| Priorité | Action | Effort |
|----------|--------|--------|
| P0 | Remonter stack locale + preuve health dans SUMMARY | 2–5 min |
| P0 | Trancher Manager `(+1)` : faire l’action ou SKIP motivé (perms) | 5–10 min |
| P1 | Aligner notes JSON ↔ MD/PDF (PENDING → OK/KO/SKIP réel) | 3 min |
| P1 | Logout Candidate/Member + 1 deep-link admin Member | 5 min |
| P2 | Screenshots race sidebar / denial create | 3 min |
| — | **Ne pas committer** sans demande ; livrables QA + fixes restent locaux | — |

---

## Synthèse auditeur

| Dimension | Note |
|-----------|------|
| Livrables formels (4 PDF + MD + SUMMARY) | OK |
| Qualité preuve (notes, screenshots, serveurs) | Faible / réserves |
| Couverture parcours critiques | ~80 % — manque (+1) Manager + logout/authz partiels |
| Bugs FIXED | Claims code OK |
| Verdict | **PASS AVEC RÉSERVES** |

Si les points P0 ci-dessus ne sont pas traités avant deadline, le verdict devrait basculer en **FAIL** pour non-rejouabilité + écart brief Manager `(+1)`.
