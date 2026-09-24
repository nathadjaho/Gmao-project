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
