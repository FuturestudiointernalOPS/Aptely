import { redirect } from "next/navigation";

// Talents page hidden from the landing (nav/footer links removed) and its
// direct URL disabled — redirects to the homepage instead of serving content.
export default function TalentsPage() {
  redirect("/");
}
