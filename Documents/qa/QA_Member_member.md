# QA Report — Member (employé)

## 1. Métadonnées

| Champ | Valeur |
|-------|--------|
| Rôle | Employé / Member (`MEMBER`) |
| Email | member@aptely.demo |
| Date | 2026-10-22 |
| URL de base | http://localhost:3000 |
| Durée estimée | ~12 min + revalidation authz/logout ~2 min |

## 2. Checklist pages

| URL | Résultat | Note |
|-----|----------|------|
| `/en/login` | OK | → `/en/company/dashboard` |
| `/en/company/dashboard` | OK | Badge MEMBER ; sidebar limitée (Dashboard, Calendar, Settings) — pas de section Recruitment |
| `/en/company/calendar` | OK | Page Calendar charge ; Cal.com non connecté ; aligné notes↔MD |
| `/en/company/employees` | OK | Affiche `Permission denied: employees.view` (attendu) |
| `/en/company/employees/leave` | SKIP | Non retesté après fix authz (même pattern perms) |
| `/en/company/recruitment/roles/create` | OK | Après fix : redirect `/roles` (avant : formulaire complet — BUG-002) |
| `/en/company/settings/permissions` | OK | Deep-link admin : page « Permissions Matrix » accessible en **read-only** (« only role managers can edit ») — denial write documenté |
| Logout | OK | Logout → `/en/login` |

## 3. Bugs

| ID | Sévérité | Page | Steps | Attendu vs obtenu | Statut | Fix / raison |
|----|----------|------|-------|-------------------|--------|--------------|
| BUG-002 | P1 | `/company/recruitment/roles/create` | Login member → ouvrir URL create | Bloqué (pas `roles.create`) vs formulaire create affiché | FIXED | Front: gate `hasPermission('roles.create')` ; Backend: `requirePermission('roles.create')` sur POST `/roles` |

## 4. Conclusion

- Bugs trouvés : **1**
- Fixés : **1**
- Ouverts : **0**
