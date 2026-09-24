import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { EquipmentFormValues, EquipmentStatus } from "./equipment-model";

export const EQUIPMENT_PAGE_SIZE = 20;

/** Doit rester alignée sur private.normalize_search() côté base. */
export function normalizeSearch(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export type EquipmentListParams = {
  page: number;
  q?: string;
  status?: EquipmentStatus;
};

/**
 * Liste paginée CÔTÉ SERVEUR : on ne charge jamais tout le parc.
 * `count: "exact"` renvoie le total pour la pagination ; `range` = OFFSET/LIMIT.
 * organization_id n'apparaît nulle part : la RLS filtre déjà par organisation.
 */
async function fetchEquipmentList({ page, q, status }: EquipmentListParams) {
  const from = (page - 1) * EQUIPMENT_PAGE_SIZE;
  let query = supabase
    .from("equipment")
    .select("id, code, name, category, location, status, criticality", { count: "exact" })
    .is("deleted_at", null)
    .order("code")
    .range(from, from + EQUIPMENT_PAGE_SIZE - 1);

  if (status) query = query.eq("status", status);
  if (q) {
    // Même normalisation que la colonne générée search_text (minuscules, sans accents) :
    // « generatrice » trouve « Génératrice ». Les jokers ILIKE saisis sont neutralisés.
    const term = normalizeSearch(q)
      .replace(/[%_\\]/g, " ")
      .trim();
    if (term) query = query.ilike("search_text", `%${term}%`);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: data, total: count ?? 0 };
}

export const equipmentKeys = {
  all: ["equipment"] as const,
  list: (p: EquipmentListParams) => [...equipmentKeys.all, "list", p] as const,
  detail: (id: string) => [...equipmentKeys.all, "detail", id] as const,
};

export const equipmentListQuery = (params: EquipmentListParams) =>
  queryOptions({
    queryKey: equipmentKeys.list(params),
    queryFn: () => fetchEquipmentList(params),
    placeholderData: keepPreviousData, // la page précédente reste affichée pendant le chargement
  });

async function fetchEquipmentDetail(id: string) {
  const { data, error } = await supabase
    .from("equipment")
    .select(
      `*,
       interventions(id, title, type, status, priority, due_date, created_at, completed_at),
       document_equipment(documents(id, name, mime_type, size_bytes, expires_on))`,
    )
    .eq("id", id)
    .order("created_at", { referencedTable: "interventions", ascending: false })
    .limit(20, { referencedTable: "interventions" })
    .maybeSingle();
  if (error) throw error;
  return data;
}

export const equipmentDetailQuery = (id: string) =>
  queryOptions({
    queryKey: equipmentKeys.detail(id),
    queryFn: () => fetchEquipmentDetail(id),
  });

export async function createEquipment(values: EquipmentFormValues) {
  const { data, error } = await supabase.from("equipment").insert(values).select("id").single();
  if (error) throw new Error(translateEquipmentError(error));
  return data;
}

export async function updateEquipment(id: string, values: EquipmentFormValues) {
  const { error } = await supabase.from("equipment").update(values).eq("id", id);
  if (error) throw new Error(translateEquipmentError(error));
}

function translateEquipmentError(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "Ce code est déjà utilisé par un autre équipement.";
  if (error.code === "42501") return "Action réservée aux administrateurs.";
  return error.message;
}
