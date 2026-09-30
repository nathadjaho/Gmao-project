import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { KeyRound, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { FormError, FormField } from "@/components/FormField";
import { useAuth } from "@/features/auth/use-auth";
import { authContextQuery, changePassword, updateFullName } from "@/features/auth/auth-api";
import {
  changePasswordSchema,
  profileNameSchema,
  type ChangePasswordInput,
  type ProfileNameInput,
} from "@/features/auth/auth-schemas";
import { ROLE_LABELS } from "@/features/auth/roles";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({ meta: [{ title: "Mon profil — ForgeOS GMAO" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [nameError, setNameError] = useState<string | null>(null);
  const [pwdError, setPwdError] = useState<string | null>(null);

  const router = useRouter();

  // Après une modification, on RECHARGE le contexte d'auth (nom affiché, drapeau « à changer »),
  // puis on invalide le routeur pour que la garde de _app relise ce contexte à jour.
  // (refetch plutôt qu'invalidate : la garde lit le cache via ensureQueryData.)
  const reloadAuth = async () => {
    await queryClient.refetchQueries({ queryKey: authContextQuery.queryKey });
    await router.invalidate();
  };

  const nameForm = useForm<ProfileNameInput>({
    resolver: zodResolver(profileNameSchema),
    defaultValues: { fullName: auth.fullName },
  });
  const pwdForm = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { current: "", next: "", confirm: "" },
  });

  const nameMutation = useMutation({
    mutationFn: (v: ProfileNameInput) => updateFullName(auth.userId, v.fullName),
    onSuccess: async () => {
      await reloadAuth();
      toast.success("Nom mis à jour");
    },
    onError: (e) => setNameError(e.message),
  });

  const pwdMutation = useMutation({
    mutationFn: (v: ChangePasswordInput) => changePassword(auth.email, v.current, v.next),
    onSuccess: async () => {
      pwdForm.reset();
      const wasForced = auth.mustChangePassword;
      await reloadAuth();
      toast.success("Mot de passe modifié");
      if (wasForced) navigate({ to: "/dashboard" });
    },
    onError: (e) => setPwdError(e.message),
  });

  return (
    <div className="p-6 md:p-8 max-w-[760px] mx-auto">
      <PageHeader
        eyebrow={`${ROLE_LABELS[auth.membership.role]} · ${auth.membership.organization.name}`}
        title="Mon profil"
        description={auth.email}
      />

      {auth.mustChangePassword && (
        <div
          className="mb-6 rounded-xl border border-warning/40 bg-warning/10 p-4 flex gap-3"
          role="alert"
        >
          <ShieldAlert className="size-5 text-warning shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-semibold">Choisissez votre propre mot de passe</div>
            <p className="text-muted-foreground mt-0.5">
              Votre compte a été créé avec un mot de passe provisoire, connu de l'administrateur.
              Remplacez-le pour accéder à l'application.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <form
          noValidate
          onSubmit={nameForm.handleSubmit((v) => {
            setNameError(null);
            nameMutation.mutate(v);
          })}
          className="rounded-xl border border-border bg-card shadow-card p-5 space-y-4"
        >
          <div className="text-sm font-bold">Identité</div>
          <FormField
            label="Nom complet"
            autoComplete="name"
            error={nameForm.formState.errors.fullName?.message}
            {...nameForm.register("fullName")}
          />
          <FormError message={nameError} />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={nameMutation.isPending || !nameForm.formState.isDirty}
              className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50"
            >
              {nameMutation.isPending ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>

        <form
          noValidate
          onSubmit={pwdForm.handleSubmit((v) => {
            setPwdError(null);
            pwdMutation.mutate(v);
          })}
          className="rounded-xl border border-border bg-card shadow-card p-5 space-y-4"
        >
          <div className="text-sm font-bold flex items-center gap-2">
            <KeyRound className="size-4 text-muted-foreground" /> Mot de passe
          </div>
          <FormField
            label={auth.mustChangePassword ? "Mot de passe provisoire" : "Mot de passe actuel"}
            type="password"
            autoComplete="current-password"
            error={pwdForm.formState.errors.current?.message}
            {...pwdForm.register("current")}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label="Nouveau mot de passe"
              type="password"
              autoComplete="new-password"
              error={pwdForm.formState.errors.next?.message}
              {...pwdForm.register("next")}
            />
            <FormField
              label="Confirmer"
              type="password"
              autoComplete="new-password"
              error={pwdForm.formState.errors.confirm?.message}
              {...pwdForm.register("confirm")}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            10 caractères minimum, avec une minuscule, une majuscule et un chiffre.
          </p>
          <FormError message={pwdError} />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={pwdMutation.isPending}
              className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-60"
            >
              {pwdMutation.isPending ? "Modification…" : "Changer le mot de passe"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
