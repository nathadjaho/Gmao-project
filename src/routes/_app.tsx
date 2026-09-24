import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { AuthPending } from "@/features/auth/components/AuthLayout";
import { authContextQuery } from "@/features/auth/auth-api";

// Garde de toutes les pages de l'application (/dashboard, /equipment, …).
// Rôle : UX (rediriger au bon endroit). La sécurité des données, elle, est assurée par la RLS.
export const Route = createFileRoute("/_app")({
  ssr: false,
  beforeLoad: async ({ context, location }) => {
    const auth = await context.queryClient.ensureQueryData(authContextQuery);
    if (!auth) throw redirect({ to: "/", search: { redirect: location.href } });
    if (!auth.membership) throw redirect({ to: "/onboarding" });
    // Exposé aux routes enfants via useRouteContext : membership est garanti non nul ici.
    return { auth: { ...auth, membership: auth.membership } };
  },
  pendingComponent: AuthPending,
  component: AppShell,
});
