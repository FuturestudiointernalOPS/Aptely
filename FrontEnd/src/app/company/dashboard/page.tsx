import {
  getMeServer,
  getMyPermissionsServer,
  getDashboardStatsServer,
  getRecentRolesServer,
  getRecentApplicationsServer,
  getInstitutionInterviewsServer,
  getMyUpcomingInterviewsServer,
} from "@/lib/apiServer";
import {
  Briefcase,
  Users,
  CheckCircle,
  ChevronRight,
  UserCircle,
  MapPin,
  CalendarRange,
  ScanEye,
  ArrowUpRight,
  FileSearch,
  Building2,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SessionRecovery } from "@/components/SessionRecovery";
import { getServerLocale, t, Locale } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { ROUTES, createAuthRedirect, interviewNotesPath, rolePath } from "@/lib/routes";


function relativeTime(iso: string, locale: Locale): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return t(locale, "dashboard.time.justNow", "Just now");
  if (m < 60) return t(locale, "dashboard.time.minAgo", "{{m}} min ago", { m });
  const h = Math.floor(m / 60);
  if (h < 24) {
    const key = h > 1 ? "dashboard.time.hoursAgo" : "dashboard.time.hourAgo";
    return t(locale, key, `{{h}} hour${h > 1 ? "s" : ""} ago`, { h });
  }
  const d = Math.floor(h / 24);
  const key = d > 1 ? "dashboard.time.daysAgo" : "dashboard.time.dayAgo";
  return t(locale, key, `{{d}} day${d > 1 ? "s" : ""} ago`, { d });
}

