"use client";

import { useState, useEffect } from "react";
import { getAvailableTeams, Team, requestToJoinTeam } from "@/lib/api";
import { useRequireInstitution } from "@/lib/auth";
import { getClientLocale, t } from "@/lib/i18n";
import { Search, Users, ArrowRight, ShieldCheck, Check, Building2 } from "lucide-react";


export default function TeamsPage() {
    useRequireInstitution();
    const locale = getClientLocale();
    const tr = (key: string, fallback: string) => t(locale, key, fallback);

    const [teams, setTeams] = useState<Team[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [requestedId, setRequestedId] = useState<string | null>(null);

    useEffect(() => {
        getAvailableTeams().then(data => {
            setTeams(data);
            setLoading(false);
        });
    }, []);

    const handleJoinRequest = async (teamId: string) => {
        setRequestedId(teamId);
        await requestToJoinTeam(teamId);
    };

    const filtered = teams.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.description.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-20">
            <div className="animate-fade-in-up">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-[var(--text-primary)]">{tr("teams.title", "Find Your Team")}</h1>
                <p className="text-[var(--text-muted)] mt-2">{tr("teams.subtitle", "Browse the organization network and request access to collaborative environments.")}</p>
            </div>

            <div className="relative animate-fade-in-up delay-100">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                <input
                    type="text"
                    placeholder={tr("teams.searchPlaceholder", "Search by institution name or sector...")}
                    className="w-full pl-12 pr-6 py-4 bg-[var(--bg-surface)] border border-[var(--border)] border border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-4 focus:ring-[var(--accent)]/5 focus:border-[var(--accent)]/30 transition-all"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-48 bg-[var(--bg-surface)] border border-[var(--border)] rounded-3xl animate-pulse" />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-20 bg-[var(--bg-surface)] border border-[var(--border)] rounded-3xl border border-dashed border-[var(--border)]">
                    <Building2 className="w-12 h-12 mx-auto mb-4 text-[var(--text-muted)]" />
                    <p className="font-bold text-[var(--text-primary)]">{tr("teams.noResults", "No institutions found")}</p>
                    <p className="text-sm text-[var(--text-muted)]">{tr("teams.noResultsHint", "Try a different search term or check with your manager.")}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {filtered.map((team, i) => (
                        <div
                            key={team.teamId}
                            className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-3xl p-4 sm:p-6 md:p-8 hover:translate-y-[-4px] transition-all border border-[var(--border)] group animate-fade-in-up"
                            style={{ animationDelay: `${i * 100}ms` }}
                        >
                            <div className="flex items-start justify-between mb-6">
                                <div className="w-14 h-14 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] group-hover:bg-[var(--accent)] group-hover:text-white transition-all">
                                    <Building2 className="w-7 h-7" />
                                </div>
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-surface)] rounded-full text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest border border-[var(--border)]">
                                    <Users className="w-3 h-3" />
                                    {tr("teams.membersCount", "{{count}} Members").replace("{{count}}", String(team.membersCount))}
                                </div>
                            </div>

                            <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">{team.name}</h3>
                            <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-8 line-clamp-2">
                                {team.description}
                            </p>

                            <button
                                onClick={() => handleJoinRequest(team.teamId)}
                                disabled={requestedId === team.teamId}
                                className={`w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${requestedId === team.teamId
                                        ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20'
                                        : 'bg-[var(--bg-deep)] text-[var(--text-primary)] hover:shadow-none-lg shadow-none hover:shadow-none-lg'
                                    }`}
                            >
                                {requestedId === team.teamId ? (
                                    <>
                                        <Check className="w-4 h-4" />
                                        {tr("teams.requestSent", "Request Sent")}
                                    </>
                                ) : (
                                    <>
                                        {tr("teams.joinOrganization", "Join Organization")}
                                        <ArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className="bg-[var(--accent)]/10 rounded-3xl p-4 sm:p-6 md:p-8 border border-[var(--accent)]/20 flex items-start gap-4 animate-fade-in-up delay-300">
                <ShieldCheck className="w-6 h-6 text-[var(--accent)] flex-shrink-0" />
                <div>
                    <h4 className="text-[var(--text-primary)] font-bold text-sm">{tr("teams.sovereignty.title", "Team Data Sovereignty")}</h4>
                    <p className="text-xs text-[var(--text-primary)]/70 mt-1 leading-relaxed">
                        {tr("teams.sovereignty.desc", "Your data is isolated per institution. Joining an organization gives you access to its shared hiring pipeline.")}
                    </p>
                </div>
            </div>
        </div>
    );
}
