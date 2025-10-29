import { apiFetch } from "@lib/api/client";

export type AdminPlatform = {
  id: string;
  name: string;
  slug: string;
  shortName: string | null;
};

export async function listAdminPlatforms(): Promise<{ platforms: AdminPlatform[] }> {
  return apiFetch<{ platforms: AdminPlatform[] }>("/admin/platforms", {
    method: "GET"
  });
}
