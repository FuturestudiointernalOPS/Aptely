import { ReactNode, useEffect, useState } from "react";
import { appPath } from "@/lib/routes";
import { Loader2, FileText, Download, ExternalLink } from "lucide-react";
import { getApplicationById, getApplicationDocuments, ApplicationDocument } from "@/lib/api";
import Link from "next/link";
import { getClientLocale, t } from "@/lib/i18n";
import Modal from "@/components/ui/Modal";

interface CandidateApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  applicationId: string | null;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bg-[var(--bg-surface)] border border-[var(--border)] p-5">
      <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)] mb-3">{title}</h3>
      <div className="text-sm text-[var(--text-secondary)] space-y-2">{children}</div>
    </section>
  );
}

function KeyValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-bold">{label}</p>
      <div>{value}</div>
    </div>
  );
}

function displayValue(value: unknown, locale: any): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value.trim() ? value : "-";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? t(locale, "common.yes", "Yes") : t(locale, "common.no", "No");
  return "-";
}

function isUrl(value: unknown): boolean {
  if (typeof value !== "string" || !value.trim()) return false;
  return value.trim().startsWith("http://") || value.trim().startsWith("https://");
}

function UrlValue({ url, label }: { url: string; label?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[var(--accent)] font-semibold hover:underline text-sm"
    >
      <ExternalLink className="w-3 h-3" />
      {label || url.replace(/^https?:\/\//, "").slice(0, 40)}{url.replace(/^https?:\/\//, "").length > 40 ? "…" : ""}
    </a>
  );
}

function displayArray(values: unknown, locale: any): string {
  if (!Array.isArray(values) || values.length === 0) return "-";
  const cleaned = values.map((value) => displayValue(value, locale)).filter((value) => value !== "-");
  return cleaned.length ? cleaned.join(", ") : "-";
}

function prettifyLabel(label: string): string {
  return label
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

export default function CandidateApplicationModal({ isOpen, onClose, applicationId }: CandidateApplicationModalProps) {
  const [loading, setLoading] = useState(false);
  const [application, setApplication] = useState<any>(null);
  const [documents, setDocuments] = useState<ApplicationDocument[]>([]);
  const locale = getClientLocale();

  useEffect(() => {
    if (!isOpen || !applicationId) return;

    let mounted = true;
    setLoading(true);

    Promise.all([getApplicationById(applicationId), getApplicationDocuments(applicationId)])
      .then(([app, docs]) => {
        if (!mounted) return;
        setApplication(app);
        setDocuments(docs);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, applicationId]);

  const snapshot = application?.dna_snapshot || {};
  const identity = snapshot?.talent_identity || {};
  const foundation = snapshot?.foundation || {};
  const experiences = Array.isArray(snapshot?.experience) ? snapshot.experience : [];
  const skills = Array.isArray(snapshot?.skills) ? snapshot.skills : [];
  const evidence = Array.isArray(snapshot?.evidence) ? snapshot.evidence : [];
  const workStyle = snapshot?.work_style || {};
  const motivation = snapshot?.motivation || {};
  const customAnswers = application?.answers || {};
  const workStyleEntries = Object.entries(workStyle || {}).filter(([, value]) => typeof value === "number");

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      slideOver
      size="lg"
      title={t(locale, "candidate.modal.title", "Candidate Submitted Form")}
      headerActions={
        applicationId ? (
          <Link
            href={appPath(applicationId)}
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {t(locale, "candidate.modal.fullApp", "Full Application")}
          </Link>
        ) : undefined
      }
    >
      <div className="space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
            </div>
          ) : !application ? (
            <Section title={t(locale, "common.error", "Error")}>
              <p>{t(locale, "candidate.modal.error", "Unable to load this application detail.")}</p>
            </Section>
          ) : (
            <>
              <Section title={t(locale, "candidate.modal.section1", "Section 1 — Identity & Contact")}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <KeyValue label={t(locale, "candidate.modal.fullName", "Full Name")} value={application.guest_name || identity.name || application?.profiles?.full_name || "-"} />
                  <KeyValue label={t(locale, "candidate.modal.email", "Email")} value={application.guest_email || identity.email || application?.profiles?.email || "-"} />
                  <KeyValue
                    label={t(locale, "candidate.modal.linkedin", "LinkedIn")}
                    value={
                      (() => {
                        const url = identity?.links?.linkedin;
                        return isUrl(url) ? <UrlValue url={url} label={t(locale, "candidate.modal.linkedinProfile", "LinkedIn Profile")} /> : displayValue(url, locale);
                      })()
                    }
                  />
                  <KeyValue
                    label={t(locale, "candidate.modal.cv", "CV / Resume")}
                    value={
                      (() => {
                        const cvDoc = documents.find((doc) => doc.type === "CV");
                        const url = cvDoc?.url || application.guest_cv_url || identity?.links?.cv;
                        if (isUrl(url)) return (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-bold hover:bg-[var(--accent)]-soft transition-colors"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            {t(locale, "candidate.modal.viewCv", "View CV")}
                          </a>
                        );
                        return <span className="text-[var(--text-muted)] text-xs">{t(locale, "candidate.modal.noCv", "No CV uploaded")}</span>;
                      })()
                    }
                  />
                </div>
              </Section>

              <Section title={t(locale, "candidate.modal.section2", "Section 2 — Foundation")}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <KeyValue label={t(locale, "candidate.modal.primaryRole", "Primary Role")} value={displayValue(foundation?.primaryRole, locale)} />
                  <KeyValue label={t(locale, "candidate.modal.yearsExp", "Years Experience")} value={displayValue(foundation?.yearsExperience, locale)} />
                  <KeyValue
                    label={t(locale, "candidate.modal.location", "Location")}
                    value={`${displayValue(foundation?.location?.country, locale)}${foundation?.location?.city ? `, ${foundation.location.city}` : ""}`}
                  />
                  <KeyValue label={t(locale, "candidate.modal.timezone", "Timezone")} value={displayValue(foundation?.timezone, locale)} />
                  <KeyValue
                    label={t(locale, "candidate.modal.availability", "Availability")}
                    value={`${displayValue(foundation?.availability?.type, locale)}${foundation?.availability?.date ? ` (${foundation.availability.date})` : ""}`}
                  />
                  <KeyValue label={t(locale, "candidate.modal.workAuth", "Work Authorization")} value={displayValue(foundation?.workAuth, locale)} />
                  <KeyValue label={t(locale, "candidate.modal.salary", "Salary Expectation")} value={displayValue(foundation?.salaryExpectation, locale)} />
                  <KeyValue label={t(locale, "candidate.modal.contracts", "Contracts")} value={displayArray(foundation?.contracts, locale)} />
                  <KeyValue label={t(locale, "candidate.modal.industries", "Industries")} value={displayArray(foundation?.industries, locale)} />
                </div>
              </Section>

              <Section title={t(locale, "candidate.modal.section3", "Section 3 — Experience")}>
                {experiences.length === 0 ? (
                  <p>-</p>
                ) : (
                  <div className="space-y-3">
                    {experiences.map((item: any, index: number) => (
                      <div key={`${item?.company || "exp"}-${index}`} className="bg-[var(--bg-surface)] rounded-xl p-4 border border-[var(--border)]">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <KeyValue label={t(locale, "candidate.modal.company", "Company")} value={displayValue(item?.company, locale)} />
                          <KeyValue label={t(locale, "candidate.modal.role", "Role")} value={displayValue(item?.role, locale)} />
                          <KeyValue label={t(locale, "candidate.modal.period", "Period")} value={displayValue(item?.period, locale)} />
                          <KeyValue label={t(locale, "candidate.modal.proofEmail", "Proof Email")} value={displayValue(item?.proofEmail, locale)} />
                          <KeyValue label={t(locale, "candidate.modal.proofDoc", "Proof Document")} value={displayValue(item?.proofDocument, locale)} />
                          <KeyValue label={t(locale, "candidate.modal.achievements", "Achievements")} value={displayArray(item?.achievements, locale)} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              <Section title={t(locale, "candidate.modal.section4", "Section 4 — Skills")}>
                {skills.length === 0 ? (
                  <p>-</p>
                ) : (
                  <div className="space-y-3">
                    {skills.map((item: any, index: number) => (
                      <div key={`${item?.skillName || "skill"}-${index}`} className="bg-[var(--bg-surface)] rounded-xl p-4 border border-[var(--border)]">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <KeyValue label={t(locale, "candidate.modal.skill", "Skill")} value={displayValue(item?.skillName, locale)} />
                          <KeyValue label={t(locale, "candidate.modal.yearsUsed", "Years Used")} value={displayValue(item?.yearsUsed, locale)} />
                          <KeyValue label={t(locale, "candidate.modal.ownership", "Ownership")} value={displayValue(item?.ownership, locale)} />
                          <KeyValue label={t(locale, "candidate.modal.proofEmail", "Proof Email")} value={displayValue(item?.proofEmail, locale)} />
                          <KeyValue label={t(locale, "candidate.modal.proofDoc", "Proof Document")} value={displayValue(item?.proofDocument, locale)} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              <Section title={t(locale, "candidate.modal.section5", "Section 5 — Work Evidence")}>
                {evidence.length === 0 ? (
                  <p>-</p>
                ) : (
                  <div className="space-y-3">
                    {evidence.map((item: any, index: number) => (
                      <div key={`${item?.projectName || "evidence"}-${index}`} className="bg-[var(--bg-surface)] rounded-xl p-4 border border-[var(--border)]">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <KeyValue label={t(locale, "candidate.modal.projectName", "Project Name")} value={displayValue(item?.projectName, locale)} />
                          <KeyValue label={t(locale, "candidate.modal.result", "Result")} value={displayValue(item?.result, locale)} />
                          <KeyValue label={t(locale, "candidate.modal.problemSolved", "Problem Solved")} value={displayValue(item?.problemSolved, locale)} />
                          <KeyValue label={t(locale, "candidate.modal.contribution", "Personal Contribution")} value={displayValue(item?.personalContribution, locale)} />
                          <KeyValue label={t(locale, "candidate.modal.proofLink", "Proof Link")} value={displayValue(item?.proofLink, locale)} />
                          <KeyValue label={t(locale, "candidate.modal.proofEmail", "Proof Email")} value={displayValue(item?.proofEmail, locale)} />
                          <KeyValue label={t(locale, "candidate.modal.proofDoc", "Proof Document")} value={displayValue(item?.proofDocument, locale)} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              <Section title={t(locale, "candidate.modal.section6", "Section 6 — Work Style & Motivation")}>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-bold text-[var(--text-muted)] mb-1">{t(locale, "candidate.modal.workStyle", "Work Style")}</p>
                    {workStyleEntries.length === 0 ? (
                      <p>-</p>
                    ) : (
                      <div className="space-y-2 bg-[var(--bg-surface)] rounded-xl p-3 border border-[var(--border)]">
                        {workStyleEntries.map(([key, value]) => {
                          const numericValue = Number(value);
                          const clamped = Number.isFinite(numericValue)
                            ? Math.max(0, Math.min(100, numericValue))
                            : 0;
                          return (
                            <div key={key}>
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-xs font-semibold text-[var(--text-secondary)]">{prettifyLabel(key)}</p>
                                <p className="text-xs font-bold text-[var(--text-primary)]">{clamped}%</p>
                              </div>
                              <div className="h-2 w-full bg-[var(--bg-surface)] rounded-full overflow-hidden">
                                <div className="h-full bg-[var(--accent)]" style={{ width: `${clamped}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[var(--text-muted)] mb-1">{t(locale, "candidate.modal.motivation", "Motivation")}</p>
                    {Object.keys(motivation || {}).length === 0 ? (
                      <p>-</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-[var(--bg-surface)] rounded-xl p-3 border border-[var(--border)]">
                        {Object.entries(motivation || {}).map(([key, value]) => (
                          <KeyValue key={key} label={prettifyLabel(key)} value={displayValue(value, locale)} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Section>

              <Section title={t(locale, "candidate.modal.section7", "Section 7 — Custom Questions")}>
                {Object.keys(customAnswers || {}).length === 0 ? (
                  <p>{t(locale, "candidate.modal.noCustom", "No custom answers submitted.")}</p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(customAnswers).map(([question, answer]) => (
                      <div key={question} className="bg-[var(--bg-surface)] rounded-xl p-4 border border-[var(--border)]">
                        <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">{prettifyLabel(question)}</p>
                        <p className="text-sm text-[var(--text-primary)] leading-relaxed">{displayValue(answer, locale)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              <Section title={t(locale, "candidate.modal.uploadedDocs", "Uploaded Documents")}>
                {documents.length === 0 ? (
                  <p>{t(locale, "candidate.modal.noDocs", "No uploaded documents found.")}</p>
                ) : (
                  <div className="space-y-2">
                    {documents.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between rounded-xl border border-[var(--border)] p-3 bg-[var(--bg-surface)]">
                        <div>
                          <p className="font-semibold text-sm text-[var(--text-primary)]">{doc.fileName}</p>
                          <p className="text-xs text-[var(--text-muted)]">{doc.type}</p>
                        </div>
                        {doc.url ? (
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[var(--accent)] to-[var(--accent)/80] text-white text-xs font-bold hover:shadow-none"
                          >
                            <Download className="w-3.5 h-3.5" />
                            {t(locale, "candidate.modal.open", "Open")}
                          </a>
                        ) : (
                          <span className="text-xs text-[var(--text-muted)]">{t(locale, "candidate.modal.noUrl", "No URL")}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </>
          )}
      </div>
    </Modal>
  );
}
