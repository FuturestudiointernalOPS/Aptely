import { notFound } from "next/navigation";
import { Shield, Star, Briefcase, GraduationCap, Award, Globe, Linkedin, Github, MapPin, FileText } from "lucide-react";
import { getServerLocale, t } from "@/lib/i18n";
import { individualPublicProfileApi } from "@/lib/routes";

export const dynamic = "force-dynamic";

interface PublicProfile {
  headline?: string;
  bio?: string;
  location?: string;
  availability?: string;
  skills?: Array<{ name: string; level: string } | string>;
  experience?: Array<{ title?: string; company?: string; start_date?: string; end_date?: string; current?: boolean }>;
  education?: Array<{ degree?: string; institution?: string; start_year?: number; current?: boolean }>;
  certifications?: Array<{ name?: string; issuer?: string; year?: number } | string>;
  languages?: string[];
  website_url?: string;
  linkedin_url?: string;
  github_url?: string;
}

interface SkillProof {
  skill_name: string;
  proof_type: string;
  title: string;
  description?: string;
  link_url?: string;
  created_at: string;
}

interface WorkEvidence {
  title: string;
  problem?: string;
  tools?: string[];
  result?: string;
  impact_score?: number;
  created_at: string;
}

interface Endorsement {
  dimension: string;
  rating: number;
  comment?: string;
  submitted_at: string;
}

interface PublicProfileData {
  profile: PublicProfile;
  skill_proofs: SkillProof[];
  work_evidence: WorkEvidence[];
  endorsements: Endorsement[];
  cv_url?: string | null;
}

