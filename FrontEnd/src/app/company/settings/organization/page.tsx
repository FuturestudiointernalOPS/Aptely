"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, ChevronRight, Building2 } from "lucide-react";
import { apiFetch } from "@/lib/apiHelper";
import { departmentApi, jobPositionApi, API } from "@/lib/routes";
import { getClientLocale, t } from "@/lib/i18n";
import { useWorkspace } from "@/lib/workspace";

interface Department {
    id: string;
    name: string;
    description: string | null;
    parent_department_id: string | null;
    manager_user_id: string | null;
}

interface JobPosition {
    id: string;
    title: string;
    department_id: string | null;
    module_access: string[];
}

type Tab = "departments" | "positions";

function DepartmentForm({
    departments,
    initial,
    onSave,
    onCancel,
    locale: loc,
}: {
    departments: Department[];
    initial?: Partial<Department>;
    onSave: (data: { name: string; description?: string; parent_department_id?: string | null }) => Promise<void>;
    onCancel: () => void;
    locale: ReturnType<typeof getClientLocale>;
}) {
    const [name, setName] = useState(initial?.name ?? "");
    const [description, setDescription] = useState(initial?.description ?? "");
    const [parentId, setParentId] = useState<string>(initial?.parent_department_id ?? "");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        setLoading(true);
        try {
            await onSave({
                name: name.trim(),
                description: description.trim() || undefined,
                parent_department_id: parentId || null,
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    {t(loc, "organization.departments.name", "Nom du département")}
                </label>
                <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t(loc, "organization.departments.namePlaceholder", "Ex: Ingénierie")}
                    className="w-full rounded-lg px-3 py-2 text-sm bg-[var(--bg-raised)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)]"
                    required
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    {t(loc, "organization.departments.description", "Description")}
                </label>
                <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t(loc, "organization.departments.descriptionPlaceholder", "Description optionnelle")}
                    className="w-full rounded-lg px-3 py-2 text-sm bg-[var(--bg-raised)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)]"
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    {t(loc, "organization.departments.parent", "Département parent")}
                </label>
                <select
                    value={parentId}
                    onChange={(e) => setParentId(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-sm bg-[var(--bg-raised)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                >
                    <option value="">{t(loc, "organization.departments.parentNone", "Aucun (département racine)")}</option>
                    {departments
                        .filter((d) => d.id !== initial?.id)
                        .map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={onCancel}
                    className="px-4 py-2 rounded-lg text-sm border border-[var(--border)] bg-[var(--bg-raised)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                    {t(loc, "organization.cancel", "Annuler")}
                </button>
                <button type="submit" disabled={loading || !name.trim()}
                    className="px-4 py-2 rounded-lg text-sm bg-[var(--accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-50">
                    {t(loc, "organization.save", "Enregistrer")}
                </button>
            </div>
        </form>
    );
}

function PositionForm({
    departments,
    initial,
    onSave,
    onCancel,
    locale: loc,
}: {
    departments: Department[];
    initial?: Partial<JobPosition>;
    onSave: (data: { title: string; department_id?: string | null }) => Promise<void>;
    onCancel: () => void;
    locale: ReturnType<typeof getClientLocale>;
}) {
    const [title, setTitle] = useState(initial?.title ?? "");
    const [deptId, setDeptId] = useState<string>(initial?.department_id ?? "");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;
        setLoading(true);
        try {
            await onSave({ title: title.trim(), department_id: deptId || null });
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    {t(loc, "organization.positions.title", "Intitulé du poste")}
                </label>
                <input
                    autoFocus
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t(loc, "organization.positions.titlePlaceholder", "Ex: Ingénieur backend")}
                    className="w-full rounded-lg px-3 py-2 text-sm bg-[var(--bg-raised)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)]"
                    required
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    {t(loc, "organization.positions.department", "Département")}
                </label>
                <select
                    value={deptId}
                    onChange={(e) => setDeptId(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-sm bg-[var(--bg-raised)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                >
                    <option value="">{t(loc, "organization.positions.departmentNone", "Sans département")}</option>
                    {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={onCancel}
                    className="px-4 py-2 rounded-lg text-sm border border-[var(--border)] bg-[var(--bg-raised)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                    {t(loc, "organization.cancel", "Annuler")}
                </button>
                <button type="submit" disabled={loading || !title.trim()}
                    className="px-4 py-2 rounded-lg text-sm bg-[var(--accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-50">
                    {t(loc, "organization.save", "Enregistrer")}
                </button>
            </div>
        </form>
    );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative w-full max-w-md rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-xl p-6">
                <h3 className="text-base font-semibold text-[var(--text-primary)] mb-5">{title}</h3>
                {children}
            </div>
        </div>
    );
}

export default function OrganizationPage() {
    const loc = getClientLocale();
    const { hasPermission } = useWorkspace();
    const router = useRouter();
    const canEdit = hasPermission("settings.edit");

    const [tab, setTab] = useState<Tab>("departments");
    const [departments, setDepartments] = useState<Department[]>([]);
    const [positions, setPositions] = useState<JobPosition[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal state
    const [deptModal, setDeptModal] = useState<{ mode: "create" | "edit"; dept?: Department } | null>(null);
    const [posModal, setPosModal] = useState<{ mode: "create" | "edit"; pos?: JobPosition } | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<{ type: "dept" | "pos"; id: string; name: string } | null>(null);

    const loadAll = async () => {
        setLoading(true);
        try {
            const [deptRes, posRes] = await Promise.all([
                apiFetch(API.departments, "HR") as Promise<{ data: Department[] } | null>,
                apiFetch(API.jobPositions, "HR") as Promise<{ data: JobPosition[] } | null>,
            ]);
            setDepartments(deptRes?.data ?? []);
            setPositions(posRes?.data ?? []);
        } catch { /* silent */ }
        setLoading(false);
    };

    useEffect(() => { void loadAll(); }, []);

    // ─── Department actions ───────────────────────────────────────────────────
    const handleCreateDept = async (data: { name: string; description?: string; parent_department_id?: string | null }) => {
        await apiFetch(API.departments, "HR", { method: "POST", body: JSON.stringify(data) });
        setDeptModal(null);
        void loadAll();
    };

    const handleUpdateDept = async (id: string, data: { name: string; description?: string; parent_department_id?: string | null }) => {
        await apiFetch(departmentApi(id), "HR", { method: "PATCH", body: JSON.stringify(data) });
        setDeptModal(null);
        void loadAll();
    };

    const handleDeleteDept = async (id: string) => {
        await apiFetch(departmentApi(id), "HR", { method: "DELETE" });
        setConfirmDelete(null);
        void loadAll();
    };

    // ─── Position actions ─────────────────────────────────────────────────────
    const handleCreatePos = async (data: { title: string; department_id?: string | null }) => {
        await apiFetch(API.jobPositions, "HR", { method: "POST", body: JSON.stringify(data) });
        setPosModal(null);
        void loadAll();
    };

    const handleUpdatePos = async (id: string, data: { title: string; department_id?: string | null }) => {
        await apiFetch(jobPositionApi(id), "HR", { method: "PATCH", body: JSON.stringify(data) });
        setPosModal(null);
        void loadAll();
    };

    const handleDeletePos = async (id: string) => {
        await apiFetch(jobPositionApi(id), "HR", { method: "DELETE" });
        setConfirmDelete(null);
        void loadAll();
    };

    // ─── Build dept tree ──────────────────────────────────────────────────────
    const deptTree = buildTree(departments);

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold text-[var(--text-primary)]">
                        {t(loc, "organization.title", "Organisation")}
                    </h1>
                    <p className="text-sm text-[var(--text-muted)] mt-1">
                        {t(loc, "organization.subtitle", "Gérez les départements et les postes de votre entreprise")}
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-[var(--bg-raised)] rounded-lg w-fit border border-[var(--border)]">
                {(["departments", "positions"] as Tab[]).map((tabKey) => (
                    <button
                        key={tabKey}
                        type="button"
                        onClick={() => setTab(tabKey)}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                            tab === tabKey
                                ? "bg-[var(--bg-surface)] text-[var(--accent)] shadow-sm"
                                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        }`}
                    >
                        {tabKey === "departments"
                            ? t(loc, "organization.tabs.departments", "Départements")
                            : t(loc, "organization.tabs.positions", "Postes")}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
                {/* Tab toolbar */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
                    <span className="text-sm font-medium text-[var(--text-primary)]">
                        {tab === "departments"
                            ? `${departments.length} ${t(loc, "organization.tabs.departments", "Départements")}`
                            : `${positions.length} ${t(loc, "organization.tabs.positions", "Postes")}`}
                    </span>
                    {canEdit && (
                        <button
                            type="button"
                            onClick={() => tab === "departments"
                                ? setDeptModal({ mode: "create" })
                                : setPosModal({ mode: "create" })
                            }
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
                        >
                            <Plus size={14} />
                            {tab === "departments"
                                ? t(loc, "organization.departments.add", "Nouveau département")
                                : t(loc, "organization.positions.add", "Nouveau poste")}
                        </button>
                    )}
                </div>

                {/* List */}
                {loading ? (
                    <div className="px-5 py-8 space-y-2">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-12 rounded-lg bg-[var(--bg-raised)] animate-pulse" />
                        ))}
                    </div>
                ) : tab === "departments" ? (
                    departments.length === 0 ? (
                        <div className="px-5 py-12 text-center">
                            <Building2 className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-3" />
                            <p className="text-sm font-medium text-[var(--text-secondary)]">
                                {t(loc, "organization.departments.empty", "Aucun département")}
                            </p>
                            <p className="text-xs text-[var(--text-muted)] mt-1">
                                {t(loc, "organization.departments.emptyDesc", "Créez votre premier département pour structurer votre organisation.")}
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-[var(--border)]">
                            {deptTree.map((node) => (
                                <DeptRow
                                    key={node.dept.id}
                                    node={node}
                                    depth={0}
                                    positions={positions}
                                    canEdit={canEdit}
                                    onEdit={(dept) => setDeptModal({ mode: "edit", dept })}
                                    onDelete={(dept) => setConfirmDelete({ type: "dept", id: dept.id, name: dept.name })}
                                    loc={loc}
                                />
                            ))}
                        </div>
                    )
                ) : (
                    positions.length === 0 ? (
                        <div className="px-5 py-12 text-center">
                            <Building2 className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-3" />
                            <p className="text-sm font-medium text-[var(--text-secondary)]">
                                {t(loc, "organization.positions.empty", "Aucun poste")}
                            </p>
                            <p className="text-xs text-[var(--text-muted)] mt-1">
                                {t(loc, "organization.positions.emptyDesc", "Créez des postes pour structurer les rôles dans votre équipe.")}
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-[var(--border)]">
                            {positions.map((pos) => {
                                const dept = departments.find((d) => d.id === pos.department_id);
                                return (
                                    <div key={pos.id} className="flex items-center justify-between px-5 py-3 hover:bg-[var(--bg-raised)] transition-colors">
                                        <div>
                                            <p className="text-sm font-medium text-[var(--text-primary)]">{pos.title}</p>
                                            {dept && (
                                                <p className="text-xs text-[var(--text-muted)] mt-0.5">{dept.name}</p>
                                            )}
                                        </div>
                                        {canEdit && (
                                            <div className="flex items-center gap-1">
                                                <button type="button"
                                                    onClick={() => setPosModal({ mode: "edit", pos })}
                                                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-dim)] transition-colors"
                                                    title={t(loc, "organization.positions.edit", "Modifier")}
                                                >
                                                    <Pencil size={13} />
                                                </button>
                                                <button type="button"
                                                    onClick={() => setConfirmDelete({ type: "pos", id: pos.id, name: pos.title })}
                                                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-400/10 transition-colors"
                                                    title={t(loc, "organization.positions.delete", "Supprimer")}
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )
                )}
            </div>

            {/* Department create/edit modal */}
            {deptModal && (
                <Modal
                    title={deptModal.mode === "create"
                        ? t(loc, "organization.departments.add", "Nouveau département")
                        : t(loc, "organization.departments.edit", "Modifier le département")}
                    onClose={() => setDeptModal(null)}
                >
                    <DepartmentForm
                        departments={departments}
                        initial={deptModal.dept}
                        onSave={deptModal.mode === "create"
                            ? handleCreateDept
                            : (data) => handleUpdateDept(deptModal.dept!.id, data)}
                        onCancel={() => setDeptModal(null)}
                        locale={loc}
                    />
                </Modal>
            )}

            {/* Position create/edit modal */}
            {posModal && (
                <Modal
                    title={posModal.mode === "create"
                        ? t(loc, "organization.positions.add", "Nouveau poste")
                        : t(loc, "organization.positions.edit", "Modifier le poste")}
                    onClose={() => setPosModal(null)}
                >
                    <PositionForm
                        departments={departments}
                        initial={posModal.pos}
                        onSave={posModal.mode === "create"
                            ? handleCreatePos
                            : (data) => handleUpdatePos(posModal.pos!.id, data)}
                        onCancel={() => setPosModal(null)}
                        locale={loc}
                    />
                </Modal>
            )}

            {/* Confirm delete modal */}
            {confirmDelete && (
                <Modal
                    title={confirmDelete.type === "dept"
                        ? t(loc, "organization.departments.deleteConfirm", "Supprimer ce département ?")
                        : t(loc, "organization.positions.deleteConfirm", "Supprimer ce poste ?")}
                    onClose={() => setConfirmDelete(null)}
                >
                    <p className="text-sm text-[var(--text-secondary)] mb-6">
                        <span className="font-medium text-[var(--text-primary)]">{confirmDelete.name}</span>
                    </p>
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setConfirmDelete(null)}
                            className="px-4 py-2 rounded-lg text-sm border border-[var(--border)] bg-[var(--bg-raised)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                            {t(loc, "organization.cancel", "Annuler")}
                        </button>
                        <button type="button"
                            onClick={() => confirmDelete.type === "dept"
                                ? void handleDeleteDept(confirmDelete.id)
                                : void handleDeletePos(confirmDelete.id)}
                            className="px-4 py-2 rounded-lg text-sm bg-red-500 text-white hover:opacity-90 transition-opacity">
                            {confirmDelete.type === "dept"
                                ? t(loc, "organization.departments.delete", "Supprimer")
                                : t(loc, "organization.positions.delete", "Supprimer")}
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    );
}

// ─── Dept tree helpers ────────────────────────────────────────────────────────

interface DeptNode {
    dept: Department;
    children: DeptNode[];
}

function buildTree(departments: Department[]): DeptNode[] {
    const map = new Map<string, DeptNode>();
    departments.forEach((d) => map.set(d.id, { dept: d, children: [] }));

    const roots: DeptNode[] = [];
    departments.forEach((d) => {
        const node = map.get(d.id)!;
        if (d.parent_department_id && map.has(d.parent_department_id)) {
            map.get(d.parent_department_id)!.children.push(node);
        } else {
            roots.push(node);
        }
    });
    return roots;
}

function DeptRow({
    node,
    depth,
    positions,
    canEdit,
    onEdit,
    onDelete,
    loc,
}: {
    node: DeptNode;
    depth: number;
    positions: JobPosition[];
    canEdit: boolean;
    onEdit: (d: Department) => void;
    onDelete: (d: Department) => void;
    loc: ReturnType<typeof getClientLocale>;
}) {
    const posCount = positions.filter((p) => p.department_id === node.dept.id).length;

    return (
        <>
            <div className="flex items-center justify-between px-5 py-3 hover:bg-[var(--bg-raised)] transition-colors"
                style={{ paddingLeft: `${1.25 + depth * 1.5}rem` }}>
                <div className="flex items-center gap-2 min-w-0">
                    {depth > 0 && <ChevronRight size={12} className="text-[var(--text-muted)] flex-shrink-0" />}
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--text-primary)] truncate">{node.dept.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                            {node.dept.description && (
                                <p className="text-xs text-[var(--text-muted)] truncate max-w-xs">{node.dept.description}</p>
                            )}
                            {posCount > 0 && (
                                <span className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-raised)] border border-[var(--border)] rounded-full px-1.5 py-0.5 flex-shrink-0">
                                    {posCount} {posCount === 1 ? "poste" : "postes"}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                {canEdit && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <button type="button"
                            onClick={() => onEdit(node.dept)}
                            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-dim)] transition-colors"
                            title={t(loc, "organization.departments.edit", "Modifier")}
                        >
                            <Pencil size={13} />
                        </button>
                        <button type="button"
                            onClick={() => onDelete(node.dept)}
                            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-400/10 transition-colors"
                            title={t(loc, "organization.departments.delete", "Supprimer")}
                        >
                            <Trash2 size={13} />
                        </button>
                    </div>
                )}
            </div>
            {node.children.map((child) => (
                <DeptRow
                    key={child.dept.id}
                    node={child}
                    depth={depth + 1}
                    positions={positions}
                    canEdit={canEdit}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    loc={loc}
                />
            ))}
        </>
    );
}
