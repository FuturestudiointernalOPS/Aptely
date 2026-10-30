# Aptely Partie 2 — E2E Talent + Sécurité

**Date:** 2026-10-23  
**Branche:** `qa/demo-accounts-smoke-test`  
**Environnement:** localhost:3000 / localhost:4000 (health OK)  
**Source:** `APTELY_Partie_2_Talent_Securite.pdf` + reconstitutions §10 (voir `ROLE_MAPPING.md`)  
**Gap retest:** candidature+CV · isolation 2 orgs · invite activation

## A. Overall Result

**Pass partiel** — S1→S7 exécutés. Gaps précédemment Blocked **Pass** après retest API/UI. 5 bugs Critical/High **FIXED** (dont P2-S7-02 deep-link cross-org). 3 items OPEN (non bloquants sécurité).

## B. Successful Tests

- Super Admin login + liste enterprises + users
- HR/HM: 4 fiches publiées, team members, jobs visibles côté Talent
- Talent profil persisté + historique candidatures
- **Nouvelle candidature Architect + CV** (`35ba8169-…`, PENDING, `application_documents` CV)
- HR voit la nouvelle candidature (TOTAL 9 côté Demo)
- Candidate UI TOTAL **5** (Architect + QA Isolation Role)
- **Org B créée** — liste apps isolée ; API deep-link Org A → 403 ; PATCH → 404
- **Invite E2E** Org B: create link → join → MEMBER listé dans Team
- MEMBER apps → 403 (P2-S7-01)
- UI cross-org deep-link → **Access denied** après fix (P2-S7-02)

## C. Failed Tests

| ID | Steps | Expected | Actual |
|----|-------|----------|--------|
| P2-S1-01 | SA drawer enterprise | Liste fiches | JOB POSTINGS (0) alors metrics=4 |
| P2-S3-01 | Profil save → dashboard | Même % completion | 45% vs 25% |
| P2-S2-01 | HM Interviews page | Voir entretiens dashboard | All (0) assigned-only |

## D. Blocked Tests

- ~~Nouvelle candidature Talent~~ → **Pass** (API multipart ; browser MCP file input toujours non utilisable pour UI pure)
- ~~Isolation 2 enterprises~~ → **Pass** (Org B seed QA)
- ~~Activation invitation~~ → **Pass** sur Org B OWNER (HM Demo n’a pas `members.invite`)

## E. Missing Features

- Module « meetings » nommé : **Not Implemented** ; équivalent = Interviews + Calendar
- Enterprise login séparé : **N/A** — workspace institution
- Invite depuis `hiring-manager@aptely.demo` : pas une feature manquante — **RBAC** (HIRING_MANAGER sans `members.invite`)

## F. Data Relationship Issues

- Admin drawer roles vs company roles count (P2-S1-01)
- Completeness % Talent incohérent (P2-S3-01)
- Team count Admin vs HR settings (à clarifier)
- Org B Applications UI parfois TOTAL 0 alors API renvoie 1 (Needs Investigation UX ; isolation API OK)

## G. Permission and Security Issues

| ID | Finding | Severity | Status |
|----|---------|----------|--------|
| P2-S7-01 | MEMBER deep-link voyait toutes les candidatures | Critical | **FIXED** |
| P2-S7-02 | Org B UI deep-link Org A affichait shell détail + boutons Reject/Validate malgré API 403 | High | **FIXED** |
| — | Cross-enterprise API isolation | — | **Pass** (Org B) |

## H. Application Routing Issues

| ID | Issue | Status |
|----|-------|--------|
| P2-S5-01 | `GET /applications` 500 `overall_score` | **FIXED** |
| P2-S5-02 | Front unwrap `{data,meta}` | **FIXED** |
| P2-S7-02 | `ApplicationPanel` traitait `{isPermissionError}` comme payload app | **FIXED** |

## I. Recommended Fixes (priorisées)

1. ~~P0 Applications 500 + empty UI~~ — FIXED  
2. ~~P0 MEMBER applications.view~~ — FIXED  
3. ~~P1 Cross-org detail UI shell~~ — FIXED  
4. P1 Admin institution drawer roles (P2-S1-01)  
5. P2 Align profile completeness (P2-S3-01)  
6. P2 Clarifier UX Interviews assigned vs company-wide  
7. Optionnel: grant `members.invite` à un rôle Demo HR pour tests sans Org B  

