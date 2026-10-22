"use client";
import { rolePath, ROUTES } from "@/lib/routes";

import RoleDnaForm from "@/components/RoleDnaForm";
import { createRoleWithDna } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useRequireInstitution } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { useSessionKeepAlive, useClearSavedForm } from "@/lib/useSessionKeepAlive";


export default function CreateRoleJsonPage() {
    useRequireInstitution();
    useSessionKeepAlive();

    const router = useRouter();
    const { hasPermission, loading: workspaceLoading } = useWorkspace();
    const clearSavedForm = useClearSavedForm("role_creation_json");
    const canCreate = hasPermission("roles.create");

    useEffect(() => {
        if (workspaceLoading) return;
        if (!canCreate) {
            router.replace(ROUTES.company.recruitment.roles);
        }
    }, [workspaceLoading, canCreate, router]);

    const handleSubmit = async (formData: any) => {
        const roleId = await createRoleWithDna({
            fullForm: formData,
            title: formData.title || "Untitled Job Post Sheet"
        });

        if (!roleId) {
            throw new Error("Server did not return a job post sheet ID");
        }

        console.log("[FORM] ✓ Job post sheet created successfully:", roleId);
        clearSavedForm();
        router.push(rolePath(roleId));
    };

    if (workspaceLoading || !canCreate) {
        return (
            <div className="p-8 text-sm text-[var(--text-muted)]">
                Checking permissions…
            </div>
        );
    }

    return <RoleDnaForm onSubmit={handleSubmit} />;
}
