import { getRolesServer } from "@/lib/apiServer";
import RolesClient from "./RolesClient";
import { RequireCompanyAccess } from "@/components/RequireCompanyAccess";


export default async function RolesPage() {
  const roles = await getRolesServer();
  return (
    <RequireCompanyAccess page="roles">
      <RolesClient initialRoles={roles} />
    </RequireCompanyAccess>
  );
}
