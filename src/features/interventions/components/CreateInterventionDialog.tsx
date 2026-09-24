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
import { equipmentKeys } from "@/features/equipment/equipment-api";
import {
  PRIORITY_OPTIONS,
  TYPE_OPTIONS,
  createInterventionSchema,
  type CreateInterventionInput,
  type CreateInterventionValues,
} from "../intervention-model";
import {
  assigneeOptionsQuery,
  createIntervention,
  equipmentOptionsQuery,
  interventionKeys,
} from "../intervention-api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pré-sélection quand on crée depuis la fiche d'un équipement. */
  equipmentId?: string;
  onCreated?: (id: string) => void;
};

const textareaClass =
  "mt-1.5 w-full px-3 py-2 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent";

export function CreateInterventionDialog({ open, onOpenChange, equipmentId, onCreated }: Props) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const equipment = useQuery({ ...equipmentOptionsQuery, enabled: open });
  const members = useQuery({ ...assigneeOptionsQuery, enabled: open });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateInterventionInput, unknown, CreateInterventionValues>({
    resolver: zodResolver(createInterventionSchema),
  });

  useEffect(() => {
    if (open) {
      reset({
        equipment_id: equipmentId ?? "",
        title: "",
        type: "corrective",
        priority: "normal",
        description: "",
        due_date: "",
        assigned_to: "",
        steps: "",
      });
      setFormError(null);
    }
  }, [open, equipmentId, reset]);

  const mutation = useMutation({
    mutationFn: createIntervention,
    onSuccess: async ({ id }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: interventionKeys.all }),
        queryClient.invalidateQueries({ queryKey: equipmentKeys.all }),
      ]);
      toast.success("Intervention créée");
      onOpenChange(false);
      onCreated?.(id);
    },
    onError: (e) => setFormError(e instanceof Error ? e.message : "Création impossible."),
  });

  const equipmentOptions = [
    { value: "", label: equipment.isPending ? "Chargement…" : "— Choisir un équipement —" },
    ...(equipment.data ?? []).map((e) => ({ value: e.id, label: `${e.code} · ${e.name}` })),
  ];
  const memberOptions = [
    { value: "", label: "— Non assignée —" },
    ...(members.data ?? []).map((m) => ({
      value: m.user_id,
      label: `${m.profile?.full_name || m.profile?.email || "Membre"}${m.role === "admin" ? " (admin)" : ""}`,
    })),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvelle intervention</DialogTitle>
          <DialogDescription>
            Le technicien assigné est notifié dans l'application.
          </DialogDescription>
        </DialogHeader>

        <form
          id="intervention-form"
          noValidate
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          <div className="sm:col-span-2">
            <FormSelect
              label="Équipement *"
              options={equipmentOptions}
              error={errors.equipment_id?.message}
              {...register("equipment_id")}
            />
          </div>
          <div className="sm:col-span-2">
            <FormField
              label="Titre *"
              placeholder="Inspection des roulements"
              error={errors.title?.message}
              {...register("title")}
            />
          </div>
          <FormSelect label="Type" options={TYPE_OPTIONS} {...register("type")} />
          <FormSelect label="Priorité" options={PRIORITY_OPTIONS} {...register("priority")} />
          <FormSelect label="Assignée à" options={memberOptions} {...register("assigned_to")} />
          <FormField label="Échéance" type="date" {...register("due_date")} />
          <label className="block sm:col-span-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Description
            </span>
            <textarea rows={3} className={textareaClass} {...register("description")} />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Checklist (une étape par ligne, facultatif)
            </span>
            <textarea
              rows={4}
              placeholder={"Consignation électrique\nContrôle visuel\nMesure des vibrations"}
              className={textareaClass}
              {...register("steps")}
            />
            {errors.steps && (
              <span className="mt-1 block text-xs text-critical">{errors.steps.message}</span>
            )}
          </label>
          <div className="sm:col-span-2">
            <FormError message={formError} />
          </div>
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
            form="intervention-form"
            disabled={mutation.isPending}
            className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-60"
          >
            {mutation.isPending ? "Création…" : "Créer l'intervention"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
