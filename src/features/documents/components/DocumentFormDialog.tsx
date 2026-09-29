import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormError, FormField, FormSelect } from "@/components/FormField";
import { useAuth } from "@/features/auth/use-auth";
import { dashboardKeys } from "@/features/dashboard/dashboard-api";
import {
  defaultDocumentName,
  documentMetaSchema,
  validateFile,
  type DocumentMetaInput,
  type DocumentMetaValues,
} from "../document-model";
import { categoriesQuery, createDocument, documentKeys, updateDocument } from "../document-api";
import { FilePicker } from "./FilePicker";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Présent = modification des métadonnées (pas de fichier). Absent = nouvel envoi. */
  document?: { id: string; name: string; category_id: string; expires_on: string | null };
  /** Lien automatique quand on ajoute depuis une fiche équipement ou intervention. */
  link?: { equipmentId?: string; interventionId?: string };
  onCreated?: (id: string) => void;
};

export function DocumentFormDialog({ open, onOpenChange, document, link, onCreated }: Props) {
  const isEdit = Boolean(document);
  const auth = useAuth();
  const queryClient = useQueryClient();
  const categories = useQuery({ ...categoriesQuery, enabled: open });
  const [file, setFile] = useState<File | undefined>();
  const [fileError, setFileError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<DocumentMetaInput, unknown, DocumentMetaValues>({
    resolver: zodResolver(documentMetaSchema),
  });

  useEffect(() => {
    if (!open) return;
    reset({
      name: document?.name ?? "",
      category_id: document?.category_id ?? "",
      expires_on: document?.expires_on ?? "",
    });
    setFile(undefined);
    setFileError(null);
    setFormError(null);
  }, [open, document, reset]);

  const mutation = useMutation({
    mutationFn: async (values: DocumentMetaValues) => {
      if (isEdit && document) {
        await updateDocument(document.id, values);
        return document.id;
      }
      return createDocument(auth.membership.organization.id, file as File, values, link);
    },
    onSuccess: async (id) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: documentKeys.all }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
      ]);
      toast.success(isEdit ? "Document mis à jour" : "Document ajouté");
      onOpenChange(false);
      if (!isEdit) onCreated?.(id);
    },
    onError: (e) => setFormError(e instanceof Error ? e.message : "Enregistrement impossible."),
  });

  function onFile(f: File | undefined) {
    setFile(f);
    setFileError(f ? validateFile(f) : null);
    // Pré-remplit le nom si l'utilisateur ne l'a pas encore saisi.
    if (f && !getValues("name"))
      setValue("name", defaultDocumentName(f.name), { shouldValidate: true });
  }

  // Le fichier est contrôlé en même temps que les champs : toutes les erreurs s'affichent d'un coup.
  const submit = (e: React.FormEvent) => {
    const fileErr = isEdit ? null : validateFile(file);
    setFileError(fileErr);
    return handleSubmit((values) => {
      if (fileErr) return;
      setFormError(null);
      mutation.mutate(values);
    })(e);
  };

  const categoryOptions = [
    { value: "", label: categories.isPending ? "Chargement…" : "— Choisir —" },
    ...(categories.data ?? []).map((c) => ({ value: c.id, label: c.name })),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier le document" : "Ajouter un document"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Nom, catégorie et échéance. Pour changer le fichier, publiez une nouvelle version."
              : "Le fichier est stocké de façon privée dans votre organisation."}
          </DialogDescription>
        </DialogHeader>

        <form id="document-form" noValidate onSubmit={submit} className="space-y-4">
          {!isEdit && <FilePicker file={file} onChange={onFile} error={fileError} />}
          <FormField label="Nom *" error={errors.name?.message} {...register("name")} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormSelect
              label="Catégorie *"
              options={categoryOptions}
              error={errors.category_id?.message}
              {...register("category_id")}
            />
            <FormField
              label="Date d'expiration"
              type="date"
              error={errors.expires_on?.message}
              {...register("expires_on")}
            />
          </div>
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
            form="document-form"
            disabled={mutation.isPending}
            className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-60"
          >
            {mutation.isPending
              ? isEdit
                ? "Enregistrement…"
                : "Envoi…"
              : isEdit
                ? "Enregistrer"
                : "Ajouter"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
