import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/features/auth/roles";

export const teamKeys = { all: ["team"] as const };

/** Membres de l'organisation (actifs et désactivés), avec leur profil, en une requête. */
export const teamQuery = queryOptions({
  queryKey: teamKeys.all,
  queryFn: async () => {
    const { data, error } = await supabase
      .from("memberships")
      .select("user_id, role, deleted_at, created_at, profile:profiles(full_name, email)")
      .order("created_at");
    if (error) throw error;
    return data;
  },
});

export type TeamMember = Awaited<ReturnType<NonNullable<typeof teamQuery.queryFn>>>[number];

export const createMemberSchema = z.object({
  fullName: z.string().trim().min(2, "2 caractères minimum").max(100, "100 caractères maximum"),
  email: z.string().trim().toLowerCase().email("Email invalide"),
  password: z.string().min(8, "8 caractères minimum").max(72, "72 caractères maximum"),
  role: z.enum(["technician", "admin"]),
});
export type CreateMemberInput = z.infer<typeof createMemberSchema>;

/** Appelle l'Edge Function create-member : la création de compte exige la clé secrète, côté serveur. */
export async function createMember(input: CreateMemberInput) {
  const { data, error } = await supabase.functions.invoke("create-member", {
    body: {
      email: input.email,
      full_name: input.fullName,
      password: input.password,
      role: input.role,
    },
  });
  if (error) {
    // L'Edge Function renvoie { error: "message lisible" } : on le remonte tel quel.
    const ctx = (error as { context?: Response }).context;
    const body = ctx ? await ctx.json().catch(() => null) : null;
    throw new Error(body?.error ?? error.message);
  }
  return data as { user_id: string };
}

export async function updateMemberRole(userId: string, role: AppRole) {
  const { error } = await supabase.from("memberships").update({ role }).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function setMemberActive(userId: string, active: boolean) {
  const { error } = await supabase
    .from("memberships")
    .update({ deleted_at: active ? null : new Date().toISOString() })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

/** Mot de passe provisoire lisible (sans caractères ambigus 0/O, 1/l/I). */
export function generatePassword(length = 12): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(values, (v) => chars[v % chars.length]).join("");
}
