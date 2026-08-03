"use server";

import { revalidatePath } from "next/cache";
import { updateRoleStatusServer } from "@/lib/apiServer";

export async function publishRoleAction(roleId: string): Promise<boolean> {
  const result = await updateRoleStatusServer(roleId, "ACTIVE");
  revalidatePath("/roles");
  return !!result;
}

export async function stopRoleAction(roleId: string): Promise<boolean> {
  const result = await updateRoleStatusServer(roleId, "CLOSED");
  revalidatePath("/roles");
  return !!result;
}

export async function cancelRoleAction(roleId: string): Promise<boolean> {
  const result = await updateRoleStatusServer(roleId, "CANCELLED");
  revalidatePath("/roles");
  return !!result;
}

export async function deleteRoleAction(roleId: string): Promise<boolean> {
  const { deleteRoleServer } = await import("@/lib/apiServer");
  const result = await deleteRoleServer(roleId);
  revalidatePath("/roles");
  return !!result;
}
