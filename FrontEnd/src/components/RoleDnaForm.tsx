"use client";

import { getClientLocale, t } from "@/lib/i18n";
import { apiFetch } from "@/lib/apiHelper";
import { API, institutionMeDepartmentsApi } from "@/lib/routes";
import { useWorkspace } from "@/lib/workspace";
import Modal from "@/components/ui/Modal";
import { useState, useEffect } from "react";
import {
    Briefcase,
    Target,
    Users,
    ShieldCheck,
    Globe,
    DollarSign,
    Sparkles,
    AlertCircle,
    X,
    CheckCircle,
    Plus,
    Trash2,
    Info,
} from "lucide-react";
import { CURRENCIES } from "@/lib/currencies";
import Link from "next/link";
import { useAutoSaveForm, useRestoreForm } from "@/lib/useSessionKeepAlive";
import { ROUTES } from "@/lib/routes";

function FieldTip({ text }: { text: string }) {
    return (
        <span className="relative group/tip inline-flex ml-1.5 align-middle">
            <Info className="w-3.5 h-3.5 text-[var(--accent)] cursor-help" />
            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 px-3 py-2 text-[11px] leading-snug font-normal normal-case tracking-normal text-[var(--text-primary)] bg-[var(--bg-raised)] border border-[var(--border)] rounded-lg shadow-lg opacity-0 group-hover/tip:opacity-100 transition-opacity z-50">
                {text}
            </span>
        </span>
    );
}

function RequiredMark() {
    return <span className="ml-1 text-red-400">*</span>;
}

