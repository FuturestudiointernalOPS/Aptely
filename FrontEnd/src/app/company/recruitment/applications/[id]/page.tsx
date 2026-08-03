"use client";

import { useParams } from "next/navigation";
import { ApplicationPanel } from "@/components/ApplicationPanel";

export default function ApplicationDetailPage() {
    const { id } = useParams<{ id: string }>();
    return <ApplicationPanel appId={id} fullPage />;
}
