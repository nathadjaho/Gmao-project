import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Building2 } from "lucide-react";
import { useState } from "react";
import { AuthLayout, AuthPending } from "@/features/auth/components/AuthLayout";
import { FormError, FormField } from "@/features/auth/components/FormField";
import { organizationSchema, type OrganizationInput } from "@/features/auth/auth-schemas";
import { authContextQuery, createOrganization } from "@/features/auth/auth-api";

// Étape 2 : un utilisateur connecté mais sans organisation crée la sienne (il en devient admin).
export const Route = createFileRoute("/onboarding")({
  ssr: false,
  beforeLoad: async ({ context, location }) => {
    const auth = await context.queryClient.ensureQueryData(authContextQuery);
    if (!auth) throw redirect({ to: "/", search: { redirect: location.href } });
    if (auth.membership) throw redirect({ to: "/dashboard" });
  },
  head: () => ({ meta: [{ title: "Votre organisation — ForgeOS GMAO" }] }),
  pendingComponent: AuthPending,
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OrganizationInput>({ resolver: zodResolver(organizationSchema) });

  async function onSubmit({ name }: OrganizationInput) {
    setFormError(null);
    try {
      await createOrganization(name);
      await queryClient.invalidateQueries({ queryKey: authContextQuery.queryKey });
      navigate({ to: "/dashboard" });
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Création impossible.");
    }
  }

  return (
    <AuthLayout>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="w-full max-w-sm space-y-7">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2">
            Étape 2 sur 2
          </div>
          <div className="flex items-center gap-2">
            <Building2 className="size-5 text-accent" />
            <h1 className="text-2xl font-bold tracking-tight">Votre organisation</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Toutes vos données (équipements, interventions, documents) seront isolées dans cet
            espace.
          </p>
        </div>

        <div className="space-y-4">
          <FormField
            label="Nom de l'entreprise"
            autoComplete="organization"
            error={errors.name?.message}
            {...register("name")}
          />
          <FormError message={formError} />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="group w-full h-11 rounded-md bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {isSubmitting ? "Création…" : "Créer l'espace"}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </form>
    </AuthLayout>
  );
}
