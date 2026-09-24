import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Lock } from "lucide-react";
import { useState } from "react";
import { AuthLayout, AuthPending } from "@/features/auth/components/AuthLayout";
import { FormError, FormField } from "@/components/FormField";
import { loginSchema, type LoginInput } from "@/features/auth/auth-schemas";
import { authContextQuery, safeRedirectPath, signIn } from "@/features/auth/auth-api";

export const Route = createFileRoute("/")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: safeRedirectPath(search.redirect),
  }),
  beforeLoad: async ({ context }) => {
    const auth = await context.queryClient.ensureQueryData(authContextQuery);
    if (auth) throw redirect({ to: auth.membership ? "/dashboard" : "/onboarding" });
  },
  head: () => ({
    meta: [
      { title: "Connexion — ForgeOS GMAO" },
      {
        name: "description",
        content: "Accès à la plateforme de gestion de maintenance assistée par ordinateur.",
      },
    ],
  }),
  pendingComponent: AuthPending,
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { redirect: redirectTo } = Route.useSearch();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setFormError(null);
    try {
      await signIn(values);
      await queryClient.invalidateQueries({ queryKey: authContextQuery.queryKey });
      navigate({ to: redirectTo ?? "/dashboard" });
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Connexion impossible.");
    }
  }

  return (
    <AuthLayout>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="w-full max-w-sm space-y-7">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2">
            Identification
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Connexion à votre espace</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Renseignez vos identifiants pour accéder à la plateforme.
          </p>
        </div>

        <div className="space-y-4">
          <FormField
            label="Email"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register("email")}
          />
          <FormField
            label="Mot de passe"
            type="password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register("password")}
          />
          <FormError message={formError} />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="group w-full h-11 rounded-md bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {isSubmitting ? "Authentification…" : "Accéder à la plateforme"}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </button>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground border-t border-border pt-5">
          <Lock className="size-3.5 text-accent" />
          Connexion chiffrée (HTTPS).
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Pas encore de compte ?{" "}
          <Link to="/signup" className="font-semibold text-accent hover:underline">
            Créer un espace
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
