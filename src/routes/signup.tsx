import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, MailCheck } from "lucide-react";
import { useState } from "react";
import { AuthLayout, AuthPending } from "@/features/auth/components/AuthLayout";
import { FormError, FormField } from "@/features/auth/components/FormField";
import { signupSchema, type SignupInput } from "@/features/auth/auth-schemas";
import { authContextQuery, signUp } from "@/features/auth/auth-api";

export const Route = createFileRoute("/signup")({
  ssr: false,
  beforeLoad: async ({ context }) => {
    const auth = await context.queryClient.ensureQueryData(authContextQuery);
    if (auth) throw redirect({ to: auth.membership ? "/dashboard" : "/onboarding" });
  },
  head: () => ({ meta: [{ title: "Créer un compte — ForgeOS GMAO" }] }),
  pendingComponent: AuthPending,
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({ resolver: zodResolver(signupSchema) });

  async function onSubmit(values: SignupInput) {
    setFormError(null);
    try {
      const { needsEmailConfirmation } = await signUp(values);
      if (needsEmailConfirmation) {
        setSentTo(values.email);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: authContextQuery.queryKey });
      navigate({ to: "/onboarding" });
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Inscription impossible.");
    }
  }

  if (sentTo) {
    return (
      <AuthLayout>
        <div className="w-full max-w-sm space-y-4 text-center">
          <MailCheck className="size-10 mx-auto text-accent" />
          <h1 className="text-2xl font-bold tracking-tight">Vérifiez votre boîte mail</h1>
          <p className="text-sm text-muted-foreground">
            Un lien de confirmation a été envoyé à{" "}
            <span className="font-semibold text-foreground">{sentTo}</span>. Cliquez dessus pour
            activer votre compte et créer votre organisation.
          </p>
          <Link to="/" className="inline-block text-xs font-semibold text-accent hover:underline">
            Retour à la connexion
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="w-full max-w-sm space-y-7">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2">
            Étape 1 sur 2
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Créer votre compte</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vous deviendrez administrateur de l'espace de votre entreprise.
          </p>
        </div>

        <div className="space-y-4">
          <FormField
            label="Nom complet"
            autoComplete="name"
            error={errors.fullName?.message}
            {...register("fullName")}
          />
          <FormField
            label="Email professionnel"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register("email")}
          />
          <FormField
            label="Mot de passe (8 caractères min.)"
            type="password"
            autoComplete="new-password"
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
          {isSubmitting ? "Création…" : "Créer mon compte"}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </button>

        <p className="text-center text-xs text-muted-foreground">
          Déjà un compte ?{" "}
          <Link to="/" className="font-semibold text-accent hover:underline">
            Se connecter
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