async function fetchPublicProfile(token: string): Promise<PublicProfileData | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  try {
    const res = await fetch(`${apiUrl}${individualPublicProfileApi(token)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = await res.json() as { data?: PublicProfileData };
    return body.data ?? null;
  } catch {
    return null;
  }
}

export default async function PublicProfilePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [data, locale] = await Promise.all([fetchPublicProfile(token), getServerLocale()]);
  if (!data) notFound();

  const { profile, skill_proofs, work_evidence, endorsements } = data;

  const SKILL_LEVEL_CFG: Record<string, string> = {
    EXPERT:       "bg-orange-50 text-orange-700 border-orange-200",
    ADVANCED:     "bg-emerald-50 text-emerald-700 border-emerald-200",
    INTERMEDIATE: "bg-blue-50 text-blue-700 border-blue-200",
    BEGINNER:     "bg-gray-50 text-gray-500 border-gray-200",
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Sticky header */}
      <header className="border-b border-gray-100 bg-white/95 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-orange-500 tracking-tight">Aptely</span>
            <span className="text-gray-200">·</span>
            <span className="text-xs text-gray-400">{t(locale, "individual.publicProfile.capabilityRecord", "Capability Record")}</span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{t(locale, "individual.publicProfile.readOnly", "Read-only view")}</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        {/* Identity */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1 min-w-0">
              {profile.headline && (
                <h1 className="text-2xl font-bold text-gray-900 leading-tight">{profile.headline}</h1>
              )}
              <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                {profile.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> {profile.location}
                  </span>
                )}
                {profile.availability && (
                  <span className="inline-flex items-center gap-1.5 text-emerald-600 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                    {profile.availability}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {profile.website_url && (
                <a href={profile.website_url} target="_blank" rel="noopener noreferrer"
                  className="p-2 rounded-lg border border-gray-200 hover:border-orange-400 text-gray-400 hover:text-orange-500 transition-colors"
                  aria-label={t(locale, "publicProfile.websiteAria", "Website")}>
                  <Globe className="w-4 h-4" />
                </a>
              )}
              {profile.linkedin_url && (
                <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer"
                  className="p-2 rounded-lg border border-gray-200 hover:border-orange-400 text-gray-400 hover:text-orange-500 transition-colors"
                  aria-label="LinkedIn">
                  <Linkedin className="w-4 h-4" />
                </a>
              )}
              {profile.github_url && (
                <a href={profile.github_url} target="_blank" rel="noopener noreferrer"
                  className="p-2 rounded-lg border border-gray-200 hover:border-orange-400 text-gray-400 hover:text-orange-500 transition-colors"
                  aria-label="GitHub">
                  <Github className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
          {profile.bio && (
            <p className="text-sm text-gray-600 leading-relaxed max-w-[65ch]">{profile.bio}</p>
          )}
          {profile.skills && profile.skills.length > 0 && (
            <div className="pt-3 border-t border-gray-100">
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2">{t(locale, "individual.publicProfile.skills", "Skills")}</p>
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((s, i) => {
                  const name = typeof s === "object" ? s.name : s;
                  const level = typeof s === "object" ? s.level : undefined;
                  const levelCls = level ? (SKILL_LEVEL_CFG[level] ?? SKILL_LEVEL_CFG.BEGINNER) : "bg-gray-50 text-gray-500 border-gray-200";
                  return (
                    <span key={i} className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${levelCls}`}>
                      {name}
                      {level && <span className="opacity-50 text-[10px] font-bold">{level.charAt(0)}</span>}
                    </span>
                  );
                })}
              </div>
              {profile.skills.some((s) => typeof s === "object" && s.level) && (
                <p className="text-[10px] text-gray-400 mt-2">
                  {t(locale, "individual.publicProfile.skillLegend", "B = Beginner · I = Intermediate · A = Advanced · E = Expert")}
                </p>
              )}
            </div>
          )}
        </div>

        {/* CV / Resume */}
        {data.cv_url && (
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[var(--accent)]" />
              <h2 className="text-sm font-bold text-gray-800">{t(locale, "individual.publicProfile.cv", "CV / Resume")}</h2>
            </div>
            <a
              href={data.cv_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <FileText className="w-4 h-4" />
              {t(locale, "publicProfile.viewCv", "View CV")}
            </a>
          </div>
        )}

        {/* Skill Proofs */}
        {skill_proofs.length > 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-orange-500" />
              <h2 className="text-sm font-bold text-gray-800">{t(locale, "individual.publicProfile.verifiedSkills", "Verified Skills")}</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {skill_proofs.map((p, i) => (
                <div key={i} className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-gray-800">{p.skill_name}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${p.proof_type === "FILE" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>
                      {p.proof_type === "FILE" ? t(locale, "individual.publicProfile.proofFile", "File") : t(locale, "individual.publicProfile.proofLink", "Link")}
                    </span>
                  </div>
                  <p className="text-xs text-gray-700 font-medium">{p.title}</p>
                  {p.description && <p className="text-[10px] text-gray-500 leading-relaxed">{p.description}</p>}
                  {p.link_url && (
                    <a href={p.link_url} target="_blank" rel="noopener noreferrer"
                      className="text-[10px] text-orange-500 hover:underline block truncate">
                      {p.link_url}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Work Evidence */}
        {work_evidence.length > 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-orange-500" />
              <h2 className="text-sm font-bold text-gray-800">{t(locale, "individual.publicProfile.workEvidence", "Work Evidence")}</h2>
            </div>
            <div className="space-y-3">
              {work_evidence.map((w, i) => (
                <div key={i} className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-gray-800">{w.title}</p>
                    {w.impact_score != null && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                        {t(locale, "individual.publicProfile.impact", "Impact")} {w.impact_score}/10
                      </span>
                    )}
                  </div>
                  {w.problem && (
                    <div>
                      <p className="text-[10px] font-bold uppercase text-gray-400">{t(locale, "individual.publicProfile.challenge", "Challenge")}</p>
                      <p className="text-xs text-gray-600">{w.problem}</p>
                    </div>
                  )}
                  {w.result && (
                    <div>
                      <p className="text-[10px] font-bold uppercase text-gray-400">{t(locale, "individual.publicProfile.result", "Result")}</p>
                      <p className="text-xs text-gray-600">{w.result}</p>
                    </div>
                  )}
                  {w.tools && w.tools.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {w.tools.map((tool) => (
                        <span key={tool} className="text-[10px] px-2 py-0.5 rounded-full border border-gray-200 text-gray-500 bg-white">{tool}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Endorsements */}
        {endorsements.length > 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-orange-500" />
              <h2 className="text-sm font-bold text-gray-800">{t(locale, "individual.publicProfile.endorsements", "Endorsements")}</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {endorsements.map((e, i) => (
                <div key={i} className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-gray-800">{e.dimension}</p>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <Star
                          key={j}
                          className={`w-3 h-3 ${j < e.rating ? "text-orange-400 fill-orange-400" : "text-gray-200"}`}
                        />
                      ))}
                    </div>
                  </div>
                  {e.comment && <p className="text-xs text-gray-500 italic">&ldquo;{e.comment}&rdquo;</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Experience */}
        {profile.experience && profile.experience.length > 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-orange-500" />
              <h2 className="text-sm font-bold text-gray-800">{t(locale, "individual.publicProfile.experience", "Experience")}</h2>
            </div>
            <ul className="space-y-3">
              {profile.experience.map((exp, i) => (
                <li key={i} className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                  <div className="mt-1.5 w-2 h-2 rounded-full bg-orange-300 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{exp.title}</p>
                    <p className="text-xs text-gray-500">{exp.company ?? ""}</p>
                    {exp.start_date && (
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {exp.start_date} – {exp.current ? t(locale, "individual.publicProfile.present", "Present") : (exp.end_date ?? "")}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Education / Certifications */}
        {((profile.education && profile.education.length > 0) || (profile.certifications && profile.certifications.length > 0)) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {profile.education && profile.education.length > 0 && (
              <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-orange-500" />
                  <h2 className="text-sm font-bold text-gray-800">{t(locale, "individual.publicProfile.education", "Education")}</h2>
                </div>
                <ul className="space-y-1.5">
                  {profile.education.map((e, i) => (
                    <li key={i} className="text-xs text-gray-600">
                      <span className="font-semibold text-gray-800">{e.degree}</span>
                      {e.institution && <span> · {e.institution}</span>}
                      {e.start_year && <span className="text-gray-400"> · {e.start_year}{e.current ? ` – ${t(locale, "individual.publicProfile.present", "Present")}` : ""}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {profile.certifications && profile.certifications.length > 0 && (
              <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-orange-500" />
                  <h2 className="text-sm font-bold text-gray-800">{t(locale, "individual.publicProfile.certifications", "Certifications")}</h2>
                </div>
                <ul className="space-y-1.5">
                  {profile.certifications.map((c, i) => (
                    <li key={i} className="text-xs text-gray-600">
                      {typeof c === "string" ? c : `${c.name ?? ""}${c.issuer ? ` · ${c.issuer}` : ""}${c.year ? ` · ${c.year}` : ""}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-center gap-2 pb-8 pt-2">
          <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">Aptely</span>
          <span className="text-gray-200 text-[10px]">·</span>
          <span className="text-[10px] text-gray-400">{t(locale, "individual.publicProfile.footer", "This link expires after 30 days")}</span>
        </div>
      </main>
    </div>
  );
}
