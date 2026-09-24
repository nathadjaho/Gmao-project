import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Date locale au format AAAA-MM-JJ : « en retard » se juge dans le fuseau de l'utilisateur. */
export function localToday(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

/** Forme du JSON renvoyé par public.dashboard_summary() (à garder alignée sur la migration phase 3). */
export type DashboardSummary = {
  interventions: {
    to_validate: number;
    open: number;
    overdue: number;
    mine_open: number;
    mine_overdue: number;
    mine_submitted: number;
    done_30d: number;
  };
  equipment: { total: number; in_service: number; broken_down: number; out_of_service: number };
  documents: { expiring_30d: number; expired: number };
};

export const dashboardKeys = { all: ["dashboard"] as const };

// Données « vivantes » : on rafraîchit à chaque retour sur l'onglet et au plus tard toutes les minutes
// (staleTime 0 : on affiche le cache tout de suite, puis on le remplace par les chiffres à jour).
const LIVE = { staleTime: 0, refetchInterval: 60_000 } as const;

export const dashboardSummaryQuery = (today: string) =>
  queryOptions({
    queryKey: [...dashboardKeys.all, "summary", today],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("dashboard_summary", { p_today: today });
      if (error) throw error;
      return data as DashboardSummary;
    },
    ...LIVE,
  });

/** Interventions ouvertes, les plus urgentes d'abord (échéance la plus proche ; sans échéance à la fin). */
export const upcomingInterventionsQuery = (userId: string | null) =>
  queryOptions({
    queryKey: [...dashboardKeys.all, "upcoming", userId],
    queryFn: async () => {
      let q = supabase
        .from("interventions")
        .select(
          `id, title, priority, status, due_date,
           equipment(code, name),
           assignee:profiles!interventions_assignee_profile_fk(full_name, email)`,
        )
        .in("status", ["todo", "in_progress"])
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(6);
      if (userId) q = q.eq("assigned_to", userId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    ...LIVE,
  });

export const recentActivityQuery = queryOptions({
  queryKey: [...dashboardKeys.all, "activity"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("intervention_status_history")
      .select(
        `id, from_status, to_status, reason, changed_at,
         intervention:interventions(id, title),
         author:profiles!status_history_changed_by_profile_fk(full_name, email)`,
      )
      .order("changed_at", { ascending: false })
      .limit(8);
    if (error) throw error;
    return data;
  },
  ...LIVE,
});

export const brokenEquipmentQuery = queryOptions({
  queryKey: [...dashboardKeys.all, "broken"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("equipment")
      .select("id, code, name, location, criticality")
      .eq("status", "broken_down")
      .is("deleted_at", null)
      .order("criticality", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(5);
    if (error) throw error;
    return data;
  },
  ...LIVE,
});
