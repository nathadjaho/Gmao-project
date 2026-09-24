import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { passwordSchema } from "@/features/auth/auth-schemas";
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
  password: passwordSchema,
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

const LOWER = "abcdefghijkmnpqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";

function randomInt(max: number): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] % max;
}

/**
 * Mot de passe provisoire lisible (sans caractères ambigus 0/O, 1/l/I).
 * Garantit au moins une minuscule, une majuscule et un chiffre (exigence de passwordSchema),
 * puis mélange (Fisher-Yates) pour que ces caractères ne soient pas toujours en tête.
 */
export function generatePassword(length = 12): string {
  const all = LOWER + UPPER + DIGITS;
  const chars = [LOWER, UPPER, DIGITS].map((set) => set[randomInt(set.length)]);
  while (chars.length < length) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
