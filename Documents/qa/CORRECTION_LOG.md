# CORRECTION_LOG — Agent Correcteur QA Aptely

**Date :** 2026-10-22  
**Branche :** `qa/demo-accounts-smoke-test`  
**Fenêtre :** 15:30 → arrêt rédaction ~15:45 (deadline 16:00)  
**Pas de git commit.**

---

## Actions réalisées

### 1. Health revalidation
- Curl (hors sandbox) : Front **HTTP 307**, Backend `{"status":"ok","db":"ok"}` à **15:32:49 WAT**.
- Noté dans `SUMMARY.md` section **Health revalidation**.
- Spike unique `degraded/db:error` observé à 15:32:42 puis 3 essais stables OK.

### 2. Manager (hiring-manager@aptely.demo)
- Login Browser MCP → dashboard OK.
- **Roles (+1) :** OK — ouverture détail **Architect** (`/roles/c993a023-…`).
- **Applications (+1) :** SKIP motivé — « No applications found » (TOTAL 0).
- Retest **organization** OK, **teams** OK.
- **Analytics** : d’abord KO ERROR 500 → **BUG-003** trouvé, fixé &lt;10 min (`byDepartment?.map`), **retesté OK** (HR Analytics + empty states).
- Logout → `/en/login` OK.
- MAJ `notes/manager.json` + `QA_Manager_hiring-manager.md`.

### 3. Candidate
- Login → `/candidate/dashboard` OK → Logout → `/en/login` OK.
- Ligne Logout ajoutée dans `notes/candidate.json` + MD.

### 4. Member
- Login → deep-link `/company/settings/permissions` : page **Permissions Matrix** accessible en **read-only** (« only role managers can edit ») — denial write documenté (pas redirect total).
- Calendar : **OK** (notes↔MD alignés ; fin du SKIP incohérent).
- Logout OK.
- MAJ `notes/member.json` + `QA_Member_member.md`.

### 5. Alignement notes ↔ MD
- `manager.json` : PENDING org/teams/analytics → OK / OK / KO réels.
- `candidate.json` + `member.json` : Logout OK.
- `recruiter.json` : Logout ligne ajoutée (alignement MD, non rejoué).
- Calendar Member : SKIP → OK.

### 6. PDF
- Régénération des 4 PDF via `Documents/qa/generate-pdfs.cjs`.

### 7. Livrables
- `SUMMARY.md`, `CORRECTION_LOG.md` mis à jour.

---

## Nouveaux bugs

| ID | Sévérité | Statut | Description |
|----|----------|--------|-------------|
| BUG-003 | P1 | FIXED | Manager `/company/analytics` ERROR 500 `.map` — fix optional chain `byDepartment`/`monthlyHires` + `averageDays` null-safe ; retest OK |

---

## Ce qui reste OPEN avant 16:00

1. **Applications Manager (+1)** : SKIP data (0 candidatures) — pas de candidature démo visible pour HM ; option seed data hors scope.
2. **Member `/employees/leave`** : toujours SKIP (pattern perms déjà prouvé sur `/employees`).
3. **Screenshots** : non ajoutés (temps) — optionnel.
4. **`AUTH_RATE_LIMIT_MAX_REQUESTS=200`** dans `Backend/.env` : non reverté (QA only) — à signaler / revert équipe.
5. Recruiter : non re-smoke (conforme audit ; hors priorité correcteur).

---

## Réponse manques audit (checklist)

| Manque audit | Statut correcteur |
|--------------|-------------------|
| Serveurs DOWN / health | **FAIT** — UP + preuve SUMMARY |
| Manager roles (+1) | **FAIT** — ouverture Architect |
| Manager applications (+1) | **SKIP motivé** (liste vide) |
| notes manager PENDING | **FAIT** — alignés |
| Logout Candidate / Member | **FAIT** |
| Member permissions deep-link | **FAIT** — read-only documenté |
| Calendar notes↔MD | **FAIT** — OK |
| Screenshots | **NON FAIT** (optionnel) |
