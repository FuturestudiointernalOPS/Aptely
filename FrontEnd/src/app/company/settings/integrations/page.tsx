"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/routes";

export default function IntegrationsRedirect() {
    const router = useRouter();
    useEffect(() => {
        router.replace(ROUTES.company.calendar);
    }, [router]);
    return null;
}