export default function RoleDnaForm({ initialData, onSubmit, onCancel, submitLabel, isUpdate = false }: { initialData?: any, onSubmit: (data: any) => void, onCancel?: () => void, submitLabel?: string, isUpdate?: boolean }) {
    const locale = getClientLocale();
    const { hasPermission } = useWorkspace();
    const canCreateDepartment = hasPermission("settings.edit");

    const [loading, setLoading] = useState(false);
    const [submissionError, setSubmissionError] = useState<string | null>(null);
    const [departments, setDepartments] = useState<Array<{id: string; name: string}>>([]);
    const [deptModalOpen, setDeptModalOpen] = useState(false);
    const [newDeptName, setNewDeptName] = useState("");
    const [deptCreating, setDeptCreating] = useState(false);
    const [deptCreateError, setDeptCreateError] = useState<string | null>(null);

    const reloadDepartments = () =>
        apiFetch(institutionMeDepartmentsApi, 'HR').catch(() => null).then((depts) => {
            const list = Array.isArray((depts as any)?.data ?? depts) ? ((depts as any)?.data ?? depts) : [];
            setDepartments(list);
            return list as Array<{ id: string; name: string }>;
        });

    const handleCreateDepartment = async (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const name = newDeptName.trim();
        if (!name) return;
        setDeptCreating(true);
        setDeptCreateError(null);
        try {
            const created = await apiFetch(API.departments, 'HR', {
                method: 'POST',
                body: JSON.stringify({ name }),
            }) as any;
            const createdDept = created?.data ?? created;
            const list = await reloadDepartments();
            const match = createdDept?.id ? createdDept : list.find((d) => d.name === name);
            if (match?.id) setFormData((prev: any) => ({ ...prev, department_id: match.id }));
            setNewDeptName("");
            setDeptModalOpen(false);
        } catch {
            setDeptCreateError(t(locale, 'roles.department.createError', "Échec de la création du département. Réessaie."));
        } finally {
            setDeptCreating(false);
        }
    };

    useEffect(() => {
        apiFetch(institutionMeDepartmentsApi, 'HR').catch(() => null).then((depts) => {
            if (Array.isArray(depts?.data ?? depts)) setDepartments(depts?.data ?? depts ?? []);
        });
    }, []);

    const defaultFormData = {
        // Section 1: Identity
        title: "",
        department_id: "",
        hiring_manager_user_id: "",
        seniority: "",
        seniorityOther: "",
        type: "",
        typeOther: "",
        country: "",
        countryOther: "",
        city: "",
        cityOther: "",

        // Section 2: Mission
        mission90Day: "",
        success6Month: "",
        problems: [
            { id: "build", label: "Build from scratch", rank: 0 },
            { id: "fix", label: "Fix broken system", rank: 0 },
            { id: "optimize", label: "Optimize performance", rank: 0 },
            { id: "revenue", label: "Drive revenue", rank: 0 },
            { id: "costs", label: "Reduce costs", rank: 0 },
            { id: "quality", label: "Improve product quality", rank: 0 },
            { id: "team", label: "Structure a team", rank: 0 },
            { id: "stakeholders", label: "Manage stakeholders", rank: 0 },
        ],
        otherProblem: "",

        // Section 3: Ownership
        ownershipRatings: {
            autonomy: 3,
            ambiguity: 3,
            authority: 3,
            exposure: 3,
            pressure: 3,
            complexity: 3,
        },
        responsibilities: {
            lead: false,
            own: false,
            clients: false,
            processes: false,
            external: false,
            other: false,
            otherCustom: "",
        },

        // Section 4: Skills
        skills: [
            { name: "", category: "Tech", customCategory: "", importance: "Core", customImportance: "", level: "Mid", customLevel: "" },
            { name: "", category: "Tech", customCategory: "", importance: "Important", customImportance: "", level: "Mid", customLevel: "" },
            { name: "", category: "Business", customCategory: "", importance: "Nice", customImportance: "", level: "Junior", customLevel: "" },
        ],

        // Section 5: Culture
        culture: {
            speed: 50,
            structure: 50,
            coaching: 50,
            risk: 50,
            process: 50,
        },
        dealbreakers: "",
        dynamics: "",

        // Section 6: Constraints
        salaryCurrency: "EUR",
        salaryMin: "",
        salaryMax: "",
        availability: "",
        teamSize: "",
        reportingTo: "",
        challenges: "",
        remoteRule: "",
        remoteRuleOther: "",
        legal: "",

        // Section 7: Posture
        priority: "",
        openness: {
            tests: false,
            trials: false,
            nonTraditional: false,
        },
        processSteps: "",
        decisionTime: "",

        // Section 8: AI & Forms
        customFormQuestions: "",
        evaluationContext: "",
    };

    const normalizeFormData = (rawData: any) => ({
        ...defaultFormData,
        ...(rawData || {}),
        responsibilities: {
            ...defaultFormData.responsibilities,
            ...(rawData?.responsibilities || {}),
        },
        ownershipRatings: {
            ...defaultFormData.ownershipRatings,
            ...(rawData?.ownershipRatings || {}),
        },
        culture: {
            ...defaultFormData.culture,
            ...(rawData?.culture || {}),
        },
        openness: {
            ...defaultFormData.openness,
            ...(rawData?.openness || {}),
        },
        skills: Array.isArray(rawData?.skills) && rawData.skills.length > 0
            ? rawData.skills.map((skill: any) => ({
                ...defaultFormData.skills[0],
                ...skill,
            }))
            : defaultFormData.skills,
    });

    const ownershipRatingLabels = [
        { id: "autonomy", key: "roles.ownershipRating.autonomy", fallback: "Autonomy" },
        { id: "ambiguity", key: "roles.ownershipRating.ambiguity", fallback: "Ambiguity" },
        { id: "authority", key: "roles.ownershipRating.authority", fallback: "Authority" },
        { id: "exposure", key: "roles.ownershipRating.exposure", fallback: "Exposure" },
        { id: "pressure", key: "roles.ownershipRating.pressure", fallback: "Pressure" },
        { id: "complexity", key: "roles.ownershipRating.complexity", fallback: "Complexity" },
    ] as const;

    const ownershipRatingTips: Record<string, { key: string; fallback: string }> = {
        autonomy: {
            key: "roles.ownershipRatingTip.autonomy",
            fallback: "Measures how much independent decision-making the role requires with limited supervision.",
        },
        ambiguity: {
            key: "roles.ownershipRatingTip.ambiguity",
            fallback: "Measures comfort with unclear priorities, shifting context, and incomplete information.",
        },
        authority: {
            key: "roles.ownershipRatingTip.authority",
            fallback: "Measures the level of decision power and organizational influence expected from this role.",
        },
        exposure: {
            key: "roles.ownershipRatingTip.exposure",
            fallback: "Measures visibility to leadership, cross-functional stakeholders, and strategic topics.",
        },
        pressure: {
            key: "roles.ownershipRatingTip.pressure",
            fallback: "Measures intensity of deadlines, delivery cadence, and operational stress in this position.",
        },
        complexity: {
            key: "roles.ownershipRatingTip.complexity",
            fallback: "Measures how complex problems are in terms of systems, scope, and trade-offs.",
        },
    };

    const problemLabels: Record<string, { key: string; fallback: string }> = {
        build: { key: "roles.problem.build", fallback: "Build from scratch" },
        fix: { key: "roles.problem.fix", fallback: "Fix broken system" },
        optimize: { key: "roles.problem.optimize", fallback: "Optimize performance" },
        revenue: { key: "roles.problem.revenue", fallback: "Drive revenue" },
        costs: { key: "roles.problem.costs", fallback: "Reduce costs" },
        quality: { key: "roles.problem.quality", fallback: "Improve product quality" },
        team: { key: "roles.problem.team", fallback: "Structure a team" },
        stakeholders: { key: "roles.problem.stakeholders", fallback: "Manage stakeholders" },
    };

    const restored = useRestoreForm("role_creation_json", defaultFormData);
    const [formData, setFormData] = useState<typeof defaultFormData>(normalizeFormData(initialData || restored));

    // Only auto-save if it's not an update to avoid overwriting creation draft with update draft
    useAutoSaveForm("role_creation_json", formData, 1000, !isUpdate);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const missingRequiredFields: string[] = [];
        if (!formData.title?.trim()) missingRequiredFields.push(t(locale, 'roles.role_title', 'Job Post Title'));
        if (!formData.seniority) missingRequiredFields.push(t(locale, 'roles.seniority_level', 'Seniority Level'));
        if (!formData.type) missingRequiredFields.push(t(locale, 'roles.employment_type', 'Employment Type'));
        if (!formData.country) missingRequiredFields.push(t(locale, 'roles.country', 'Country'));
        if (!formData.city) missingRequiredFields.push(t(locale, 'roles.city', 'City'));

        if (!formData.mission90Day?.trim()) missingRequiredFields.push(t(locale, 'roles.90_day_mission', 'A. 90-day mission'));
        if (!formData.success6Month?.trim()) missingRequiredFields.push(t(locale, 'roles.6_month_success', 'B. 6-month success'));

        if (missingRequiredFields.length > 0) {
            setSubmissionError(
                t(
                    locale,
                    'roles.validation.missingRequired',
                    'Please fill in required fields before publishing: {{fields}}',
                    { fields: missingRequiredFields.join(', ') }
                )
            );
            // Scroll to the first missing field
            const fieldSelectorMap: Record<string, string> = {
                'Job Post Title': '[data-field="title"]',
                'Seniority Level': '[data-field="seniority"]',
                'Employment Type': '[data-field="type"]',
                'Country': '[data-field="country"]',
                'City': '[data-field="city"]',
                '90-day mission': '[data-field="mission90Day"]',
                '6-month success': '[data-field="success6Month"]',
            };
            const firstFieldKey = missingRequiredFields[0];
            // Try translated key first, fall back to raw key
            let selector = fieldSelectorMap[firstFieldKey];
            if (!selector) {
                // Map common translated versions
                if (firstFieldKey.includes('title') || firstFieldKey.includes('Titre')) selector = '[data-field="title"]';
                else if (firstFieldKey.includes('Seniority') || firstFieldKey.includes('Séniorité')) selector = '[data-field="seniority"]';
                else if (firstFieldKey.includes('type') || firstFieldKey.includes('Type')) selector = '[data-field="type"]';
                else if (firstFieldKey.includes('Country') || firstFieldKey.includes('Pays')) selector = '[data-field="country"]';
                else if (firstFieldKey.includes('City') || firstFieldKey.includes('Ville')) selector = '[data-field="city"]';
                else if (firstFieldKey.includes('Department') || firstFieldKey.includes('Département')) selector = '[data-field="department"]';
                else if (firstFieldKey.includes('90') || firstFieldKey.includes('mission')) selector = '[data-field="mission90Day"]';
                else if (firstFieldKey.includes('6') || firstFieldKey.includes('success') || firstFieldKey.includes('mois')) selector = '[data-field="success6Month"]';
            }
            // Highlight ALL missing fields in red
            missingRequiredFields.forEach(fieldKey => {
                let sel = fieldSelectorMap[fieldKey];
                if (!sel) {
                    if (fieldKey.includes('title') || fieldKey.includes('Titre')) sel = '[data-field="title"]';
                    else if (fieldKey.includes('Seniority') || fieldKey.includes('Séniorité')) sel = '[data-field="seniority"]';
                    else if (fieldKey.includes('type') || fieldKey.includes('Type')) sel = '[data-field="type"]';
                    else if (fieldKey.includes('Country') || fieldKey.includes('Pays')) sel = '[data-field="country"]';
                    else if (fieldKey.includes('City') || fieldKey.includes('Ville')) sel = '[data-field="city"]';
                    else if (fieldKey.includes('Department') || fieldKey.includes('Département')) sel = '[data-field="department"]';
                    else if (fieldKey.includes('90') || fieldKey.includes('mission')) sel = '[data-field="mission90Day"]';
                    else if (fieldKey.includes('6') || fieldKey.includes('mois')) sel = '[data-field="success6Month"]';
                }
                if (sel) {
                    const el = document.querySelector(sel);
                    if (el) {
                        el.classList.add('ring-2', 'ring-red-500', 'border-red-500');
                        setTimeout(() => el.classList.remove('ring-2', 'ring-red-500', 'border-red-500'), 4000);
                    }
                }
            });
            if (selector) {
                const el = document.querySelector(selector);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Add red border to highlight missing fields
                    el.classList.add('ring-2', 'ring-red-500', 'border-red-500');
                    setTimeout(() => el.classList.remove('ring-2', 'ring-red-500', 'border-red-500'), 3000);
                }
            }
            return;
        }

        setLoading(true);
        setSubmissionError(null);
        try {
            await onSubmit(formData);
        } catch (error) {
            const message = error instanceof Error ? error.message : "An error occurred";
            setSubmissionError(message);
        } finally {
            setLoading(false);
        }
    };

    const toggleProblem = (id: string) => {
        setFormData((prev: any) => ({
            ...prev,
            problems: (() => {
                const isSelected = prev.problems.some((p: any) => p.id === id && p.rank > 0);
                const updated = prev.problems.map((p: any) => {
                if (p.id === id) {
                        if (isSelected) return { ...p, rank: 0 };
                        const currentSelected = prev.problems.filter((x: any) => x.rank > 0).length;
                        return { ...p, rank: currentSelected + 1 };
                }
                return p;
                });

                let nextRank = 1;
                return updated.map((p: any) => {
                    if (p.rank <= 0) return p;
                    return { ...p, rank: nextRank++ };
                });
            })(),
        }));
    };

    return (
        <div className="max-w-4xl mx-auto pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-8 animate-fade-in-up">
                <div className="flex items-center gap-4">
                    <Link href={ROUTES.company.recruitment.roles} className="w-10 h-10 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent)] hover:border-[var(--accent)]/30 transition-all ">
                        <AlertCircle className="w-5 h-5 hidden" />
                        <span className="text-xl">←</span>
                    </Link>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">{t(locale, 'roles.create_role_dna', 'Create Job Post Sheet')}</h1>
                        <p className="text-[var(--text-muted)] text-sm">{t(locale, 'roles.define_requirements', 'Define the complete job post requirements')}</p>
                    </div>
                </div>
            </div>

            <p className="mb-4 text-xs text-[var(--text-muted)]">
                <span className="text-red-400 font-bold">*</span> {t(locale, 'roles.required.legend', 'Required fields')}
            </p>

            {/* Error Notification */}
            {submissionError && (
                <div className="mb-6 p-4 bg-red-400/10 border border-red-400/20 rounded-xl flex items-start gap-3 animate-fade-in-up">
                    <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                        <p className="text-sm font-bold text-red-400">{t(locale, 'roles.creation_failed', 'Creation Failed')}</p>
                        <p className="text-xs text-red-400 mt-1">{submissionError}</p>
                    </div>
                    <button onClick={() => setSubmissionError(null)} className="text-red-400 flex-shrink-0">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Editor Console */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-10">
                
                {/* SECTION 1 — Identity */}
                <section className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[2rem] p-10 border border-[var(--border)]">
                    <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2 mb-6">
                        <Briefcase className="w-5 h-5 text-[var(--accent)]" />
                        {t(locale, 'roles.section.identity', 'Job Post Identity')}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">{t(locale, 'roles.role_title', 'Job Post Title')}<RequiredMark /><FieldTip text={t(locale, 'roles.tip.title', "Be specific: include the role, specialty and level. E.g. 'Lead Backend Engineer — Payments'. Our AI uses this title for matching.")} /></label>
                            <input
                                data-field="title"
                                className="w-full px-5 py-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl text-sm focus:ring-2 focus:ring-[var(--accent)]/20 transition-all"
                                placeholder={t(locale, 'roles.placeholder.title', 'e.g. Lead React Architect')}
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">{t(locale, 'roles.seniority_level', 'Seniority Level')}<RequiredMark /></label>
                            <select
                                data-field="seniority"
                                className="w-full px-5 py-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl text-sm focus:ring-2 focus:ring-[var(--accent)]/20 transition-all appearance-none"
                                value={formData.seniority}
                                onChange={e => setFormData({ ...formData, seniority: e.target.value, seniorityOther: e.target.value === 'other' ? formData.seniorityOther : '' })}
                            >
                                <option value="">{t(locale, 'roles.option.selectSeniority', 'Select seniority')}</option>
                                <option value="Junior">{t(locale, 'roles.option.seniority.junior', 'Junior')}</option>
                                <option value="Mid-level">{t(locale, 'roles.option.seniority.mid', 'Mid-level')}</option>
                                <option value="Senior">{t(locale, 'roles.option.seniority.senior', 'Senior')}</option>
                                <option value="Lead / Principal">{t(locale, 'roles.option.seniority.lead', 'Lead / Principal')}</option>
                                <option value="VP / C-Level">{t(locale, 'roles.option.seniority.vp', 'VP / C-Level')}</option>
                                <option value="other">{t(locale, 'roles.option.other', 'Other')}</option>
                            </select>
                            {formData.seniority === 'other' && (
                                <input
                                    className="w-full px-5 py-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl text-sm"
                                    placeholder={t(locale, 'roles.placeholder.otherSeniority', 'Enter a custom seniority level')}
                                    value={formData.seniorityOther}
                                    onChange={e => setFormData({ ...formData, seniorityOther: e.target.value })}
                                />
                            )}
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">{t(locale, 'roles.employment_type', 'Employment Type')}<RequiredMark /></label>
                            <select
                                data-field="type"
                                className="w-full px-5 py-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl text-sm focus:ring-2 focus:ring-[var(--accent)]/20 transition-all appearance-none"
                                value={formData.type}
                                onChange={e => setFormData({ ...formData, type: e.target.value, typeOther: e.target.value === 'other' ? formData.typeOther : '' })}
                            >
                                <option value="">{t(locale, 'roles.option.selectType', 'Select type')}</option>
                                <option value="Full-time">{t(locale, 'roles.option.type.fullTime', 'Full-time')}</option>
                                <option value="Contract">{t(locale, 'roles.option.type.contract', 'Contract')}</option>
                                <option value="Freelance">{t(locale, 'roles.option.type.freelance', 'Freelance')}</option>
                                <option value="Internship">{t(locale, 'roles.option.type.internship', 'Internship')}</option>
                                <option value="other">{t(locale, 'roles.option.other', 'Other')}</option>
                            </select>
                            {formData.type === 'other' && (
                                <input
                                    className="w-full px-5 py-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl text-sm"
                                    placeholder={t(locale, 'roles.placeholder.otherEmploymentType', 'Enter a custom employment type')}
                                    value={formData.typeOther}
                                    onChange={e => setFormData({ ...formData, typeOther: e.target.value })}
                                />
                            )}
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">{t(locale, 'roles.country', 'Country')}<RequiredMark /></label>
                            <select
                                data-field="country"
                                className="w-full px-5 py-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl text-sm focus:ring-2 focus:ring-[var(--accent)]/20 transition-all appearance-none"
                                value={formData.country}
                                onChange={e => setFormData({
                                    ...formData,
                                    country: e.target.value,
                                    city: "",
                                    cityOther: "",
                                    countryOther: e.target.value === 'other' ? formData.countryOther : '',
                                })}
                            >
                                <option value="">{t(locale, 'roles.option.selectCountry', 'Select country')}</option>
                                <option value="Remote">{t(locale, 'roles.option.country.remote', 'Remote (Global)')}</option>
                                <option value="France">France</option>
                                <option value="Germany">{t(locale, 'roles.option.country.de', 'Germany')}</option>
                                <option value="United Kingdom">{t(locale, 'roles.option.country.uk', 'United Kingdom')}</option>
                                <option value="United States">{t(locale, 'roles.option.country.us', 'United States')}</option>
                                <option value="Belgium">{t(locale, 'roles.option.country.be', 'Belgium')}</option>
                                <option value="Switzerland">{t(locale, 'roles.option.country.ch', 'Switzerland')}</option>
                                <option value="Netherlands">{t(locale, 'roles.option.country.nl', 'Netherlands')}</option>
                                <option value="Spain">{t(locale, 'roles.option.country.es', 'Spain')}</option>
                                <option value="Italy">{t(locale, 'roles.option.country.it', 'Italy')}</option>
                                <option value="Portugal">Portugal</option>
                                <option value="Ireland">{t(locale, 'roles.option.country.ie', 'Ireland')}</option>
                                <option value="Sweden">{t(locale, 'roles.option.country.se', 'Sweden')}</option>
                                <option value="Norway">{t(locale, 'roles.option.country.no', 'Norway')}</option>
                                <option value="Denmark">{t(locale, 'roles.option.country.dk', 'Denmark')}</option>
                                <option value="Poland">{t(locale, 'roles.option.country.pl', 'Poland')}</option>
                                <option value="Canada">Canada</option>
                                <option value="Brazil">{t(locale, 'roles.option.country.br', 'Brazil')}</option>
                                <option value="Mexico">{t(locale, 'roles.option.country.mx', 'Mexico')}</option>
                                <option value="Argentina">{t(locale, 'roles.option.country.ar', 'Argentina')}</option>
                                <option value="Morocco">{t(locale, 'roles.option.country.ma', 'Morocco')}</option>
                                <option value="Senegal">{t(locale, 'roles.option.country.sn', 'Senegal')}</option>
                                <option value="Ivory Coast">{t(locale, 'roles.option.country.ci', "Ivory Coast")}</option>
                                <option value="Nigeria">{t(locale, 'roles.option.country.ng', 'Nigeria')}</option>
                                <option value="South Africa">{t(locale, 'roles.option.country.za', 'South Africa')}</option>
                                <option value="Tunisia">{t(locale, 'roles.option.country.tn', 'Tunisia')}</option>
                                <option value="Japan">{t(locale, 'roles.option.country.jp', 'Japan')}</option>
                                <option value="India">{t(locale, 'roles.option.country.in', 'India')}</option>
                                <option value="Singapore">Singapore</option>
                                <option value="Australia">{t(locale, 'roles.option.country.au', 'Australia')}</option>
                                <option value="UAE">{t(locale, 'roles.option.country.ae', 'UAE')}</option>
                                <option value="other">{t(locale, 'roles.option.other', 'Other')}</option>
                            </select>
                            {formData.country === 'other' && (
                                <input
                                    className="w-full px-5 py-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl text-sm"
                                    placeholder={t(locale, 'roles.placeholder.otherCountry', 'Enter a custom country')}
                                    value={formData.countryOther}
                                    onChange={e => setFormData({ ...formData, countryOther: e.target.value })}
                                />
                            )}
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">{t(locale, 'roles.city', 'City')}<RequiredMark /></label>
                            <select
                                data-field="city"
                                className="w-full px-5 py-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl text-sm focus:ring-2 focus:ring-[var(--accent)]/20 transition-all appearance-none"
                                value={formData.city}
                                onChange={e => setFormData({ ...formData, city: e.target.value, cityOther: e.target.value === 'other' ? formData.cityOther : '' })}
                            >
                                <option value="">{t(locale, 'roles.option.selectCity', 'Select city')}</option>
                                {formData.country === "Remote" && (
                                    <option value="Anywhere">{t(locale, 'roles.option.city.anywhere', 'Anywhere')}</option>
                                )}
                                {formData.country === "France" && (
                                    <>{["Paris", "Lyon", "Marseille", "Toulouse", "Bordeaux", "Nantes", "Lille", "Strasbourg", "Nice", "Montpellier"].map(c => <option key={c} value={c}>{c}</option>)}</>
                                )}
                                {formData.country === "Germany" && (
                                    <>{["Berlin", "Munich", "Hamburg", "Frankfurt", "Cologne", "Stuttgart", "Düsseldorf"].map(c => <option key={c} value={c}>{c}</option>)}</>
                                )}
                                {formData.country === "United Kingdom" && (
                                    <>{["London", "Manchester", "Birmingham", "Edinburgh", "Bristol", "Leeds", "Glasgow"].map(c => <option key={c} value={c}>{c}</option>)}</>
                                )}
                                {formData.country === "United States" && (
                                    <>{["New York", "San Francisco", "Los Angeles", "Chicago", "Austin", "Seattle", "Boston", "Miami", "Denver", "Atlanta"].map(c => <option key={c} value={c}>{c}</option>)}</>
                                )}
                                {formData.country === "Belgium" && (
                                    <>{["Brussels", "Antwerp", "Ghent", "Liège"].map(c => <option key={c} value={c}>{c}</option>)}</>
                                )}
                                {formData.country === "Switzerland" && (
                                    <>{["Zurich", "Geneva", "Basel", "Lausanne", "Bern"].map(c => <option key={c} value={c}>{c}</option>)}</>
                                )}
                                {formData.country === "Netherlands" && (
                                    <>{["Amsterdam", "Rotterdam", "The Hague", "Utrecht", "Eindhoven"].map(c => <option key={c} value={c}>{c}</option>)}</>
                                )}
                                {formData.country === "Spain" && (
                                    <>{["Madrid", "Barcelona", "Valencia", "Seville", "Málaga"].map(c => <option key={c} value={c}>{c}</option>)}</>
                                )}
                                {formData.country === "Italy" && (
                                    <>{["Milan", "Rome", "Turin", "Florence", "Bologna"].map(c => <option key={c} value={c}>{c}</option>)}</>
                                )}
                                {formData.country === "Canada" && (
                                    <>{["Toronto", "Montreal", "Vancouver", "Ottawa", "Calgary"].map(c => <option key={c} value={c}>{c}</option>)}</>
                                )}
                                {formData.country === "Morocco" && (
                                    <>{["Casablanca", "Rabat", "Marrakech", "Tangier", "Fès"].map(c => <option key={c} value={c}>{c}</option>)}</>
                                )}
                                {formData.country === "Senegal" && (
                                    <>{["Dakar", "Thiès", "Saint-Louis"].map(c => <option key={c} value={c}>{c}</option>)}</>
                                )}
                                {formData.country === "Ivory Coast" && (
                                    <>{["Abidjan", "Yamoussoukro", "Bouaké"].map(c => <option key={c} value={c}>{c}</option>)}</>
                                )}
                                {formData.country === "Nigeria" && (
                                    <>{["Lagos", "Abuja", "Port Harcourt", "Kano"].map(c => <option key={c} value={c}>{c}</option>)}</>
                                )}
                                {formData.country === "Tunisia" && (
                                    <>{["Tunis", "Sfax", "Sousse"].map(c => <option key={c} value={c}>{c}</option>)}</>
                                )}
                                {formData.country === "Brazil" && (
                                    <>{["São Paulo", "Rio de Janeiro", "Belo Horizonte", "Brasília"].map(c => <option key={c} value={c}>{c}</option>)}</>
                                )}
                                {formData.country === "India" && (
                                    <>{["Bangalore", "Mumbai", "Delhi", "Hyderabad", "Pune", "Chennai"].map(c => <option key={c} value={c}>{c}</option>)}</>
                                )}
                                {formData.country === "Japan" && (
                                    <>{["Tokyo", "Osaka", "Nagoya", "Fukuoka"].map(c => <option key={c} value={c}>{c}</option>)}</>
                                )}
                                {formData.country === "Australia" && (
                                    <>{["Sydney", "Melbourne", "Brisbane", "Perth"].map(c => <option key={c} value={c}>{c}</option>)}</>
                                )}
                                {formData.country === "Singapore" && (
                                    <option value="Singapore">Singapore</option>
                                )}
                                {formData.country === "UAE" && (
                                    <>{["Dubai", "Abu Dhabi"].map(c => <option key={c} value={c}>{c}</option>)}</>
                                )}
                                <option value="other">{t(locale, 'roles.option.other', 'Other')}</option>
                            </select>
                            {formData.city === 'other' && (
                                <input
                                    className="w-full px-5 py-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl text-sm"
                                    placeholder={t(locale, 'roles.placeholder.otherCity', 'Enter a custom city')}
                                    value={formData.cityOther}
                                    onChange={e => setFormData({ ...formData, cityOther: e.target.value })}
                                />
                            )}
                        </div>

                        {/* Département */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">
                                    {t(locale, 'roles.department', 'Département')}
                                    <FieldTip text={t(locale, 'roles.tip.departmentScope', "This is the internal team/department the hire will join (Engineering, Sales, HR), not the role's geographic location.")} />
                                </label>
                                {canCreateDepartment && (
                                    <button
                                        type="button"
                                        onClick={() => { setDeptCreateError(null); setNewDeptName(""); setDeptModalOpen(true); }}
                                        className="flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:opacity-80 transition-opacity"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        {t(locale, 'roles.department.create', 'Nouveau département')}
                                    </button>
                                )}
                            </div>
                            <select
                                data-field="department"
                                className="w-full px-5 py-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl text-sm focus:ring-2 focus:ring-[var(--accent)]/20 transition-all appearance-none"
                                value={formData.department_id}
                                onChange={e => setFormData({ ...formData, department_id: e.target.value })}
                            >
                                <option value="">{t(locale, 'roles.option.noDepartment', 'Aucun département')}</option>
                                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>

                        {deptModalOpen && (
                            <Modal
                                open={deptModalOpen}
                                onClose={() => { if (!deptCreating) setDeptModalOpen(false); }}
                                title={t(locale, 'roles.department.create', 'Nouveau département')}
                                size="sm"
                            >
                                <form onSubmit={(e) => void handleCreateDepartment(e)} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                                            {t(locale, 'organization.departments.name', 'Nom du département')}
                                        </label>
                                        <input
                                            autoFocus
                                            value={newDeptName}
                                            onChange={(e) => setNewDeptName(e.target.value)}
                                            placeholder={t(locale, 'organization.departments.namePlaceholder', 'Ex: Ingénierie')}
                                            className="w-full rounded-lg px-3 py-2 text-sm bg-[var(--bg-raised)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)]"
                                            required
                                        />
                                    </div>
                                    {deptCreateError && (
                                        <p className="text-xs text-red-400">{deptCreateError}</p>
                                    )}
                                    <div className="flex justify-end gap-2 pt-2">
                                        <button type="button" onClick={() => setDeptModalOpen(false)} disabled={deptCreating}
                                            className="px-4 py-2 rounded-lg text-sm border border-[var(--border)] bg-[var(--bg-raised)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50">
                                            {t(locale, 'organization.cancel', 'Annuler')}
                                        </button>
                                        <button type="submit" disabled={deptCreating || !newDeptName.trim()}
                                            className="px-4 py-2 rounded-lg text-sm bg-[var(--accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-50">
                                            {deptCreating
                                                ? t(locale, 'common.saving', 'Saving...')
                                                : t(locale, 'organization.save', 'Enregistrer')}
                                        </button>
                                    </div>
                                </form>
                            </Modal>
                        )}
                    </div>
                </section>

                {/* SECTION 2 — Mission */}
                <section className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[2rem] p-10 border border-[var(--border)]">
                    <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2 mb-6">
                        <Target className="w-5 h-5 text-[var(--accent)]" />
                        {t(locale, 'roles.section.mission', 'Job Post Mission')}
                    </h2>
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-[var(--text-primary)]">{t(locale, 'roles.90_day_mission', 'A. 90-day mission')}<RequiredMark /><FieldTip text={t(locale, 'roles.tip.mission90', "Describe what this person must deliver in their first 90 days. Be concrete: deliverables, metrics, expected outcomes.")} /></label>
                            <textarea
                                data-field="mission90Day"
                                rows={3}
                                className="w-full px-5 py-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl text-sm focus:ring-2 focus:ring-[var(--accent)]/20 transition-all resize-none"
                                placeholder={t(locale, 'roles.placeholder.mission90', 'What must this person deliver in their first 90 days?')}
                                value={formData.mission90Day}
                                onChange={e => setFormData({ ...formData, mission90Day: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-[var(--text-primary)]">{t(locale, 'roles.6_month_success', 'B. 6-month success')}<RequiredMark /><FieldTip text={t(locale, 'roles.tip.success6m', "How will you know this hire is a success after 6 months? KPIs, goals achieved, team impact.")} /></label>
                            <textarea
                                data-field="success6Month"
                                rows={2}
                                className="w-full px-5 py-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl text-sm focus:ring-2 focus:ring-[var(--accent)]/20 transition-all resize-none"
                                placeholder={t(locale, 'roles.placeholder.success6m', 'How will you know this hire was a success after 6 months?')}
                                value={formData.success6Month}
                                onChange={e => setFormData({ ...formData, success6Month: e.target.value })}
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="text-sm font-bold text-[var(--text-primary)]">{t(locale, 'roles.key_problems', 'C. Key problems to solve')}<FieldTip text={t(locale, 'roles.tip.problems', "Select and rank problems by priority. Selection order defines rank (1 = most important). AI uses this ranking to prioritize skills.")} /></label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                                {formData.problems.map(p => (
                                    <div key={p.id} className="relative group/prob">
                                        <button
                                            type="button"
                                            onClick={() => toggleProblem(p.id)}
                                            className={`w-full p-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-between ${p.rank > 0
                                                ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-lg'
                                                : 'bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]/30 hover:bg-[var(--accent)]/5'}`}
                                        >
                                            <span className="truncate">{t(locale, problemLabels[p.id]?.key || '', problemLabels[p.id]?.fallback || p.label)}</span>
                                            {p.rank > 0 && <span className="ml-2 bg-white/20 px-1.5 rounded">{p.rank}</span>}
                                        </button>
                                        {p.id.startsWith('custom_') && (
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, problems: formData.problems.filter(x => x.id !== p.id) })}
                                                className="absolute -right-1.5 -top-1.5 w-5 h-5 bg-[var(--bg-surface)] border border-red-400/30 text-red-400 rounded-full flex items-center justify-center opacity-0 group-hover/prob:opacity-100 transition-opacity text-[10px]"
                                            >×</button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-2 mt-2">
                                <input
                                    className="flex-1 px-5 py-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl text-xs"
                                    placeholder={t(locale, 'roles.placeholder.otherProblem', 'Add a custom problem...')}
                                    value={formData.otherProblem}
                                    onChange={e => setFormData({ ...formData, otherProblem: e.target.value })}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && formData.otherProblem.trim()) {
                                            e.preventDefault();
                                            const newId = `custom_${Date.now()}`;
                                            setFormData({
                                                ...formData,
                                                problems: [...formData.problems, { id: newId, label: formData.otherProblem.trim(), rank: 0 }],
                                                otherProblem: "",
                                            });
                                        }
                                    }}
                                />
                                <button
                                    type="button"
                                    disabled={!formData.otherProblem.trim()}
                                    onClick={() => {
                                        if (!formData.otherProblem.trim()) return;
                                        const newId = `custom_${Date.now()}`;
                                        setFormData({
                                            ...formData,
                                            problems: [...formData.problems, { id: newId, label: formData.otherProblem.trim(), rank: 0 }],
                                            otherProblem: "",
                                        });
                                    }}
                                    className="px-4 py-3 rounded-xl border border-[var(--border)] text-xs font-bold text-[var(--text-muted)] hover:border-[var(--accent)]/30 hover:text-[var(--accent)] transition-all disabled:opacity-30"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                {/* SECTION 3 — Ownership */}
                <section className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[2rem] p-10 border border-[var(--border)]">
                    <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2 mb-6">
                        <Briefcase className="w-5 h-5 text-[var(--accent)]" />
                        {t(locale, 'roles.section.ownership', 'Tasks & Ownership Map')}<FieldTip text={t(locale, 'roles.tip.ownership', "Rate from 1 (low) to 5 (high) the expected level for each dimension. AI compares these levels to candidate profiles for matching.")} />
                    </h2>
                    <p className="text-xs text-[var(--text-muted)] mb-5">
                        {t(locale, 'roles.ownership.sliderGuidance', 'Use the sliders below to score how relevant each quality or risk factor is for this role (1 = low relevance, 5 = critical relevance).')}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 sm:gap-x-12 gap-y-4 sm:gap-y-8">
                        {ownershipRatingLabels.map(({ id, key, fallback }) => (
                            <div key={id} className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest leading-6">
                                        {t(locale, key, fallback)}
                                        <FieldTip text={t(locale, ownershipRatingTips[id]?.key || '', ownershipRatingTips[id]?.fallback || '')} />
                                    </label>
                                    <span className="text-[var(--accent)] font-bold text-sm">{t(locale, 'roles.levelValue', 'Level {{value}}', { value: formData.ownershipRatings[id as keyof typeof formData.ownershipRatings] })}</span>
                                </div>
                                <input
                                    type="range" min="1" max="5" step="1"
                                    className="w-full accent-[var(--accent)] h-1.5 bg-[var(--border)] rounded-full appearance-none cursor-pointer"
                                    value={formData.ownershipRatings[id as keyof typeof formData.ownershipRatings]}
                                    onChange={e => setFormData({
                                        ...formData,
                                        ownershipRatings: { ...formData.ownershipRatings, [id]: parseInt(e.target.value, 10) }
                                    })}
                                />
                            </div>
                        ))}
                    </div>

                    <div className="pt-8 space-y-4">
                        <label className="text-sm font-bold text-[var(--text-primary)]">{t(locale, 'roles.ownership_checkboxes', 'Ownership Checkboxes')}</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {[
                                {
                                    id: 'lead',
                                    label: t(locale, 'roles.ownership.lead', 'Will lead others'),
                                    tip: t(locale, 'roles.ownershipTip.lead', 'Enable this when the role must coach, delegate, or manage team members directly.'),
                                },
                                {
                                    id: 'own',
                                    label: t(locale, 'roles.ownership.own', 'Will own systems'),
                                    tip: t(locale, 'roles.ownershipTip.own', 'Enable this when long-term accountability for systems or products is expected.'),
                                },
                                {
                                    id: 'clients',
                                    label: t(locale, 'roles.ownership.clients', 'Will interact with clients'),
                                    tip: t(locale, 'roles.ownershipTip.clients', 'Enable this when direct contact with customers or external users is part of the job.'),
                                },
                                {
                                    id: 'processes',
                                    label: t(locale, 'roles.ownership.processes', 'Will define processes'),
                                    tip: t(locale, 'roles.ownershipTip.processes', 'Enable this when the hire should create or improve team workflows and standards.'),
                                },
                                {
                                    id: 'external',
                                    label: t(locale, 'roles.ownership.external', 'Will represent company externally'),
                                    tip: t(locale, 'roles.ownershipTip.external', 'Enable this when the person will represent the company with partners, vendors, or public audiences.'),
                                },
                                {
                                    id: 'other',
                                    label: t(locale, 'roles.ownership.other', 'Other/Custom'),
                                    tip: t(locale, 'roles.ownershipTip.other', 'Use this for responsibilities that are specific to your context and not listed above.'),
                                },
                            ].map(item => (
                                <div key={item.id} className="flex flex-col gap-2 p-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl group hover:bg-[var(--bg-raised)] hover:border-[var(--accent)]/40 transition-all">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <div className={`w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center ${formData.responsibilities[item.id as keyof typeof formData.responsibilities] ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--border)]'}`}>
                                            {formData.responsibilities[item.id as keyof typeof formData.responsibilities] && <CheckCircle className="w-4 h-4 text-white" />}
                                        </div>
                                        <input
                                            type="checkbox" className="hidden"
                                            checked={!!formData.responsibilities[item.id as keyof typeof formData.responsibilities]}
                                            onChange={() => setFormData({
                                                ...formData,
                                                responsibilities: { ...formData.responsibilities, [item.id]: !formData.responsibilities[item.id as keyof typeof formData.responsibilities] }
                                            })}
                                        />
                                        <span className="text-sm font-medium text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">
                                            {item.label}
                                            <FieldTip text={item.tip} />
                                        </span>
                                    </label>
                                    {item.id === 'other' && formData.responsibilities.other && (
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] bg-[var(--bg-surface)] border border-[var(--border)] transition-colors mt-2"
                                            placeholder={t(locale, 'roles.placeholder.customOwnership', 'Describe custom ownership...')}
                                            value={formData.responsibilities.otherCustom}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                responsibilities: {
                                                    ...formData.responsibilities,
                                                    otherCustom: e.target.value
                                                }
                                            })}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* SECTION 4 — Skills */}
                <section className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[2rem] p-10 border border-[var(--border)]">
                    <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2 mb-6">
                        <ShieldCheck className="w-5 h-5 text-[var(--accent)]" />
                        {t(locale, 'roles.section.skills', 'Skill Requirements')}<FieldTip text={t(locale, 'roles.tip.skills', "Each skill has a weight in AI matching. 'Core' = mandatory, 'Important' = heavily weighted, 'Nice' = bonus. Add as many skills as needed.")} />
                    </h2>
                    <div className="space-y-4">
                        {formData.skills.map((skill, idx) => (
                            <div key={idx} className="p-6 bg-[var(--bg-surface)] border border-[var(--border)] rounded-3xl space-y-4 relative group">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                                    <div className="space-y-1 lg:col-span-2">
                                        <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase">{t(locale, 'roles.skill_name', 'Skill Name')}</label>
                                        <input
                                            className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border)] border border-[var(--border)] rounded-lg text-sm"
                                            placeholder={t(locale, 'roles.placeholder.skillName', 'React / SQL / UX...')}
                                            value={skill.name}
                                            onChange={e => {
                                                const newSkills = [...formData.skills];
                                                newSkills[idx].name = e.target.value;
                                                setFormData({ ...formData, skills: newSkills });
                                            }}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase">{t(locale, 'roles.category', 'Category')}</label>
                                        <select
                                            className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border)] border border-[var(--border)] rounded-lg text-sm appearance-none"
                                            value={skill.category}
                                            onChange={(e) => {
                                                const newSkills = [...formData.skills];
                                                newSkills[idx].category = e.target.value;
                                                if (e.target.value !== "Other") {
                                                    newSkills[idx].customCategory = "";
                                                }
                                                setFormData({ ...formData, skills: newSkills });
                                            }}
                                        >
                                            <option value="">{t(locale, 'roles.option.selectCategory', 'Select category')}</option>
                                            <option value="Tech">{t(locale, 'roles.option.category.tech', 'Tech')}</option>
                                            <option value="Business">{t(locale, 'roles.option.category.business', 'Business')}</option>
                                            <option value="Product">{t(locale, 'roles.option.category.product', 'Product')}</option>
                                            <option value="Ops">{t(locale, 'roles.option.category.ops', 'Ops')}</option>
                                            <option value="Other">{t(locale, 'roles.option.other', 'Other')}</option>
                                        </select>
                                        {skill.category === "Other" && (
                                            <input
                                                className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border)] border border-[var(--border)] rounded-lg text-sm"
                                                placeholder={t(locale, 'roles.placeholder.otherCategory', 'Enter a custom category')}
                                                value={skill.customCategory || ""}
                                                onChange={(e) => {
                                                    const newSkills = [...formData.skills];
                                                    newSkills[idx].customCategory = e.target.value;
                                                    setFormData({ ...formData, skills: newSkills });
                                                }}
                                            />
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase">{t(locale, 'roles.importance', 'Importance')}</label>
                                        <select
                                            className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border)] border border-[var(--border)] rounded-lg text-sm appearance-none"
                                            value={skill.importance}
                                            onChange={(e) => {
                                                const newSkills = [...formData.skills];
                                                newSkills[idx].importance = e.target.value;
                                                if (e.target.value !== "Other") {
                                                    newSkills[idx].customImportance = "";
                                                }
                                                setFormData({ ...formData, skills: newSkills });
                                            }}
                                        >
                                            <option value="">{t(locale, 'roles.option.selectImportance', 'Select importance')}</option>
                                            <option value="Core">{t(locale, 'roles.option.importance.core', 'Core')}</option>
                                            <option value="Important">{t(locale, 'roles.option.importance.important', 'Important')}</option>
                                            <option value="Nice">{t(locale, 'roles.option.importance.nice', 'Nice')}</option>
                                            <option value="Other">{t(locale, 'roles.option.other', 'Other')}</option>
                                        </select>
                                        {skill.importance === "Other" && (
                                            <input
                                                className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border)] border border-[var(--border)] rounded-lg text-sm"
                                                placeholder={t(locale, 'roles.placeholder.otherImportance', 'Enter a custom importance')}
                                                value={skill.customImportance || ""}
                                                onChange={(e) => {
                                                    const newSkills = [...formData.skills];
                                                    newSkills[idx].customImportance = e.target.value;
                                                    setFormData({ ...formData, skills: newSkills });
                                                }}
                                            />
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase">{t(locale, 'roles.level', 'Level')}</label>
                                        <select
                                            className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border)] border border-[var(--border)] rounded-lg text-sm appearance-none"
                                            value={skill.level}
                                            onChange={(e) => {
                                                const newSkills = [...formData.skills];
                                                newSkills[idx].level = e.target.value;
                                                if (e.target.value !== "Other") {
                                                    newSkills[idx].customLevel = "";
                                                }
                                                setFormData({ ...formData, skills: newSkills });
                                            }}
                                        >
                                            <option value="">{t(locale, 'roles.option.selectLevel', 'Select level')}</option>
                                            <option value="Junior">{t(locale, 'roles.option.level.junior', 'Junior')}</option>
                                            <option value="Mid">{t(locale, 'roles.option.level.mid', 'Mid')}</option>
                                            <option value="Senior">{t(locale, 'roles.option.level.senior', 'Senior')}</option>
                                            <option value="Other">{t(locale, 'roles.option.other', 'Other')}</option>
                                        </select>
                                        {skill.level === "Other" && (
                                            <input
                                                className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border)] border border-[var(--border)] rounded-lg text-sm"
                                                placeholder={t(locale, 'roles.placeholder.otherLevel', 'Enter a custom level')}
                                                value={skill.customLevel || ""}
                                                onChange={(e) => {
                                                    const newSkills = [...formData.skills];
                                                    newSkills[idx].customLevel = e.target.value;
                                                    setFormData({ ...formData, skills: newSkills });
                                                }}
                                            />
                                        )}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, skills: formData.skills.filter((_, i) => i !== idx) })}
                                    className="absolute -right-2 -top-2 w-8 h-8 bg-[var(--bg-surface)] border border-[var(--border)] border border-red-400/10 text-red-400 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-400/10"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}

                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, skills: [...formData.skills, { name: "", category: "Tech", customCategory: "", importance: "Important", customImportance: "", level: "Mid", customLevel: "" }] })}
                            className="w-full py-4 border-2 border-dashed border-[var(--border)] rounded-3xl text-[var(--text-muted)] font-bold hover:border-[var(--accent)]/40 hover:text-[var(--accent)] transition-all flex items-center justify-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            {t(locale, 'roles.addSkill', 'Add skill marker')}
                        </button>
                    </div>
                </section>

                {/* SECTION 5 — Culture */}
                <section className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[2rem] p-10 border border-[var(--border)]">
                    <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2 mb-6">
                        <Users className="w-5 h-5 text-[var(--accent)]" />
                        {t(locale, 'roles.section.culture', 'Environment & Culture')}<FieldTip text={t(locale, 'roles.tip.culture', "Position sliders according to your team culture. This data helps AI evaluate candidate cultural fit.")} />
                    </h2>
                    <div className="space-y-8 max-w-2xl mx-auto py-4">
                        {[
                            { id: 'speed', leftKey: 'roles.culture.speed.left', leftFallback: 'Stability', rightKey: 'roles.culture.speed.right', rightFallback: 'Speed' },
                            { id: 'structure', leftKey: 'roles.culture.structure.left', leftFallback: 'Chaos', rightKey: 'roles.culture.structure.right', rightFallback: 'Structure' },
                            { id: 'coaching', leftKey: 'roles.culture.coaching.left', leftFallback: 'Independence', rightKey: 'roles.culture.coaching.right', rightFallback: 'Coaching' },
                            { id: 'risk', leftKey: 'roles.culture.risk.left', leftFallback: 'Precision', rightKey: 'roles.culture.risk.right', rightFallback: 'Risk-taking' },
                            { id: 'process', leftKey: 'roles.culture.process.left', leftFallback: 'Outcome-driven', rightKey: 'roles.culture.process.right', rightFallback: 'Process-driven' },
                        ].map(slider => (
                            <div key={slider.id} className="space-y-3">
                                <div className="flex justify-between items-center text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
                                    <span>{t(locale, slider.leftKey, slider.leftFallback)}</span>
                                    <span className="text-[var(--accent)]">{formData.culture[slider.id as keyof typeof formData.culture]}%</span>
                                    <span>{t(locale, slider.rightKey, slider.rightFallback)}</span>
                                </div>
                                <div className="relative flex items-center">
                                    <div className="absolute w-full h-1 bg-[var(--bg-surface)] rounded-full" />
                                    <input
                                        type="range" min="0" max="100"
                                        className="relative w-full accent-[var(--accent)] appearance-none bg-transparent cursor-pointer h-1.5 focus:outline-none"
                                        value={formData.culture[slider.id as keyof typeof formData.culture]}
                                        onChange={e => setFormData({
                                            ...formData,
                                            culture: { ...formData.culture, [slider.id]: parseInt(e.target.value, 10) }
                                        })}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-[var(--text-primary)]">{t(locale, 'roles.dealbreakers', 'Dealbreakers')}<FieldTip text={t(locale, 'roles.tip.dealbreakers', "Absolute exclusion criteria. A candidate showing these traits will be automatically downranked by AI.")} /></label>
                            <textarea
                                className="w-full px-4 py-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl text-sm focus:ring-2 focus:ring-red-100"
                                placeholder={t(locale, 'roles.placeholder.dealbreakers', 'Rigid mindset, slow execution...')}
                                value={formData.dealbreakers}
                                onChange={e => setFormData({ ...formData, dealbreakers: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-[var(--text-primary)]">{t(locale, 'roles.team_dynamics', 'Team Dynamics')}</label>
                            <textarea
                                className="w-full px-4 py-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl text-sm focus:ring-2 focus:ring-green-100"
                                placeholder={t(locale, 'roles.placeholder.dynamics', 'Full autonomy, speed-driven, problem solvers...')}
                                value={formData.dynamics}
                                onChange={e => setFormData({ ...formData, dynamics: e.target.value })}
                            />
                        </div>
                    </div>
                </section>

                {/* SECTION 6 — Constraints */}
                <section className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[2rem] p-10 border border-[var(--border)]">
                    <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2 mb-6">
                        <DollarSign className="w-5 h-5 text-[var(--accent)]" />
                        {t(locale, 'roles.section.constraints', 'Constraints & Deal-breakers')}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-[var(--text-muted)] uppercase">{t(locale, 'roles.salary_range', 'Salary Range')}<FieldTip text={t(locale, 'roles.tip.salary', "Gross annual amount. Choose the currency matching the job country. This range is used for candidate matching and filtering.")} /></label>
                            <div className="flex items-center gap-2">
                                <select
                                    className="w-24 shrink-0 px-2 py-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl text-sm appearance-none text-center font-bold"
                                    value={formData.salaryCurrency}
                                    onChange={e => setFormData({ ...formData, salaryCurrency: e.target.value })}
                                >
                                    {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>)}
                                </select>
                                <input
                                    type="number"
                                    className="w-full px-4 py-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl text-sm"
                                    placeholder={t(locale, 'roles.placeholder.salaryMin', 'ex: 45000')}
                                    value={formData.salaryMin}
                                    onChange={e => setFormData({ ...formData, salaryMin: e.target.value })}
                                />
                                <span className="text-[var(--text-muted)] font-bold">-</span>
                                <input
                                    type="number"
                                    className="w-full px-4 py-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl text-sm"
                                    placeholder={t(locale, 'roles.placeholder.salaryMax', 'ex: 65000')}
                                    value={formData.salaryMax}
                                    onChange={e => setFormData({ ...formData, salaryMax: e.target.value })}
                                />
                            </div>
                            <p className="text-[10px] text-[var(--text-muted)] mt-1">{t(locale, 'roles.salaryHint', 'Gross annual')}</p>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-[var(--text-muted)] uppercase">{t(locale, 'roles.availability', 'Availability')}</label>
                            <input
                                className="w-full px-4 py-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl text-sm"
                                placeholder={t(locale, 'roles.placeholder.availability', 'e.g. Immediate / 1 month notice')}
                                value={formData.availability}
                                onChange={e => setFormData({ ...formData, availability: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-[var(--text-muted)] uppercase">{t(locale, 'roles.remote_rules', 'Remote Rules')}</label>
                            <select
                                className="w-full px-4 py-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl text-sm appearance-none"
                                value={formData.remoteRule}
                                onChange={e => setFormData({ ...formData, remoteRule: e.target.value, remoteRuleOther: e.target.value === 'other' ? formData.remoteRuleOther : '' })}
                            >
                                <option value="">{t(locale, 'roles.option.selectRemoteRule', 'Select')}</option>
                                <option value="Remote">{t(locale, 'roles.option.remote', 'Remote')}</option>
                                <option value="Hybrid (1-2 days/wk)">{t(locale, 'roles.option.hybrid', 'Hybrid (1-2 days/wk)')}</option>
                                <option value="Onsite Required">{t(locale, 'roles.option.onsite', 'Onsite Required')}</option>
                                <option value="other">{t(locale, 'roles.option.other', 'Other')}</option>
                            </select>
                            {formData.remoteRule === 'other' && (
                                <input
                                    className="w-full px-4 py-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl text-sm mt-2"
                                    placeholder={t(locale, 'roles.placeholder.otherRemoteRule', 'Enter a custom remote rule')}
                                    value={formData.remoteRuleOther}
                                    onChange={e => setFormData({ ...formData, remoteRuleOther: e.target.value })}
                                />
                            )}
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-[var(--text-muted)] uppercase">{t(locale, 'roles.team_size', 'Team Size')}</label>
                            <input
                                className="w-full px-4 py-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl text-sm focus:ring-2 focus:ring-[var(--accent)]/20"
                                placeholder={t(locale, 'roles.placeholder.teamSize', 'e.g. 5-10')}
                                value={formData.teamSize}
                                onChange={e => setFormData({ ...formData, teamSize: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-[var(--text-muted)] uppercase">{t(locale, 'roles.reporting_to', 'Reporting To')}</label>
                            <input
                                className="w-full px-4 py-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl text-sm focus:ring-2 focus:ring-[var(--accent)]/20"
                                placeholder={t(locale, 'roles.placeholder.reportingTo', 'e.g. CTO / Head of Engineering')}
                                value={formData.reportingTo}
                                onChange={e => setFormData({ ...formData, reportingTo: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-[var(--text-muted)] uppercase">{t(locale, 'roles.team_challenges', 'Team Challenges')}</label>
                            <input
                                className="w-full px-4 py-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl text-sm focus:ring-2 focus:ring-[var(--accent)]/20"
                                placeholder={t(locale, 'roles.placeholder.challenges', 'e.g. Scaling database, tech debt')}
                                value={formData.challenges}
                                onChange={e => setFormData({ ...formData, challenges: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1 md:col-span-2">
                            <label className="text-xs font-bold text-[var(--text-muted)] uppercase">{t(locale, 'roles.legal_constraints', 'Legal Constraints')}</label>
                            <textarea
                                className="w-full px-4 py-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl text-sm resize-none"
                                placeholder={t(locale, 'roles.placeholder.legal', 'Visa requirements, local tax compliance...')}
                                value={formData.legal}
                                onChange={e => setFormData({ ...formData, legal: e.target.value })}
                            />
                        </div>
                    </div>
                </section>

                {/* SECTION 7 — Posture */}
                <section className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[2rem] p-10 border border-[var(--border)]">
                    <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2 mb-6">
                        <Globe className="w-5 h-5 text-[var(--accent)]" />
                        {t(locale, 'roles.section.posture', 'Hiring Posture')}
                    </h2>
                    <div className="space-y-4">
                        <label className="text-sm font-bold text-[var(--text-primary)]">{t(locale, 'roles.which_matters', 'Which matters more?')}</label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {[
                                { id: 'speed', key: 'roles.priority.speed', fallback: 'speed' },
                                { id: 'quality', key: 'roles.priority.quality', fallback: 'quality' },
                                { id: 'budget', key: 'roles.priority.budget', fallback: 'budget' },
                            ].map(p => (
                                <button
                                    key={p.id} type="button"
                                    onClick={() => setFormData({ ...formData, priority: p.id })}
                                    className={`py-6 rounded-2xl border-2 font-bold transition-all ${formData.priority === p.id
                                        ? 'border-[var(--accent)] bg-[var(--accent)]/5 text-[var(--accent)]'
                                        : 'border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:border-[var(--border)]'}`}
                                >
                                    {t(locale, p.key, p.fallback)}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-4 pt-6">
                        <label className="text-sm font-bold text-[var(--text-primary)]">{t(locale, 'roles.openness_to', 'Openness to')}</label>
                        <div className="flex flex-wrap gap-3">
                            {[
                                { id: 'tests', label: t(locale, 'roles.openness.tests', 'Skill Tests') },
                                { id: 'trials', label: t(locale, 'roles.openness.trials', 'Paid Trials') },
                                { id: 'nonTraditional', label: t(locale, 'roles.openness.nonTraditional', 'Non-traditional Backgrounds') }
                            ].map(item => (
                                <button
                                    key={item.id} type="button"
                                    onClick={() => setFormData({
                                        ...formData,
                                        openness: { ...formData.openness, [item.id]: !formData.openness[item.id as keyof typeof formData.openness] }
                                    })}
                                    className={`px-6 py-3 rounded-xl border-2 text-xs font-bold transition-all ${formData.openness[item.id as keyof typeof formData.openness]
                                        ? 'bg-[var(--bg-deep)] border-[var(--border)] text-[var(--text-primary)]'
                                        : 'glass-panel border-[var(--border)] text-[var(--text-muted)]'}`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest leading-6">{t(locale, 'roles.recruitment_steps', 'Recruitment Steps')}</label>
                            <input
                                className="w-full px-4 py-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl text-sm"
                                placeholder={t(locale, 'roles.placeholder.processSteps', 'HR -> Tech Review -> Trial')}
                                value={formData.processSteps}
                                onChange={e => setFormData({ ...formData, processSteps: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest leading-6">{t(locale, 'roles.decision_time', 'Decision Time')}</label>
                            <input
                                type="date"
                                className="w-full px-4 py-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl text-sm"
                                value={formData.decisionTime}
                                onChange={e => setFormData({ ...formData, decisionTime: e.target.value })}
                            />
                        </div>
                    </div>
                </section>

                {/* SECTION 8 — AI Evaluation & Form */}
                <section className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[2rem] p-10 border border-[var(--border)]">
                    <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2 mb-6">
                        <Sparkles className="w-5 h-5 text-[var(--accent)]" />
                        {t(locale, 'roles.section.ai', 'AI Evaluation & Custom Application Form')}<FieldTip text={t(locale, 'roles.tip.ai', "Custom questions will be shown to candidates. AI context is secret — it guides automatic evaluation without being visible to candidates.")} />
                    </h2>
                    <p className="text-sm text-[var(--text-muted)] mb-6">
                        {t(locale, 'roles.ai_description', 'Design the questions you want candidates to answer when they apply. Also, provide specific context to our AI so it knows exactly what to look for when grading these answers and candidate DNA.')}
                    </p>

                    <div className="space-y-4">
                        <label className="text-sm font-bold text-[var(--text-primary)] block">{t(locale, 'roles.customFormQuestions', 'Custom Form Questions (one per line)')}</label>
                        <p className="text-xs text-[var(--text-muted)] mb-2">{t(locale, 'roles.customFormQuestionsHint', 'Candidates will have to answer these in free text. Ensure they are precise and measurable.')}</p>
                        <textarea
                            className="w-full px-4 py-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl text-sm min-h-[150px] resize-none"
                            placeholder={t(
                                locale,
                                'roles.placeholder.customFormQuestions',
                                'Example:\nWhat is the biggest infrastructure challenge you solved?\nDescribe your preferred management style in 3 words.'
                            )}
                            value={formData.customFormQuestions}
                            onChange={e => setFormData({ ...formData, customFormQuestions: e.target.value })}
                        />
                    </div>

                    <div className="space-y-4 pt-6">
                        <label className="text-sm font-bold text-[var(--text-primary)] block">{t(locale, 'roles.aiEvalContext', 'AI Evaluation Context & Instructions (Secret)')}</label>
                        <p className="text-xs text-[var(--text-muted)] mb-2">{t(locale, 'roles.aiEvalContextHint', 'Instructions for our AI to evaluate candidates perfectly.')}</p>
                        <textarea
                            className="w-full px-4 py-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl text-sm min-h-[150px] resize-none"
                            placeholder={t(
                                locale,
                                'roles.placeholder.aiEvalContext',
                                'Example:\nCandidates must demonstrate experience with high-load APIs (10,000 req/s+). If they use vague words like "helped scaling" without numbers, drop their capability score drastically...'
                            )}
                            value={formData.evaluationContext}
                            onChange={e => setFormData({ ...formData, evaluationContext: e.target.value })}
                        />
                    </div>
                </section>

                {/* Footer Nav */}
                <div className="mt-4 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end border-t border-[var(--border)] pt-4 sm:pt-8">
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full sm:w-auto px-8 sm:px-12 py-3 sm:py-4 bg-[var(--accent)] text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                        {loading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                {submitLabel ? submitLabel : t(locale, 'roles.publishing', 'Publishing...')}
                            </>
                        ) : (
                            <>
                                <ShieldCheck className="w-5 h-5" />
                                {submitLabel ? submitLabel : t(locale, 'roles.publishDna', 'Publish Job Post Sheet')}
                            </>
                        )}
                    </button>
                </div>
            </form>

            {/* AI Warning */}
            <div className="mt-8 flex items-start gap-4 p-6 bg-[var(--accent)]/10 rounded-2xl border border-[var(--accent)]/20">
                <Sparkles className="w-5 h-5 text-[var(--accent)] mt-0.5 animate-pulse" />
                <p className="text-xs text-[var(--text-primary)]/80 leading-relaxed italic">
                    {t(locale, 'roles.aiWarning', 'You are designing a high-fidelity Job Post Sheet. Our AI uses these vectors to perform deep skill matching. The more precise your mission and ownership data, the higher the candidate resonance.')}
                </p>
            </div>
        </div>
    );
}
