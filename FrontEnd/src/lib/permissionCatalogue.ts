/**
 * B4 — complete permission catalogue for the role editor.
 * Mirrors the backend ALL_PERMISSIONS list plus the legacy `members.manage` umbrella
 * (kept visible for readability but not persisted by the backend).
 */
export type PermissionEntry = {
  key: string;
  fallback: string;
  /** Legacy alias: displayed for information, never editable/persisted. */
  legacyAlias?: boolean;
};

export type PermissionGroup = {
  groupKey: string;
  groupFallback: string;
  perms: PermissionEntry[];
};

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    groupKey: "perm.group.recruitment",
    groupFallback: "Recrutement",
    perms: [
      { key: "applications.view", fallback: "Voir les candidatures" },
      { key: "applications.decide", fallback: "Décider (accepter / refuser)" },
      { key: "interviews.manage", fallback: "Gérer les entretiens" },
      { key: "offers.manage", fallback: "Gérer les offres" },
      { key: "onboarding.manage", fallback: "Gérer l'onboarding" },
      { key: "communications.send", fallback: "Envoyer des communications" },
      { key: "analytics.view", fallback: "Voir les analyses" },
      { key: "roles.create", fallback: "Créer des fiches de poste" },
      { key: "roles.update", fallback: "Modifier des fiches de poste" },
      { key: "roles.delete", fallback: "Supprimer des fiches de poste" },
    ],
  },
  {
    groupKey: "perm.group.team",
    groupFallback: "Équipe & membres",
    perms: [
      { key: "members.view", fallback: "Voir les membres" },
      { key: "members.invite", fallback: "Inviter des membres" },
      { key: "members.remove", fallback: "Retirer / suspendre des membres" },
      { key: "members.roles", fallback: "Gérer les rôles & permissions" },
      {
        key: "members.manage",
        fallback: "Tous les droits membres (alias historique, non modifiable)",
        legacyAlias: true,
      },
    ],
  },
  {
    groupKey: "perm.group.settings",
    groupFallback: "Paramètres",
    perms: [
      { key: "settings.edit", fallback: "Modifier les paramètres de l'institution" },
    ],
  },
  {
    groupKey: "perm.group.employees",
    groupFallback: "Employés",
    perms: [
      { key: "employees.view", fallback: "Voir les employés" },
      { key: "employees.manage", fallback: "Gérer les employés" },
    ],
  },
  {
    groupKey: "perm.group.payroll",
    groupFallback: "Paie",
    perms: [
      { key: "payroll.view", fallback: "Voir la paie" },
      { key: "payroll.manage", fallback: "Gérer la paie" },
    ],
  },
  {
    groupKey: "perm.group.goals",
    groupFallback: "Objectifs & performance",
    perms: [
      { key: "goals.view", fallback: "Voir les objectifs" },
      { key: "goals.manage", fallback: "Gérer les objectifs" },
    ],
  },
  {
    groupKey: "perm.group.retention",
    groupFallback: "Rétention",
    perms: [{ key: "retention.view", fallback: "Voir les analyses de rétention" }],
  },
  {
    groupKey: "perm.group.learning",
    groupFallback: "Learning",
    perms: [{ key: "learning.manage", fallback: "Gérer les plans de développement" }],
  },
  {
    groupKey: "perm.group.compensation",
    groupFallback: "Rémunération",
    perms: [
      { key: "compensation.manage", fallback: "Gérer la rémunération" },
    ],
  },
];

export const PERMISSION_CATALOGUE_SIZE = PERMISSION_GROUPS.reduce(
  (total, group) => total + group.perms.length,
  0
);
