import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  CreateInterventionValues,
  InterventionStatus,
  ReportValues,
} from "./intervention-model";

export const INTERVENTION_PAGE_SIZE = 20;

/** Onglets de la liste : ce que l'utilisateur veut voir en premier. */
export type InterventionView = "mine" | "to_validate" | "open" | "all";

export type InterventionListParams = { page: number; view: InterventionView; userId: string };

export const interventionKeys = {
  all: ["interventions"] as const,
  list: (p: InterventionListParams) => [...interventionKeys.all, "list", p] as const,
  detail: (id: string) => [...interventionKeys.all, "detail", id] as const,
};

const OPEN: InterventionStatus[] = ["todo", "in_progress"];

async function fetchInterventions({ page, view, userId }: InterventionListParams) {
  const from = (page - 1) * INTERVENTION_PAGE_SIZE;
  let q = supabase
    .from("interventions")
    .select(
      `id, title, type, priority, status, due_date, created_at,
       equipment(id, code, name),
       assignee:profiles!interventions_assignee_profile_fk(full_name, email)`,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, from + INTERVENTION_PAGE_SIZE - 1);

  if (view === "mine") q = q.eq("assigned_to", userId).in("status", [...OPEN, "submitted"]);
  if (view === "to_validate") q = q.eq("status", "submitted");
  if (view === "open") q = q.in("status", OPEN);

  const { data, error, count } = await q;
  if (error) throw error;
  return { rows: data, total: count ?? 0 };
}

export const interventionListQuery = (p: InterventionListParams) =>
  queryOptions({
    queryKey: interventionKeys.list(p),
    queryFn: () => fetchInterventions(p),
    placeholderData: keepPreviousData,
  });

async function fetchIntervention(id: string) {
  const { data, error } = await supabase
    .from("interventions")
    .select(
      `*,
       equipment(id, code, name, location),
       assignee:profiles!interventions_assignee_profile_fk(id, full_name, email),
       steps:intervention_steps(id, position, title, completed_at),
       history:intervention_status_history(id, from_status, to_status, reason, changed_at,
         author:profiles!status_history_changed_by_profile_fk(full_name))`,
    )
    .eq("id", id)
    .order("position", { referencedTable: "steps" })
    .order("changed_at", { referencedTable: "history" })
    .maybeSingle();
  if (error) throw error;
  return data;
}

export const interventionDetailQuery = (id: string) =>
  queryOptions({ queryKey: interventionKeys.detail(id), queryFn: () => fetchIntervention(id) });

export type InterventionDetail = NonNullable<Awaited<ReturnType<typeof fetchIntervention>>>;

/** Listes pour les menus déroulants du formulaire de création. */
export const equipmentOptionsQuery = queryOptions({
  queryKey: ["equipment", "options"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("equipment")
      .select("id, code, name")
      .is("deleted_at", null)
      .order("code")
      .limit(1000);
    if (error) throw error;
    return data;
  },
  staleTime: 60_000,
});

export const assigneeOptionsQuery = queryOptions({
  queryKey: ["team", "assignable"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("memberships")
      .select("user_id, role, profile:profiles(full_name, email)")
      .is("deleted_at", null);
    if (error) throw error;
    return data;
  },
  staleTime: 60_000,
});

export async function createIntervention({ steps, ...values }: CreateInterventionValues) {
  const { data, error } = await supabase.from("interventions").insert(values).select("id").single();
  if (error) throw new Error(error.message);
  if (steps.length > 0) {
    const { error: stepsError } = await supabase
      .from("intervention_steps")
      .insert(steps.map((title, position) => ({ intervention_id: data.id, position, title })));
    if (stepsError)
      throw new Error(
        "Intervention créée, mais la checklist n'a pas pu être enregistrée : " + stepsError.message,
      );
  }
  return data;
}

/** Tous les changements de statut passent par la fonction SQL : la base vérifie qui a le droit. */
export async function changeStatus(id: string, status: InterventionStatus, reason?: string) {
  const { error } = await supabase.rpc("change_intervention_status", {
    p_intervention_id: id,
    p_status: status,
    p_reason: reason,
  });
  if (error) throw new Error(error.message);
}

export async function saveReport(id: string, report: ReportValues) {
  const { data, error } = await supabase
    .from("interventions")
    .update(report)
    .eq("id", id)
    .select("id");
  if (error) throw new Error(error.message);
  // 0 ligne = filtrée par la RLS (plus dans votre périmètre, ex. déjà soumise).
  if (data.length === 0)
    throw new Error(
      "Modification impossible : intervention verrouillée ou hors de votre périmètre.",
    );
}

export async function toggleStep(stepId: string, done: boolean) {
  const { data, error } = await supabase
    .from("intervention_steps")
    .update({ completed_at: done ? new Date().toISOString() : null })
    .eq("id", stepId)
    .select("id");
  if (error) throw new Error(error.message);
  if (data.length === 0) throw new Error("Étape verrouillée ou hors de votre périmètre.");
}
