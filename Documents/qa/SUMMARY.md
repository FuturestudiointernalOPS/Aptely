# QA Aptely — Summary (2026-10-22)

**Fenêtre :** smoke test 4 rôles démo · Front `localhost:3000` · API `localhost:4000`  
**Arrêt rédaction PDF :** ~15:45 (deadline 16:00)  
**Correcteur QA :** revalidation Browser MCP 15:32–15:36 WAT

## Health revalidation

| Endpoint | Résultat | Heure (locale WAT) |
|----------|----------|---------------------|
| `http://localhost:3000/` | **HTTP 307** OK | 15:32:49 |
| `http://localhost:4000/health` | **`{"status":"ok","db":"ok"}`** (3/3 essais stables ; 1 spike `degraded` à 15:32:42) | 15:32:49 |

## Tableau global

| Rôle | Email | Pages testées | Bugs trouvés | Fixés | Ouverts | PDF |
|------|-------|---------------|--------------|-------|---------|-----|
| Manager | hiring-manager@aptely.demo | 11 (+1 roles OK ; apps SKIP ; analytics OK post-fix) | 2 | 2 | 0 | `QA_Manager_hiring-manager.pdf` |
| Recruiter | recruiter@aptely.demo | 7 | 0 | 0 | 0 | `QA_Recruiter_recruiter.pdf` |
| Candidate | candidate@aptely.demo | 9 + Logout OK | 0 | 0 | 0 | `QA_Candidate_candidate.pdf` |
| Member | member@aptely.demo | 6 (+permissions read-only + Logout) | 1 | 1 | 0 | `QA_Member_member.pdf` |

## Bugs

| ID | Sévérité | Rôle | Titre | Statut |
|----|----------|------|-------|--------|
| BUG-001 | P1 | Manager | Sidebar candidate intermittente sur `/company/*` (race memberships) | FIXED — `FrontEnd/src/lib/workspace.tsx` |
| BUG-002 | P1 | Member | Deep-link `/roles/create` accessible sans `roles.create` | FIXED — create page + `POST /roles` permission |
| BUG-003 | P1 | Manager | `/company/analytics` ERROR 500 — `.map` on undefined | FIXED — `FrontEnd/src/app/company/analytics/page.tsx` |

## Notes QA

- Auth rate-limit local trop bas pour enchaîner 4 logins → `AUTH_RATE_LIMIT_MAX_REQUESTS=200` temporaire dans `Backend/.env` (QA only) — **non reverté** (signalé équipe).
- Overlay Next.js « issues » sur `apiFetch` console.error en dev : non bloquant (pas P0).
- Member : sidebar sans Recruitment (OK) ; employees affiche denial explicite (OK) ; permissions deep-link = read-only (OK).
- Manager `(+1)` roles : ouverture Architect OK ; applications `(+1)` SKIP motivé (liste vide).

## Totaux

- **Trouvés :** 3  
- **Fixés :** 3  
- **Ouverts :** 0  
