# QA Report — Recruiter

## 1. Métadonnées

| Champ | Valeur |
|-------|--------|
| Rôle | Recruteur (`RECRUITER`) |
| Email | recruiter@aptely.demo |
| Date | 2026-10-22 |
| URL de base | http://localhost:3000 |
| Durée estimée | ~10 min |

## 2. Checklist pages

| URL | Résultat | Note |
|-----|----------|------|
| `/en/login` | OK | Login OK (après hausse temporaire `AUTH_RATE_LIMIT` pour QA) |
| `/en/company/dashboard` | OK | Badge RECRUITER, sidebar company |
| `/en/company/recruitment/roles` | OK | 4 job post sheets listés |
| `/en/company/recruitment/applications` | OK | TOTAL 0 — empty state OK |
| `/en/company/recruitment/interviews` | OK | 0 interviews |
| `/en/company/calendar` | OK | Calendrier OK ; Cal.com non connecté |
| `/en/company/recruitment/cv-studio` | OK | CV Studio — HR Analysis accessible |
| Logout | OK | |

## 3. Bugs

Aucun bug P0/P1 trouvé sur ce parcours.

## 4. Conclusion

- Bugs trouvés : **0**
- Fixés : **0**
- Ouverts : **0**
