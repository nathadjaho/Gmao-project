import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormError, FormField, FormSelect } from "@/components/FormField";
import {
  createMember,
  createMemberSchema,
  generatePassword,
  teamKeys,
  type CreateMemberInput,
} from "../team-api";

const ROLE_OPTIONS = [
  { value: "technician", label: "Technicien" },
  { value: "admin", label: "Administrateur" },
] as const;

export function CreateMemberDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateMemberInput | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CreateMemberInput>({ resolver: zodResolver(createMemberSchema) });

  useEffect(() => {
    if (open) {
      reset({ fullName: "", email: "", password: generatePassword(), role: "technician" });
      setFormError(null);
      setCreated(null);
    }
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: createMember,
    onSuccess: async (_, input) => {
      await queryClient.invalidateQueries({ queryKey: teamKeys.all });
      setCreated(input);
    },
    onError: (e) => setFormError(e instanceof Error ? e.message : "Création impossible."),
  });

  const credentials = created
    ? `Email : ${created.email}\nMot de passe provisoire : ${created.password}`
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>Compte créé</DialogTitle>
              <DialogDescription>
                Transmettez ces identifiants à {created.fullName}. Le mot de passe ne sera plus
                affiché.
              </DialogDescription>
            </DialogHeader>
            <pre className="rounded-md bg-secondary px-3 py-3 text-xs font-mono whitespace-pre-wrap">
              {credentials}
            </pre>
            <DialogFooter>
              <button
                type="button"
                onClick={() =>
                  navigator.clipboard.writeText(credentials).then(() => toast.success("Copié"))
                }
                className="h-9 px-3 rounded-md border border-border bg-card text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-secondary"
              >
                <Copy className="size-3.5" /> Copier
              </button>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90"
              >
                Terminé
              </button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Ajouter un membre</DialogTitle>
              <DialogDescription>
                Le compte est créé immédiatement, sans email. Vous transmettrez le mot de passe
                provisoire.
              </DialogDescription>
            </DialogHeader>
            <form
              id="member-form"
              noValidate
              onSubmit={handleSubmit((v) => mutation.mutate(v))}
              className="space-y-4"
            >
              <FormField
                label="Nom complet"
                error={errors.fullName?.message}
                {...register("fullName")}
              />
              <FormField
                label="Email"
                type="email"
                error={errors.email?.message}
                {...register("email")}
              />
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <FormField
                    label="Mot de passe provisoire"
                    error={errors.password?.message}
                    {...register("password")}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setValue("password", generatePassword())}
                  className="h-11 px-3 rounded-md border border-border bg-card text-xs font-semibold hover:bg-secondary"
                >
                  Générer
                </button>
              </div>
              <FormSelect label="Rôle" options={ROLE_OPTIONS} {...register("role")} />
              <FormError message={formError} />
            </form>
            <DialogFooter>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="h-9 px-3 rounded-md border border-border bg-card text-xs font-semibold hover:bg-secondary"
              >
                Annuler
              </button>
              <button
                type="submit"
                form="member-form"
                disabled={mutation.isPending}
                className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-60"
              >
                {mutation.isPending ? "Création…" : "Créer le compte"}
              </button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
