import { z } from "zod";

// Validation côté client = confort (messages immédiats).
// La vraie barrière reste côté serveur : Supabase Auth + contraintes CHECK en base.

const email = z.string().trim().min(1, "Email requis").email("Email invalide");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Mot de passe requis"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  fullName: z.string().trim().min(2, "2 caractères minimum").max(100, "100 caractères maximum"),
  email,
  password: z.string().min(8, "8 caractères minimum").max(72, "72 caractères maximum"),
});
export type SignupInput = z.infer<typeof signupSchema>;

// Mêmes bornes que la contrainte CHECK de public.organizations.name.
export const organizationSchema = z.object({
  name: z.string().trim().min(2, "2 caractères minimum").max(120, "120 caractères maximum"),
});
export type OrganizationInput = z.infer<typeof organizationSchema>;
