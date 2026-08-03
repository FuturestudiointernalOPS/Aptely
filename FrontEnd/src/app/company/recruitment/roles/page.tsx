import { getRolesServer } from "@/lib/apiServer";
import RolesClient from "./RolesClient";


export default async function RolesPage() {
  const roles = await getRolesServer();
  return <RolesClient initialRoles={roles} />;
}
