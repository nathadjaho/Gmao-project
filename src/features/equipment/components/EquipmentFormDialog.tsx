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
import { FormError, FormField, FormSelect } from "@/components/FormField";
import {
  CRITICALITY_OPTIONS,
  EQUIPMENT_STATUS_OPTIONS,
  equipmentFormSchema,
  type Equipment,
  type EquipmentFormInput,
  type EquipmentFormValues,
} from "../equipment-model";
import { createEquipment, equipmentKeys, updateEquipment } from "../equipment-api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Absent = création ; présent = modification. */
  equipment?: Equipment;
  onCreated?: (id: string) => void;
};

function toFormInput(e?: Equipment): EquipmentFormInput {
  return {
    code: e?.code ?? "",
    name: e?.name ?? "",
    category: e?.category ?? "",
    location: e?.location ?? "",
    status: e?.status ?? "in_service",
    criticality: String(e?.criticality ?? 2),
    commissioned_on: e?.commissioned_on ?? "",
  };
}

export function EquipmentFormDialog({ open, onOpenChange, equipment, onCreated }: Props) {
  const isEdit = Boolean(equipment);
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EquipmentFormInput, unknown, EquipmentFormValues>({
    resolver: zodResolver(equipmentFormSchema),
    defaultValues: toFormInput(equipment),
  });

  useEffect(() => {
    if (open) {
      reset(toFormInput(equipment));
      setFormError(null);
    }
  }, [open, equipment, reset]);

  const mutation = useMutation({
    mutationFn: (values: EquipmentFormValues) =>
      equipment
        ? updateEquipment(equipment.id, values).then(() => ({ id: equipment.id }))
        : createEquipment(values),
    onSuccess: async ({ id }) => {
      // Invalide toutes les listes et la fiche : React Query rechargera ce qui est affiché.
      await queryClient.invalidateQueries({ queryKey: equipmentKeys.all });
      toast.success(isEdit ? "Équipement mis à jour" : "Équipement créé");
      onOpenChange(false);
      if (!isEdit) onCreated?.(id);
    },
    onError: (e) => setFormError(e instanceof Error ? e.message : "Enregistrement impossible."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier l'équipement" : "Ajouter un équipement"}</DialogTitle>
          <DialogDescription>Les champs marqués * sont obligatoires.</DialogDescription>
        </DialogHeader>

        <form
          id="equipment-form"
          noValidate
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          <FormField
            label="Code *"
            placeholder="TR-4410"
            error={errors.code?.message}
            {...register("code")}
          />
          <FormField
            label="Nom *"
            placeholder="Turbine génératrice B"
            error={errors.name?.message}
            {...register("name")}
          />
          <FormField
            label="Catégorie"
            placeholder="Turbine"
            error={errors.category?.message}
            {...register("category")}
          />
          <FormField
            label="Localisation"
            placeholder="Hall turbines · Bay 4"
            error={errors.location?.message}
            {...register("location")}
          />
          <FormSelect label="Statut" options={EQUIPMENT_STATUS_OPTIONS} {...register("status")} />
          <FormSelect
            label="Criticité"
            options={CRITICALITY_OPTIONS}
            {...register("criticality")}
          />
          <FormField
            label="Mise en service"
            type="date"
            error={errors.commissioned_on?.message}
            {...register("commissioned_on")}
          />
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
            form="equipment-form"
            disabled={mutation.isPending}
            className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-60"
          >
            {mutation.isPending ? "Enregistrement…" : isEdit ? "Enregistrer" : "Créer"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