function formatDateTime(iso: string | null, locale: Locale): string {
  if (!iso) return "-";
  const dateLocale = locale === "en" ? "en-US" : "fr-FR";
  return new Date(iso).toLocaleString(dateLocale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage() {
  const locale = await getServerLocale();
  const me = await getMeServer();
  if (!me) {
    // Access token expired (or transient backend error) but the session may still
    // be alive: let the client rotate it instead of bouncing to the login page.
    const cookieStore = await cookies();
    if (!cookieStore.has("hr_refresh_token")) {
      redirect(createAuthRedirect(ROUTES.company.dashboard));
    }
    return <SessionRecovery returnTo={ROUTES.company.dashboard} />;
  }

  if (!me.institutionId) {
    return (
      <div className="min-h-screen bg-[var(--bg-deep)] flex items-center justify-center">
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-8 max-w-md text-center space-y-4">
          <Building2 className="w-12 h-12 text-[var(--text-muted)] mx-auto" />
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            {t(locale, "dashboard.noInstitution", "Aucun espace de travail")}
          </h2>
          <p className="text-sm text-[var(--text-muted)]">
            {t(locale, "dashboard.noInstitutionDesc", "Votre compte n'est rattaché à aucune entreprise. Créez ou rejoignez un espace de travail pour accéder au tableau de bord.")}
          </p>
          <div className="flex gap-3 justify-center pt-2">
            <Link href={ROUTES.workspaces.new} className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-white hover:opacity-90">
              {t(locale, "dashboard.createWorkspace", "Créer un espace")}
            </Link>
            <Link href={ROUTES.admin.root} className="rounded-xl border border-[var(--border)] px-5 py-2.5 text-sm font-bold text-[var(--text-secondary)] hover:border-[var(--accent)]">
              {t(locale, "admin.backToSpace", "Retour à l'admin")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const [stats, roles, recentApplications, perms] = await Promise.all([
    getDashboardStatsServer(),
    getRecentRolesServer(5),
    getRecentApplicationsServer(5),
    getMyPermissionsServer(),
  ]);

  // The owner has no role_specialization (only the OWNER membership status).
  const roleKey = perms.roleSpecialization ?? perms.membershipStatus ?? "";
  // Recruiters and hiring managers only see the interviews they take part in;
  // everyone else with interviews.manage sees the company-wide upcoming ones.
  const interviewsAssignedOnly = roleKey === "RECRUITER" || roleKey === "HIRING_MANAGER";
  const interviews = interviewsAssignedOnly
    ? await getMyUpcomingInterviewsServer(3)
    : await getInstitutionInterviewsServer(3, { upcomingOnly: true });

  // One dashboard profile per level of responsibility.
  const profileKey =
    ["OWNER", "ADMIN", "HR_LEAD", "STANDARD_HR", "HIRING_MANAGER", "RECRUITER"].includes(roleKey)
      ? roleKey
      : ["MEMBER", "ACTIVE"].includes(roleKey)
      ? "MEMBER"
      : "DEFAULT";
  const PROFILE_DEFAULTS: Record<string, { title: string; subtitle: string }> = {
    OWNER: { title: "Company overview", subtitle: "Hiring and team at a glance" },
    ADMIN: { title: "Company administration", subtitle: "Team and hiring operations" },
    HR_LEAD: { title: "HR Command Center", subtitle: "Real-time role and talent management" },
    STANDARD_HR: { title: "HR workspace", subtitle: "Applications, interviews and offers" },
    HIRING_MANAGER: { title: "Hiring manager workspace", subtitle: "Your candidates and interviews" },
    RECRUITER: { title: "Recruiter workspace", subtitle: "Applications to screen and your interviews" },
    MEMBER: { title: "My workspace", subtitle: "Your company space" },
    DEFAULT: { title: "Dashboard", subtitle: "Your company space" },
  };
  const profile = PROFILE_DEFAULTS[profileKey];

  // Permission gating (OWNER's set already contains every permission).
  const can = (p: string) => perms.permissions.includes(p);
  const canApps = can("applications.view");
  const canInterviews = can("interviews.manage");
  const canQueue = can("applications.decide") || can("offers.manage");
  const canRolesManage = can("roles.create") || can("roles.update");
  const canMembers = can("members.view");
  const canSettings = can("settings.edit");
  // Show the recruitment-focused dashboard body only if the caller has any of these.
  const hasAnyDashboard = canApps || canInterviews || canQueue || canMembers;

  const activeRolesNeedingAttention = stats.activeRolesWithoutApplications;

  const fallbackApplicationActivities = recentApplications.map((application, index) => ({
    activityId: `app-${application.applicationId}-${index}`,
    type: "APPLICATION_RECEIVED" as const,
    message: t(locale, "dashboard.activity.applicationReceived", "{{candidate}} applied to \"{{role}}\"", {
      candidate: application.candidateName,
      role: application.roleTitle || "",
    }),
    createdAt: application.submittedAt,
  }));

  const fallbackRoleActivities = roles.map((role, index) => ({
    activityId: `role-${role.roleId}-${index}`,
    type: "ROLE_CREATED" as const,
    message: t(locale, "dashboard.activity.roleCreated", "New job post \"{{role}}\" was created", {
      role: role.title,
    }),
    createdAt: role.createdAt,
  }));

  // Always use translated fallback arrays — backend activity messages are hardcoded EN
  const activityFeed = [...fallbackApplicationActivities, ...fallbackRoleActivities]
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 pb-10">

      {/* ── Page header ── */}
      <div className="animate-fade-in-up">
        <PageHeader
          title={t(locale, `dashboard.profile.${profileKey}.title`, profile.title)}
          subtitle={t(locale, `dashboard.profile.${profileKey}.subtitle`, profile.subtitle)}
          actions={
            (canInterviews || canRolesManage) && (
              <>
                {canInterviews && (
                  <Link
                    href={ROUTES.company.recruitment.interviews}
                    className="inline-flex items-center gap-1.5 text-sm text-[var(--accent)] font-semibold hover:opacity-80 transition-opacity"
                  >
                    {t(locale, "dashboard.stats.interviews", "Open interview tracking")}
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                )}
                {canRolesManage && (
                  <Link
                    href={ROUTES.company.recruitment.rolesCreate}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 transition-opacity flex-shrink-0 whitespace-nowrap"
                  >
                    <Briefcase className="w-3.5 h-3.5" />
                    {t(locale, "dashboard.createRole", "Create job post")}
                  </Link>
                )}
              </>
            )
          }
        />
      </div>

      {/* ── Stat strip — single horizontal row, no cards ── */}
      {canApps && (
      <div
        className="grid grid-cols-2 gap-px bg-[var(--border)] lg:flex lg:items-center lg:gap-0 lg:bg-[var(--bg-surface)] lg:divide-x lg:divide-[var(--border)] border border-[var(--border)] rounded-xl overflow-hidden lg:overflow-x-auto animate-fade-in-up"
        style={{ animationDelay: "30ms" }}
      >
        {canApps && (
        <Link
          href={ROUTES.company.recruitment.applications}
          className="flex flex-col gap-0.5 bg-[var(--bg-surface)] px-3 sm:px-5 py-2.5 sm:py-3.5 hover:bg-[var(--bg-raised)] transition-colors duration-150 flex-1 min-w-[80px]"
        >
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            {t(locale, "dashboard.stats.toProcess", "To Process")}
          </span>
          <span className="text-lg sm:text-xl font-bold tabular-nums text-[var(--text-primary)]">
            {stats.pendingApplications}
          </span>
        </Link>
        )}

        {canApps && (
        <Link
          href={ROUTES.company.recruitmentApplicationsAnalysing}
          className="flex flex-col gap-0.5 bg-[var(--bg-surface)] px-3 sm:px-5 py-2.5 sm:py-3.5 hover:bg-[var(--bg-raised)] transition-colors duration-150 flex-1 min-w-[80px]"
        >
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            {t(locale, "dashboard.stats.inReview", "Screening")}
          </span>
          <span className="text-lg sm:text-xl font-bold tabular-nums text-[var(--text-primary)]">
            {stats.analyzingApplications}
          </span>
        </Link>
        )}

        {canApps && (
        <Link
          href={ROUTES.company.recruitment.applications}
          className="flex flex-col gap-0.5 bg-[var(--bg-surface)] px-3 sm:px-5 py-2.5 sm:py-3.5 hover:bg-[var(--bg-raised)] transition-colors duration-150 flex-1 min-w-[80px]"
        >
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            {t(locale, "dashboard.stats.validated", "Validated")}
          </span>
          <span className="text-lg sm:text-xl font-bold tabular-nums text-[var(--text-primary)]">
            {stats.validatedApplications}
          </span>
        </Link>
        )}

        {canApps && (
        <Link
          href={ROUTES.company.recruitment.roles}
          className="flex flex-col gap-0.5 bg-[var(--bg-surface)] px-3 sm:px-5 py-2.5 sm:py-3.5 hover:bg-[var(--bg-raised)] transition-colors duration-150 flex-1 min-w-[80px]"
        >
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            {t(locale, "dashboard.cards.activeRoles", "Open Roles")}
          </span>
          <span className="text-lg sm:text-xl font-bold tabular-nums text-[var(--text-primary)]">
            {stats.activeRoles}
          </span>
        </Link>
        )}
      </div>
      )}

      {/* ── Upcoming Interviews ── */}
      {canInterviews && (
      <section
        className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5 animate-fade-in-up"
        style={{ animationDelay: "240ms" }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            {interviewsAssignedOnly
              ? t(locale, "dashboard.myUpcomingInterviews", "My upcoming interviews")
              : t(locale, "dashboard.upcomingInterviews", "Upcoming interviews")}
          </h2>
          <Link href={ROUTES.company.recruitment.interviews} className="text-[var(--accent)] text-xs font-semibold hover:opacity-80 transition-opacity">
            {t(locale, "dashboard.openInterviews", "Open interviews")}
          </Link>
        </div>

        {interviews.length === 0 ? (
          <div className="rounded-lg border border-[var(--border)] p-6 flex flex-col items-center gap-3">
            <CalendarRange className="w-8 h-8 text-[var(--text-muted)]" />
            <p className="text-sm text-[var(--text-muted)] text-center">
              {t(locale, "dashboard.noInterviews", "No interviews scheduled yet.")}
            </p>
            <Link href={ROUTES.company.recruitment.interviews} className="text-xs text-[var(--accent)] font-semibold hover:opacity-80 transition-opacity">
              {t(locale, "dashboard.scheduleInterview", "Schedule an interview")}
            </Link>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {interviews.map((interview) => (
              <li key={interview.id}>
                <Link
                  href={interviewNotesPath(interview.applicationId, interview.id)}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-4 py-2.5 hover:border-[var(--accent)] hover:bg-[var(--bg-raised)] transition-all duration-150"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">{interview.candidateName}</p>
                    <p className="text-xs text-[var(--text-secondary)] truncate">{interview.roleTitle}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-[var(--text-muted)]">{formatDateTime(interview.scheduledAt, locale)}</p>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{t(locale, `interviewer.status.${interview.status?.toLowerCase()}`, interview.status)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      )}

      {/* ── Activity + Roles grid ── */}
      {canApps && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">

        {/* Recent Activity — timeline format */}
        <div
          className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5 animate-fade-in-up"
          style={{ animationDelay: "300ms" }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              {t(locale, "dashboard.recentActivity", "Recent Activity")}
            </h2>
            <Link href={ROUTES.company.dashboard} className="text-[var(--accent)] text-xs font-semibold hover:opacity-80 transition-opacity">
              {t(locale, "dashboard.refresh", "Refresh")}
            </Link>
          </div>
          {activityFeed.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <FileSearch className="w-8 h-8 text-[var(--text-muted)]" />
              <p className="text-[var(--text-muted)] text-sm text-center">
                {t(locale, "dashboard.noActivity", "No recent activity detected.")}
              </p>
            </div>
          ) : (
            <ul className="space-y-0">
              {activityFeed.map((activity, idx) => (
                <li key={activity.activityId} className="flex gap-2 sm:gap-3">
                  {/* Timeline spine */}
                  <div className="flex flex-col items-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] mt-1.5 flex-shrink-0" />
                    {idx < activityFeed.length - 1 && (
                      <div className="w-px flex-1 bg-[var(--border)] mt-1 mb-1" />
                    )}
                  </div>
                  {/* Content */}
                  <div className={`flex-1 min-w-0 ${idx < activityFeed.length - 1 ? 'pb-4' : ''}`}>
                    <p className="text-sm text-[var(--text-primary)] leading-snug">{activity.message}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5" suppressHydrationWarning>{relativeTime(activity.createdAt, locale)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Current Role DNAs */}
        <div
          className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5 animate-fade-in-up"
          style={{ animationDelay: "360ms" }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              {t(locale, "dashboard.currentRoles", "Recent job posts")}
            </h2>
            <Link href={ROUTES.company.recruitment.roles} className="text-[var(--accent)] text-xs font-semibold hover:opacity-80 transition-opacity">
              {t(locale, "dashboard.viewAllRoles", "View all roles")}
            </Link>
          </div>
          {roles.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Briefcase className="w-8 h-8 text-[var(--text-muted)]" />
              <p className="text-[var(--text-muted)] text-sm text-center">
                {t(locale, "dashboard.noRoles", "No role DNAs created yet.")}
              </p>
              {canRolesManage && (
              <Link href={ROUTES.company.recruitment.rolesCreate} className="text-sm text-[var(--accent)] font-semibold hover:opacity-80 transition-opacity">
                {t(locale, "dashboard.createFirstRole", "Create your first role")}
              </Link>
              )}
            </div>
          ) : (
            <ul className="space-y-1.5">
              {roles.map((role) => (
                <li key={role.roleId}>
                  <Link
                    href={rolePath(role.roleId)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--bg-raised)] transition-all duration-150 group"
                  >
                    <div className="w-7 h-7 rounded-md bg-[var(--accent-dim)] flex items-center justify-center text-[var(--accent)] flex-shrink-0">
                      <Briefcase className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">{role.title}</p>
                      <div className="flex items-center gap-2 text-[var(--text-muted)] text-xs mt-0.5">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {role.location || t(locale, "roles.dashboard.locationPlaceholder", "Complete Job Post Sheet to add location")}
                        </span>
                        <span>·</span>
                        <span className="text-[var(--accent)]">
                          {t(locale, "dashboard.applicantsCount", "{{count}} applicants", { count: role.applicationsCount })}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors flex-shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      )}

      {/* ── Team summary strip ── */}
      {canMembers && (
      <div
        className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-4 sm:px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-5 animate-fade-in-up"
        style={{ animationDelay: "420ms" }}
      >
        <div className="w-9 h-9 rounded-lg bg-[var(--bg-raised)] border border-[var(--border)] flex items-center justify-center flex-shrink-0">
          <UserCircle className="w-5 h-5 text-[var(--text-secondary)]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            {stats.activeHRMembers === 1
              ? t(locale, "dashboard.teamActive_one", "1 Team Member Active")
              : t(locale, "dashboard.teamActive", "{{count}} Team Members Active", { count: stats.activeHRMembers })}
          </p>
        </div>
        <Link
          href={ROUTES.company.settings.hr}
          className="w-full sm:w-auto flex-shrink-0 px-3.5 py-2.5 sm:py-2 text-sm font-semibold text-center text-[var(--accent)] bg-[var(--accent-dim)] border border-[var(--accent)] rounded-lg hover:opacity-90 transition-opacity"
        >
          {t(locale, "dashboard.manageTeam", "Manage Team")}
        </Link>
      </div>
      )}

      {/* ── Pipeline health mini-stats ── */}
      {canApps && (
      <div
        className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm text-[var(--text-muted)] animate-fade-in-up"
        style={{ animationDelay: "500ms" }}
      >
        <Users className="w-4 h-4 flex-shrink-0" />
        <span>
          {t(locale, "dashboard.health.noCandidate", "Roles without candidates")}:{" "}
          <strong className="text-[var(--text-primary)] font-semibold">{activeRolesNeedingAttention}</strong>
        </span>
      </div>
      )}

      {/* ── Empty state when the caller has no recruitment-facing permissions ── */}
      {!hasAnyDashboard && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-8 flex flex-col items-center gap-3 text-center animate-fade-in-up">
          <ScanEye className="w-8 h-8 text-[var(--text-muted)]" />
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            {t(locale, "dashboard.empty.title", "Rien à afficher ici")}
          </p>
          <p className="text-sm text-[var(--text-muted)] max-w-md">
            {t(locale, "dashboard.empty.desc", "Votre rôle n'a pas encore accès aux modules de recrutement. Utilisez le menu latéral pour accéder à vos espaces.")}
          </p>
          <Link
            href={ROUTES.company.calendar}
            className="mt-1 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <CalendarRange className="w-3.5 h-3.5" />
            {t(locale, "dashboard.empty.cta", "Ouvrir mon agenda")}
          </Link>
        </div>
      )}

    </div>
  );
}
