import { z } from "zod";
import type { Enums, Tables } from "@/integrations/supabase/types";

export type Equipment = Tables<"equipment">;
export type EquipmentStatus = Enums<"equipment_status">;

type BadgeVariant = "operational" | "critical" | "neutral";

/** Libellés et rendu visuel des statuts (source unique pour toute l'UI). */
export const EQUIPMENT_STATUS: Record<EquipmentStatus, { label: string; badge: BadgeVariant }> = {
  in_service: { label: "En service", badge: "operational" },
  broken_down: { label: "En panne", badge: "critical" },
  out_of_service: { label: "Hors service", badge: "neutral" },
};

export const EQUIPMENT_STATUS_OPTIONS = (Object.keys(EQUIPMENT_STATUS) as EquipmentStatus[]).map(
  (value) => ({ value, label: EQUIPMENT_STATUS[value].label }),
);

export const CRITICALITY_OPTIONS = [
  { value: "1", label: "1 · Faible" },
  { value: "2", label: "2 · Moyenne" },
  { value: "3", label: "3 · Haute" },
] as const;

// Mêmes bornes que les contraintes CHECK de public.equipment.
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères maximum`)
    .transform((v) => (v === "" ? null : v));

export const equipmentFormSchema = z.object({
  code: z.string().trim().min(1, "Code requis").max(50, "50 caractères maximum"),
  name: z.string().trim().min(1, "Nom requis").max(200, "200 caractères maximum"),
  category: optionalText(100),
  location: optionalText(200),
  status: z.enum(["in_service", "broken_down", "out_of_service"]),
  criticality: z.string().transform(Number).pipe(z.number().int().min(1).max(3)),
  commissioned_on: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v)),
});

export type EquipmentFormInput = z.input<typeof equipmentFormSchema>;
export type EquipmentFormValues = z.output<typeof equipmentFormSchema>;
