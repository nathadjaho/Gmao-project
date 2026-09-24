import { queryOptions, type QueryClient } from "@tanstack/react-query";
import type { AuthError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "./roles";
import type { LoginInput, SignupInput } from "./auth-schemas";

export type Membership = {
  role: AppRole;
  organization: { id: string; name: string };
};

export type AuthContext = {
  userId: string;
  email: string;
  fullName: string;
  membership: Membership | null;
};

/**
 * Qui est connecté, et dans quelle organisation ?
 *
 * getSession() lit le jeton stocké localement sans le revérifier : suffisant pour
 * décider quoi AFFICHER. La sécurité des DONNÉES ne dépend pas de ce code : chaque
 * requête envoie le JWT, que Supabase vérifie avant d'appliquer la RLS.
 */
async function fetchAuthContext(): Promise<AuthContext | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const { user } = session;
  const [membershipRes, profileRes] = await Promise.all([
    supabase
      .from("memberships")
      .select("role, organization:organizations(id, name)")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);
  if (membershipRes.error) throw membershipRes.error;
  if (profileRes.error) throw profileRes.error;

  const m = membershipRes.data;
  return {
    userId: user.id,
    email: user.email ?? "",
    fullName: profileRes.data?.full_name ?? "",
    membership: m?.organization ? { role: m.role, organization: m.organization } : null,
  };
}

// Mis en cache par React Query : les gardes de route ne refont pas 2 requêtes à chaque navigation.
export const authContextQuery = queryOptions({
  queryKey: ["auth", "context"],
  queryFn: fetchAuthContext,
  staleTime: 5 * 60 * 1000,
});

export async function signIn({ email, password }: LoginInput) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(translateAuthError(error));
}

/** Renvoie `needsEmailConfirmation: true` si Supabase exige la confirmation de l'email. */
export async function signUp({ fullName, email, password }: SignupInput) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName }, // lu par le trigger handle_new_user → profiles.full_name
      emailRedirectTo: `${window.location.origin}/onboarding`,
    },
  });
  if (error) throw new Error(translateAuthError(error));
  return { needsEmailConfirmation: !data.session };
}

export async function createOrganization(name: string) {
  const { error } = await supabase.rpc("create_organization", { org_name: name });
  if (error) throw new Error(error.message);
}

export async function signOut(queryClient: QueryClient) {
  await supabase.auth.signOut();
  // Vide tout le cache : aucune donnée de l'utilisateur précédent ne doit survivre.
  queryClient.clear();
}

/** Les pages qui redirigent après login n'acceptent qu'un chemin interne (anti open-redirect). */
export function safeRedirectPath(value: unknown): string | undefined {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : undefined;
}

function translateAuthError(error: AuthError): string {
  switch (error.code) {
    case "invalid_credentials":
      return "Email ou mot de passe incorrect.";
    case "email_not_confirmed":
      return "Confirmez votre adresse email (lien reçu par mail) avant de vous connecter.";
    case "user_already_exists":
    case "email_exists":
      return "Un compte existe déjà avec cet email.";
    case "weak_password":
      return "Mot de passe trop faible.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Trop de tentatives. Réessayez dans quelques minutes.";
    default:
      return error.message;
  }
}
