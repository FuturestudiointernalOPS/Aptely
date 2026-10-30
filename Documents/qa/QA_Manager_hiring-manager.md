# QA Report — Manager (hiring-manager)

## 1. Métadonnées

| Champ | Valeur |
|-------|--------|
| Rôle | Manager recruteur (`HIRING_MANAGER`) |
| Email | hiring-manager@aptely.demo |
| Date | 2026-10-22 |
| URL de base | http://localhost:3000 |
| API | http://localhost:4000/health = OK (revalidé 15:32:49 WAT) |
| Durée estimée | ~12 min + revalidation correcteur ~4 min |
| Environnement | Local staging Supabase |

## 2. Checklist pages

| URL | Résultat | Note |
|-----|----------|------|
| `/en/login` | OK | Login → `/en/company/dashboard` |
| `/en/company/dashboard` | OK | Dashboard charge ; badge HIRING MANAGER |
| `/en/company/recruitment/roles` | OK | 4 job posts listés après hydrate |
| `/en/company/recruitment/roles/{id}` **(+1)** | OK | Ouverture rôle **Architect** (`…/roles/c993a023-ebc1-42fb-ba9f-cf9ee3b624fd`) |
| `/en/company/recruitment/applications` **(+1)** | SKIP | « No applications found » — TOTAL 0, aucune candidature à ouvrir |
| `/en/company/recruitment/interviews` | OK | 3 entretiens / scorecards visibles |
| `/en/company/recruitment/offers` | OK | 0 offres ; overlay console `apiFetch` en dev |
| `/en/company/settings/organization` | OK | Organisation / départements (0 departments) — retesté 15:33 |
| `/en/company/settings/teams` | OK | Find Your Team (No institutions found) — retesté 15:33 |
| `/en/company/analytics` | OK | Après BUG-003 : HR Analytics charge (empty states) — retesté 15:39 |
| Logout | OK | Clear session → `/en/login` |

## 3. Bugs

| ID | Sévérité | Page | Steps | Attendu vs obtenu | Statut | Fix / raison |
|----|----------|------|-------|-------------------|--------|--------------|
| BUG-001 | P1 | Sidebar `/company/*` | Login HM → land dashboard avant hydrate memberships | Sidebar company + badge HM vs sidebar CANDIDAT intermittente | FIXED | `FrontEnd/src/lib/workspace.tsx` : garder mode institution pendant loading / échec memberships + retry fetch |
| BUG-003 | P1 | `/company/analytics` | Login HM → analytics | Page analytics vs ERROR 500 `.map` undefined | FIXED | `analytics/page.tsx` : `byDepartment?.map` / `monthlyHires?.map` + `averageDays` null-safe |

## 4. Conclusion

- Bugs trouvés : **2**
- Fixés : **2**
- Ouverts : **0**
