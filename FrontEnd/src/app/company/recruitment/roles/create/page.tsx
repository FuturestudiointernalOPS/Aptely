"use client";
import { ROUTES, rolePath } from "@/lib/routes";

import Link from "next/link";
import RoleDnaForm from "@/components/RoleDnaForm";
import { createRoleWithDna } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useRequireInstitution } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { getClientLocale, t } from "@/lib/i18n";
import { EmptyState } from "@/components/ui/EmptyState";
import { useSessionKeepAlive, useClearSavedForm } from "@/lib/useSessionKeepAlive";


export default function CreateRoleJsonPage() {
    useRequireInstitution();
    useSessionKeepAlive();

    const router = useRouter();
    const locale = getClientLocale();
    const clearSavedForm = useClearSavedForm("role_creation_json");
    const { hasPermission, loading } = useWorkspace();

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

    if (loading) return null;

    // Without roles.create the backend refuses the submit, so don't let the user fill
    // a long form for nothing (e.g. STANDARD_HR reaching this page by URL).
    if (!hasPermission("roles.create")) {
        return (
            <EmptyState
                title={t(locale, "roles.create.forbiddenTitle", "Création non autorisée")}
                description={t(locale, "roles.create.forbiddenDesc", "Votre rôle ne permet pas de créer une fiche de poste. Demandez à un responsable RH ou à un administrateur.")}
                action={
                    <Link href={ROUTES.company.recruitment.roles} className="text-sm font-semibold text-[var(--accent)] hover:opacity-80">
                        {t(locale, "roles.create.backToList", "Retour aux fiches de poste")}
                    </Link>
                }
            />
        );
    }

    return <RoleDnaForm onSubmit={handleSubmit} />;
}
