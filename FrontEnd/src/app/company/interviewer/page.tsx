"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/routes";

export default function InterviewerRedirect() {
    const router = useRouter();
    useEffect(() => {
        router.replace(ROUTES.company.recruitment.interviews);
    }, [router]);
    return null;
}
