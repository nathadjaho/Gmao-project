import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  ClipboardCheck,
  FileWarning,
  RotateCcw,
  UserPlus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Enums } from "@/integrations/supabase/types";

export type NotificationType = Enums<"notification_type">;

/** Rendu de chaque type : icône, libellé court, couleur (source unique pour l'UI). */
export const NOTIFICATION_TYPES: Record<
  NotificationType,
  { label: string; icon: typeof AlertTriangle; tone: "critical" | "warning" | "accent" | "neutral" }
> = {
  intervention_assigned: { label: "Assignation", icon: UserPlus, tone: "accent" },
  intervention_submitted: { label: "À valider", icon: ClipboardCheck, tone: "accent" },
  intervention_returned: { label: "Renvoyée", icon: RotateCcw, tone: "warning" },
  intervention_overdue: { label: "En retard", icon: CalendarClock, tone: "critical" },
  document_expiring: { label: "Échéance document", icon: FileWarning, tone: "warning" },
};

export const NOTIFICATION_PAGE_SIZE = 30;

export const notificationKeys = {
  all: ["notifications"] as const,
  unread: () => [...notificationKeys.all, "unread-count"] as const,
  list: (p: { page: number; unreadOnly: boolean }) => [...notificationKeys.all, "list", p] as const,
};

/**
 * Nombre de non-lues pour le badge du menu. `head: true` + `count: exact` :
 * Postgres compte, aucune ligne ne transite. Rafraîchi toutes les minutes
 * (suffisant pour un MVP ; le temps réel viendra avec Supabase Realtime si besoin).
 */
export const unreadCountQuery = queryOptions({
  queryKey: notificationKeys.unread(),
  queryFn: async () => {
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null);
    if (error) throw error;
    return count ?? 0;
  },
  refetchInterval: 60_000,
  staleTime: 30_000,
});

export const notificationListQuery = (p: { page: number; unreadOnly: boolean }) =>
  queryOptions({
    queryKey: notificationKeys.list(p),
    queryFn: async () => {
      const from = (p.page - 1) * NOTIFICATION_PAGE_SIZE;
      let q = supabase
        .from("notifications")
        .select("id, type, entity_type, entity_id, message, read_at, created_at", {
          count: "exact",
        })
        .order("created_at", { ascending: false })
        .range(from, from + NOTIFICATION_PAGE_SIZE - 1);
      if (p.unreadOnly) q = q.is("read_at", null);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: data, total: count ?? 0 };
    },
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

export type NotificationRow = {
  id: string;
  type: NotificationType;
  entity_type: string;
  entity_id: string;
  message: string;
  read_at: string | null;
  created_at: string;
};

// La RLS limite ces mises à jour aux notifications de l'utilisateur,
// et le droit UPDATE ne porte que sur read_at.
export async function markRead(id: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
  if (error) throw new Error(error.message);
}

export async function markAllRead() {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) throw new Error(error.message);
}
