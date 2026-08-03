"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight, Users, UserCircle } from "lucide-react";
import Link from "next/link";
import { ROUTES, employeePath } from "@/lib/routes";
import { getClientLocale, t } from "@/lib/i18n";

interface Department {
  id: string;
  name: string;
  parent_department_id: string | null;
  manager_user_id: string | null;
}

interface OrgEmployee {
  user_id: string;
  employment_status: string;
  job_positions: { title: string } | null;
  profiles: { full_name: string; avatar_url: string | null } | null;
  departments: { id: string; name: string } | null;
}

interface DeptNode {
  dept: Department;
  children: DeptNode[];
  employees: OrgEmployee[];
}

function buildTree(depts: Department[], employees: OrgEmployee[]): DeptNode[] {
  const map = new Map<string, DeptNode>();
  depts.forEach((d) => {
    map.set(d.id, {
      dept: d,
      children: [],
      employees: employees.filter(
        (e) => e.departments?.id === d.id && e.employment_status === "ACTIVE"
      ),
    });
  });
  const roots: DeptNode[] = [];
  depts.forEach((d) => {
    const node = map.get(d.id)!;
    if (d.parent_department_id && map.has(d.parent_department_id)) {
      map.get(d.parent_department_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function OrgNode({
  node,
  allEmployees,
  depth = 0,
}: {
  node: DeptNode;
  allEmployees: OrgEmployee[];
  depth?: number;
}) {
  const [open, setOpen] = useState(depth < 2);

  const manager = node.dept.manager_user_id
    ? allEmployees.find((e) => e.user_id === node.dept.manager_user_id)
    : null;

  const hasChildren = node.children.length > 0;
  const hasEmployees = node.employees.length > 0;
  const isExpandable = hasChildren || hasEmployees;

  return (
    <div className={depth > 0 ? "ml-6 border-l border-[var(--border)] pl-4 mt-2" : "mt-2"}>
      <div
        className={`bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-4 py-3 transition-colors ${
          isExpandable ? "cursor-pointer hover:bg-[var(--bg-raised)]" : ""
        }`}
        onClick={() => isExpandable && setOpen(!open)}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {isExpandable ? (
              open ? (
                <ChevronDown className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
              )
            ) : (
              <div className="w-4 flex-shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                {node.dept.name}
              </p>
              {manager && (
                <p className="text-xs text-[var(--text-muted)] truncate">
                  {manager.profiles?.full_name}
                </p>
              )}
            </div>
          </div>
          {hasEmployees && (
            <span className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--accent-dim)] text-[var(--accent)] text-xs font-medium">
              <Users className="w-3 h-3" />
              {node.employees.length}
            </span>
          )}
        </div>

        {open && hasEmployees && (
          <div className="mt-3 pt-3 border-t border-[var(--border)] flex flex-wrap gap-2">
            {node.employees.map((emp) => (
              <Link
                key={emp.user_id}
                href={employeePath(emp.user_id)}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--bg-raised)] border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)]/30 transition-colors"
              >
                {emp.profiles?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={emp.profiles.avatar_url}
                    className="w-4 h-4 rounded-full object-cover"
                    alt=""
                  />
                ) : (
                  <UserCircle className="w-4 h-4 text-[var(--text-muted)]" />
                )}
                <span className="truncate max-w-[140px]">
                  {emp.profiles?.full_name ?? "—"}
                </span>
                {emp.job_positions?.title && (
                  <span className="text-[var(--text-muted)] hidden sm:inline truncate max-w-[100px]">
                    · {emp.job_positions.title}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {open &&
        hasChildren &&
        node.children.map((child) => (
          <OrgNode
            key={child.dept.id}
            node={child}
            allEmployees={allEmployees}
            depth={depth + 1}
          />
        ))}
    </div>
  );
}

export function OrgChart({
  departments,
  employees,
}: {
  departments: Department[];
  employees: OrgEmployee[];
}) {
  const locale = getClientLocale();
  const tree = buildTree(departments, employees);
  const unassigned = employees.filter(
    (e) => !e.departments?.id && e.employment_status === "ACTIVE"
  );

  if (departments.length === 0) {
    return (
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-12 flex flex-col items-center gap-3 text-center">
        <Users className="w-10 h-10 text-[var(--text-muted)]/30" />
        <p className="text-sm text-[var(--text-muted)]">{t(locale, "hr.employees.orgChart.empty", "Aucun département créé.")}</p>
        <p className="text-xs text-[var(--text-muted)]">
          {t(locale, "hr.employees.orgChart.emptyHintPrefix", "Créez des départements dans")}{" "}
          <Link
            href={ROUTES.company.settings.organization}
            className="text-[var(--accent)] hover:underline"
          >
            {t(locale, "hr.employees.orgChart.emptyHintLink", "Paramètres → Organisation")}
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {tree.map((root) => (
        <OrgNode key={root.dept.id} node={root} allEmployees={employees} depth={0} />
      ))}

      {unassigned.length > 0 && (
        <div className="mt-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">
            {t(locale, "hr.employees.orgChart.unassigned", `Sans département (${unassigned.length})`, { count: unassigned.length })}
          </p>
          <div className="flex flex-wrap gap-2">
            {unassigned.map((emp) => (
              <Link
                key={emp.user_id}
                href={employeePath(emp.user_id)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--bg-raised)] border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)]/30 transition-colors"
              >
                <UserCircle className="w-4 h-4 text-[var(--text-muted)]" />
                <span className="truncate max-w-[140px]">{emp.profiles?.full_name ?? "—"}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
