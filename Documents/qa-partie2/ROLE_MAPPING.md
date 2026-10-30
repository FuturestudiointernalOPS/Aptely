# Aptely Partie 2 — Role mapping (real code)

## Structure réelle (≠ PDF à 4 rôles séparés)

| PDF Role | Aptely real | Routes | Demo account |
|----------|-------------|--------|--------------|
| Super Admin | `super_admins` table + `/admin/*` | `/admin`, `/admin/users`, `/admin/institutions`, `/admin/metrics` | **`superadmin@aptely.demo`** (seed: `npm run ensure:demo-superadmin` dans `Backend/`) — ancien `gclud79@gmail.com` obsolète / non rejouable |
| Enterprise | Company workspace (`institutions`) — pas un rôle user séparé | `/company/*` settings/org | Même org pour tous les HR démo |
| HR | `institution_members.role_specialization` : OWNER, ADMIN, HR_LEAD, STANDARD_HR, HIRING_MANAGER, RECRUITER, MEMBER | `/company/recruitment/*`, settings | `hiring-manager@aptely.demo`, `recruiter@aptely.demo` |
| Employee | MEMBER (permissions limitées) | `/company/*` sans Recruitment | `member@aptely.demo` |
| Talent | Candidate portal (`profiles.role=CANDIDATE`) | `/candidate/*` | `candidate@aptely.demo` |

Password démo : `AptelyDemo123!`

## Reconstitutions PDF

### S1 Expected Result (PDF tronqué / mélangé)
Le PDF après « Expected Result » pour Super Admin contient des bullets Meeting/calendar qui appartiennent à S2 (HR).  
**Reconstitué depuis §10 Super Admin** :
- Voir toutes les enterprises enregistrées
- Voir les users plateforme dans le scope
- Détail enterprise : users / membres exacts
- HR associés à la bonne enterprise
- Records Talent accessibles comme prévu (scope admin)

### S2 Meetings
PDF demande « schedule meetings ». Dans Aptely : `/company/recruitment/interviews` + `/company/calendar` (Cal.com optionnel). Pas de module « meetings » séparé nommé ainsi.

### Enterprise vs HR
Dans le code, Enterprise ≠ compte séparé : c’est le **workspace institution**. HR = membres avec permissions recrutement.
