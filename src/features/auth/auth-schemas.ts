import { z } from "zod";

// Validation côté client = confort (messages immédiats).
// La vraie barrière reste côté serveur : Supabase Auth + contraintes CHECK en base.

const email = z.string().trim().min(1, "Email requis").email("Email invalide");

// Aligné sur les réglages Supabase Auth (Sign In / Providers → Email) :
// 10 caractères minimum, au moins une minuscule, une majuscule et un chiffre.
// 72 = limite de bcrypt. Si on change ces réglages dans Supabase, changer ici aussi.
export const passwordSchema = z
  .string()
  .min(10, "10 caractères minimum")
  .max(72, "72 caractères maximum")
  .regex(/[a-z]/, "Au moins une minuscule")
  .regex(/[A-Z]/, "Au moins une majuscule")
  .regex(/[0-9]/, "Au moins un chiffre");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Mot de passe requis"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  fullName: z.string().trim().min(2, "2 caractères minimum").max(100, "100 caractères maximum"),
  email,
  password: passwordSchema,
});
export type SignupInput = z.infer<typeof signupSchema>;

// Mêmes bornes que la contrainte CHECK de public.organizations.name.
export const organizationSchema = z.object({
  name: z.string().trim().min(2, "2 caractères minimum").max(120, "120 caractères maximum"),
});
export type OrganizationInput = z.infer<typeof organizationSchema>;
