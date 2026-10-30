# QA Report — Candidate

## 1. Métadonnées

| Champ | Valeur |
|-------|--------|
| Rôle | Candidat |
| Email | candidate@aptely.demo |
| Date | 2026-10-22 |
| URL de base | http://localhost:3000 |
| Durée estimée | ~10 min + logout revalidation ~1 min |

## 2. Checklist pages

| URL | Résultat | Note |
|-----|----------|------|
| `/en/login` | OK | Redirect → `/en/candidate/dashboard` |
| `/en/candidate/dashboard` | OK | 3 candidatures, sidebar candidat |
| `/en/candidate/profile` | OK | Capability record (0% completeness) |
| `/en/candidate/vault` | OK | Proofs empty state OK |
| `/en/candidate/opportunities` | OK | Browse jobs OK |
| `/en/candidate/prep` | OK | Interview Prep Centre OK |
| `/en/candidate/offers` | OK | Offer hub empty OK |
| `/en/candidate/messages` | OK | Messages empty OK |
| `/en/company/recruitment/roles/create` | OK | Bloqué → access-status (institution required) |
| Logout | OK | Logout explicite → `/en/login` (revalidation correcteur 15:34) |

## 3. Bugs

Aucun bug P0/P1 trouvé sur ce parcours.

## 4. Conclusion

- Bugs trouvés : **0**
- Fixés : **0**
- Ouverts : **0**
