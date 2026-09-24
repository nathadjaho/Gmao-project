import { z } from "zod";
import type { Enums } from "@/integrations/supabase/types";

export type InterventionStatus = Enums<"intervention_status">;

type BadgeVariant = "pending" | "warning" | "completed" | "operational" | "neutral";

export const INTERVENTION_STATUS: Record<
  InterventionStatus,
  { label: string; badge: BadgeVariant }
> = {
  todo: { label: "À faire", badge: "pending" },
  in_progress: { label: "En cours", badge: "warning" },
  submitted: { label: "Soumis · à valider", badge: "completed" },
  done: { label: "Terminé", badge: "operational" },
  cancelled: { label: "Annulé", badge: "neutral" },
};

export const INTERVENTION_TYPE_LABELS: Record<Enums<"intervention_type">, string> = {
  corrective: "Correctif",
  preventive: "Préventif",
};

export type InterventionPriority = Enums<"intervention_priority">;

export const PRIORITY_LABELS: Record<InterventionPriority, string> = {
  low: "Basse",
  normal: "Normale",
  high: "Haute",
  urgent: "Urgente",
};

export const PRIORITY_OPTIONS = (Object.keys(PRIORITY_LABELS) as InterventionPriority[]).map(
  (value) => ({
    value,
    label: PRIORITY_LABELS[value],
  }),
);

export const TYPE_OPTIONS = [
  { value: "corrective", label: "Correctif" },
  { value: "preventive", label: "Préventif" },
] as const;

const emptyToNull = (v: string) => (v.trim() === "" ? null : v.trim());

export const createInterventionSchema = z.object({
  equipment_id: z.string().uuid("Choisissez un équipement"),
  title: z.string().trim().min(1, "Titre requis").max(200, "200 caractères maximum"),
  type: z.enum(["corrective", "preventive"]),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  description: z.string().max(2000, "2000 caractères maximum").transform(emptyToNull),
  due_date: z.string().transform(emptyToNull),
  assigned_to: z.string().transform(emptyToNull),
  // Une étape par ligne ; lignes vides ignorées.
  steps: z
    .string()
    .transform((v) =>
      v
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .pipe(
      z.array(z.string().max(200, "Étape : 200 caractères maximum")).max(30, "30 étapes maximum"),
    ),
});
export type CreateInterventionInput = z.input<typeof createInterventionSchema>;
export type CreateInterventionValues = z.output<typeof createInterventionSchema>;

export const reportSchema = z.object({
  work_performed: z.string().trim().min(3, "Décrivez les travaux réalisés").max(4000),
  duration_minutes: z
    .string()
    .transform((v) => (v.trim() === "" ? null : Number(v)))
    .pipe(z.number().int("Nombre entier").min(0).max(100000).nullable()),
  parts_used: z.string().max(2000).transform(emptyToNull),
});
export type ReportInput = z.input<typeof reportSchema>;
export type ReportValues = z.output<typeof reportSchema>;
