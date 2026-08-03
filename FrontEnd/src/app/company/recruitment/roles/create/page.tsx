"use client";
import { rolePath } from "@/lib/routes";

import RoleDnaForm from "@/components/RoleDnaForm";
import { createRoleWithDna } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useRequireInstitution } from "@/lib/auth";
import { useSessionKeepAlive, useClearSavedForm } from "@/lib/useSessionKeepAlive";


export default function CreateRoleJsonPage() {
    useRequireInstitution();
    useSessionKeepAlive();

    const router = useRouter();
    const clearSavedForm = useClearSavedForm("role_creation_json");

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

    return <RoleDnaForm onSubmit={handleSubmit} />;
}
