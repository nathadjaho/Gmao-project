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

/* ---------- Écran « Aujourd'hui » (D18) ---------- */

/** Interventions ouvertes avec leur échéance (toutes pour l'admin, les siennes pour le technicien). */
export const openInterventionsQuery = (userId: string | null) =>
  queryOptions({
    queryKey: [...dashboardKeys.all, "open-due", userId],
    queryFn: async () => {
      let q = supabase
        .from("interventions")
        .select(
          `id, title, status, priority, due_date, created_at,
           equipment(id, code, name),
           assignee:profiles!interventions_assignee_profile_fk(full_name, email)`,
        )
        .in("status", ["todo", "in_progress"])
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true })
        .limit(200);
      if (userId) q = q.eq("assigned_to", userId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    ...LIVE,
  });

/** Interventions soumises : file « À valider » (admin) ou « en attente » (technicien, les siennes). */
export const submittedInterventionsQuery = (userId: string | null) =>
  queryOptions({
    queryKey: [...dashboardKeys.all, "submitted", userId],
    queryFn: async () => {
      let q = supabase
        .from("interventions")
        .select(
          `id, title, submitted_at,
           equipment(code, name),
           assignee:profiles!interventions_assignee_profile_fk(full_name, email)`,
        )
        .eq("status", "submitted")
        .order("submitted_at", { ascending: true })
        .limit(30);
      if (userId) q = q.eq("assigned_to", userId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    ...LIVE,
  });

/** Documents non archivés expirés ou qui expirent d'ici `until` (AAAA-MM-JJ). */
export const expiringDocumentsQuery = (until: string) =>
  queryOptions({
    queryKey: [...dashboardKeys.all, "expiring", until],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select(
          `id, name, expires_on, created_at, links:document_equipment(equipment(id, code, name))`,
        )
        .is("deleted_at", null)
        .not("expires_on", "is", null)
        .lte("expires_on", until)
        .order("expires_on", { ascending: true })
        .limit(50);
      if (error) throw error;
      return data;
    },
    ...LIVE,
  });