---

## Defect Log

| Test ID | User Role | Feature | Steps | Expected | Actual | Status | Evidence | Severity | Notes | Fix |
|---------|-----------|---------|-------|----------|--------|--------|----------|----------|-------|-----|
| P2-S5-01 | HR | Applications list API | Open /applications | 200 + rows | 500 overall_score | FIXED | s5_* | Critical | | `applications.controller.ts` final_score |
| P2-S5-02 | HR | Applications UI | Same | Show apps | TOTAL 0 | FIXED | s5_* | High | | `api.core.ts` unwrap data |
| P2-S7-01 | Member | Isolation apps | Deep-link /applications | Deny | TOTAL 8 | FIXED | s7_member_sees_applications.png | Critical | | `permissions.middleware.ts` MEMBER:[] |
| P2-S7-02 | Org B Owner | Cross-org deep-link UI | Open Org A app URL | Access denied | Shell + actions | FIXED | gap_s7_cross_org_denied_after_fix.png | High | API already 403 | `ApplicationPanel.tsx` isApiSuccess |
| P2-S4-01 | Talent | New apply + CV | Apply Architect + CV | App + doc | Was Blocked MCP | FIXED/Pass | gap_s4_*.png | — | Via API FormData | — |
| P2-S1-01 | Super Admin | Institution drawer jobs | Open Aptely Demo | List roles | 0 postings | OPEN | s1_company_detail.png | Medium | | — |
| P2-S3-01 | Talent | Completeness % | Save profile | Consistent % | 45 vs 25 | OPEN | s3_profile_persisted.png | Medium | | — |
| P2-S2-01 | HM | Interviews | Open interviews | See scheduled | 0 assigned | OPEN | — | Low | | — |

---

## Acceptance Criteria §10

### Super Admin
- [Pass] View all enterprises  
- [Pass] View platform users  
- [Fail] Enterprise details accurate jobs (members OK, jobs Fail)  
- [Pass] HR associated with correct enterprise  
- [Pass] Talent records accessible in admin users  

### Enterprise and HR
- [Pass] Org information access  
- [Pass] Invite UI + **activation E2E** (Org B OWNER)  
- [Pass] Member relationships  
- [Pass] Create/publish jobs  
- [Pass] Jobs appear to Talents  
- [Needs Investigation] Schedule/view meetings  
- [Needs Investigation] Meeting participants  

### Talent
- [Pass] Login  
- [Pass] Complete/save profile (partial fields)  
- [Needs Investigation] Portfolio materials  
- [Pass] CV attach on apply (API + DB; browser file picker still MCP-limited)  
- [Pass] LinkedIn  
- [Pass] Apply new job  
- [Pass] Application history  
- [Pass] Persist after navigation  

### Recruitment Workflow
- [Pass] HR sees applications (after fix)  
- [Pass] Associated talent+job  
- [Pass] Application info available  
- [Needs Investigation] Full decide/status change UI this session  
- [Pass] Status persist  
- [Pass] Status consistent Talent↔HR  
- [Not Implemented] Notifications E2E  

### Security and Data Consistency
- [Pass partial] User counts  
- [Pass] Employees/HR association  
- [Pass] Super Admin visibility  
- [Pass] HR/Member unauthorised apps  
- [Pass] Cross-enterprise isolation (Org A vs Org B)  
- [Needs Investigation] Talent↔Talent private  
- [Pass] File/application association (CV row)  
- [Pass partial] Cross-interface consistency  

---

## Fichiers code modifiés

- `Backend/src/modules/applications/applications.controller.ts` — `final_score`  
- `FrontEnd/src/lib/api.core.ts` — unwrap `{data,meta}`  
- `Backend/src/middleware/permissions.middleware.ts` — MEMBER/ACTIVE sans `applications.view`  
- `FrontEnd/src/components/ApplicationPanel.tsx` — gate `isApiSuccess` + message Access denied (P2-S7-02)

## Evidence

- `Documents/qa-partie2/screenshots/gap_s4_candidate_apps_with_architect.png`
- `Documents/qa-partie2/screenshots/gap_s7_orgB_applications.png`
- `Documents/qa-partie2/screenshots/gap_s7_cross_org_denied_after_fix.png`
- `Documents/qa-partie2/screenshots/gap_s2_invitee_in_team.png`
- `Documents/qa-partie2/notes/gap_tests_result.json`
