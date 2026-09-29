import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormError, FormField } from "@/components/FormField";
import { useAuth } from "@/features/auth/use-auth";
import { dashboardKeys } from "@/features/dashboard/dashboard-api";
import {
  newVersionSchema,
  validateFile,
  type NewVersionInput,
  type NewVersionValues,
} from "../document-model";
import { addVersion, documentKeys } from "../document-api";
import { FilePicker } from "./FilePicker";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  nextVersion: number;
};

export function NewVersionDialog({ open, onOpenChange, documentId, nextVersion }: Props) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | undefined>();
  const [fileError, setFileError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NewVersionInput, unknown, NewVersionValues>({
    resolver: zodResolver(newVersionSchema),
  });

  useEffect(() => {
    if (!open) return;
    reset({ comment: "", expires_on: "" });
    setFile(undefined);
    setFileError(null);
    setFormError(null);
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (v: NewVersionValues) =>
      addVersion(auth.membership.organization.id, documentId, file as File, v),
    onSuccess: async (n) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: documentKeys.all }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
      ]);
      toast.success(`Version ${n} publiée`);
      onOpenChange(false);
    },
    onError: (e) => setFormError(e instanceof Error ? e.message : "Publication impossible."),
  });

  const submit = (e: React.FormEvent) => {
    const fileErr = validateFile(file);
    setFileError(fileErr);
    return handleSubmit((v) => {
      if (fileErr) return;
      setFormError(null);
      mutation.mutate(v);
    })(e);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Publier la version {nextVersion}</DialogTitle>
          <DialogDescription>
            Les versions précédentes restent consultables dans l'historique et peuvent être
            restaurées.
          </DialogDescription>
        </DialogHeader>
        <form id="version-form" noValidate onSubmit={submit} className="space-y-4">
          <FilePicker
            file={file}
            onChange={(f) => {
              setFile(f);
              setFileError(f ? validateFile(f) : null);
            }}
            error={fileError}
          />
          <FormField
            label="Qu'est-ce qui change ?"
            placeholder="Mise à jour suite à la révision 2026"
            error={errors.comment?.message}
            {...register("comment")}
          />
          <FormField
            label="Nouvelle date d'expiration (facultatif)"
            type="date"
            error={errors.expires_on?.message}
            {...register("expires_on")}
          />
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
            form="version-form"
            disabled={mutation.isPending}
            className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-60"
          >
            {mutation.isPending ? "Envoi…" : "Publier"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
