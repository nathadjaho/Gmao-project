import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizeSearch } from "@/features/equipment/equipment-api";
import { localToday } from "@/features/dashboard/dashboard-api";
import { safeStorageName, type DocumentMetaValues, type NewVersionValues } from "./document-model";

const BUCKET = "documents";
export const DOCUMENT_PAGE_SIZE = 20;

export type DocumentListParams = {
  page: number;
  q?: string;
  category?: string;
  expiry?: "expired" | "soon";
  archived?: boolean;
};

export const documentKeys = {
  all: ["documents"] as const,
  list: (p: DocumentListParams) => [...documentKeys.all, "list", p] as const,
  detail: (id: string) => [...documentKeys.all, "detail", id] as const,
};

export const categoriesQuery = queryOptions({
  queryKey: [...documentKeys.all, "categories"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("document_categories")
      .select("id, name")
      .order("name");
    if (error) throw error;
    return data;
  },
  staleTime: 5 * 60_000,
});

/** Pour la gestion des catégories (admin) : nombre de documents, archivés compris. */
export const categoriesWithCountQuery = queryOptions({
  queryKey: [...documentKeys.all, "categories", "with-count"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("document_categories")
      .select("id, name, documents(count)")
      .order("name");
    if (error) throw error;
    return data.map((c) => ({ id: c.id, name: c.name, count: c.documents[0]?.count ?? 0 }));
  },
});

/** Messages lisibles pour les contraintes de la table (nom unique, catégorie utilisée). */
function categoryError(e: { code?: string; message: string }): Error {
  if (e.code === "23505") return new Error("Une catégorie porte déjà ce nom.");
  if (e.code === "23503")
    return new Error("Catégorie utilisée par des documents : déplacez-les d'abord.");
  if (e.code === "23514") return new Error("Nom invalide (1 à 80 caractères).");
  return new Error(e.message);
}

export async function createCategory(name: string) {
  const { error } = await supabase.from("document_categories").insert({ name: name.trim() });
  if (error) throw categoryError(error);
}

export async function renameCategory(id: string, name: string) {
  const { data, error } = await supabase
    .from("document_categories")
    .update({ name: name.trim() })
    .eq("id", id)
    .select("id");
  if (error) throw categoryError(error);
  if (data.length === 0) throw new Error("Modification réservée aux administrateurs.");
}

export async function deleteCategory(id: string) {
  const { data, error } = await supabase
    .from("document_categories")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) throw categoryError(error);
  if (data.length === 0) throw new Error("Suppression réservée aux administrateurs.");
}

/* ---------- Lecture ---------- */

async function fetchDocuments({ page, q, category, expiry, archived }: DocumentListParams) {
  const from = (page - 1) * DOCUMENT_PAGE_SIZE;
  let query = supabase
    .from("documents")
    .select(
      `id, name, original_filename, storage_path, mime_type, size_bytes, expires_on, current_version, updated_at,
       category:document_categories(name),
       links:document_equipment(equipment(id, code))`,
      { count: "exact" },
    )
    .order("updated_at", { ascending: false })
    .range(from, from + DOCUMENT_PAGE_SIZE - 1);

  query = archived ? query.not("deleted_at", "is", null) : query.is("deleted_at", null);
  if (category) query = query.eq("category_id", category);
  if (q) {
    const term = normalizeSearch(q)
      .replace(/[%_\\]/g, " ")
      .trim();
    if (term) query = query.ilike("search_text", `%${term}%`);
  }
  if (expiry) {
    const today = localToday();
    if (expiry === "expired") query = query.lt("expires_on", today);
    else {
      const d = new Date(`${today}T00:00:00`);
      d.setDate(d.getDate() + 30);
      query = query.gte("expires_on", today).lte("expires_on", d.toISOString().slice(0, 10));
    }
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: data, total: count ?? 0 };
}

export const documentListQuery = (p: DocumentListParams) =>
  queryOptions({
    queryKey: documentKeys.list(p),
    queryFn: () => fetchDocuments(p),
    placeholderData: keepPreviousData,
  });

async function fetchDocument(id: string) {
  const { data, error } = await supabase
    .from("documents")
    .select(
      `*,
       category:document_categories(id, name),
       versions:document_versions(id, version_number, original_filename, storage_path, mime_type, size_bytes,
         comment, created_at, author:profiles!document_versions_uploader_profile_fk(full_name, email)),
       equipment_links:document_equipment(equipment(id, code, name)),
       intervention_links:document_interventions(intervention:interventions(id, title, status))`,
    )
    .eq("id", id)
    .order("version_number", { referencedTable: "versions", ascending: false })
    .maybeSingle();
  if (error) throw error;
  return data;
}

export const documentDetailQuery = (id: string) =>
  queryOptions({ queryKey: documentKeys.detail(id), queryFn: () => fetchDocument(id) });

export type DocumentDetail = NonNullable<Awaited<ReturnType<typeof fetchDocument>>>;

/** Documents liés à un équipement ou à une intervention (sections des fiches). */
export type LinkTarget = { kind: "equipment" | "intervention"; id: string };

export const linkedDocumentsQuery = ({ kind, id }: LinkTarget) =>
  queryOptions({
    queryKey: [...documentKeys.all, "linked", kind, id] as const,
    queryFn: async () => {
      const select =
        "document:documents(id, name, mime_type, size_bytes, expires_on, current_version, deleted_at)";
      const { data, error } =
        kind === "equipment"
          ? await supabase.from("document_equipment").select(select).eq("equipment_id", id)
          : await supabase.from("document_interventions").select(select).eq("intervention_id", id);
      if (error) throw error;
      return data.flatMap((l) => (l.document && !l.document.deleted_at ? [l.document] : []));
    },
  });

/* ---------- Fichiers ---------- */

/**
 * Envoie le fichier dans Storage sous {org}/{document}/{version}/{nom}.
 * Les identifiants sont générés ici : on connaît le chemin AVANT d'écrire en base,
 * ce qui permet à la base de vérifier que le fichier existe vraiment.
 */
async function uploadFile(orgId: string, documentId: string, file: File) {
  const versionId = crypto.randomUUID();
  const path = `${orgId}/${documentId}/${versionId}/${safeStorageName(file.name)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(`Envoi du fichier impossible : ${error.message}`);
  return { versionId, path };
}

/** Si l'enregistrement en base échoue, on retire le fichier pour ne pas laisser d'orphelin. */
async function removeOrphan(path: string) {
  await supabase.storage.from(BUCKET).remove([path]);
}

export async function createDocument(
  orgId: string,
  file: File,
  meta: DocumentMetaValues,
  link?: { equipmentId?: string; interventionId?: string },
) {
  const documentId = crypto.randomUUID();
  const { versionId, path } = await uploadFile(orgId, documentId, file);
  const { error } = await supabase.rpc("create_document", {
    p_id: documentId,
    p_version_id: versionId,
    p_name: meta.name,
    p_category_id: meta.category_id,
    p_expires_on: meta.expires_on,
    p_storage_path: path,
    p_filename: file.name,
  });
  if (error) {
    await removeOrphan(path);
    throw new Error(error.message);
  }
  // Le lien est une étape distincte : si elle échoue, le document existe quand même.
  if (link?.equipmentId) await linkEquipment(documentId, link.equipmentId);
  if (link?.interventionId) await linkIntervention(documentId, link.interventionId);
  return documentId;
}

export async function addVersion(
  orgId: string,
  documentId: string,
  file: File,
  v: NewVersionValues,
) {
  const { versionId, path } = await uploadFile(orgId, documentId, file);
  const { data, error } = await supabase.rpc("add_document_version", {
    p_document_id: documentId,
    p_version_id: versionId,
    p_storage_path: path,
    p_filename: file.name,
    p_comment: v.comment || null,
    p_expires_on: v.expires_on,
  });
  if (error) {
    await removeOrphan(path);
    throw new Error(error.message);
  }
  return data;
}

export async function restoreVersion(versionId: string) {
  const { data, error } = await supabase.rpc("restore_document_version", {
    p_version_id: versionId,
  });
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Lien temporaire (bucket privé) : valable quelques secondes, jamais de lien public.
 * `download` force le téléchargement avec le nom d'origine du fichier.
 */
export async function signedUrl(path: string, opts: { download?: string; seconds?: number } = {}) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(
      path,
      opts.seconds ?? 60,
      opts.download ? { download: opts.download } : undefined,
    );
  if (error) throw new Error(`Lien de téléchargement impossible : ${error.message}`);
  return data.signedUrl;
}

export async function downloadFile(path: string, filename: string) {
  const url = await signedUrl(path, { download: filename });
  window.location.assign(url);
}

/* ---------- Fiche (admin) ---------- */

async function updateOne(
  id: string,
  values: {
    name?: string;
    category_id?: string;
    expires_on?: string | null;
    deleted_at?: string | null;
  },
) {
  const { data, error } = await supabase.from("documents").update(values).eq("id", id).select("id");
  if (error) throw new Error(error.message);
  if (data.length === 0) throw new Error("Modification refusée : réservée aux administrateurs.");
}

export const updateDocument = (id: string, meta: DocumentMetaValues) => updateOne(id, meta);
export const setArchived = (id: string, archived: boolean) =>
  updateOne(id, { deleted_at: archived ? new Date().toISOString() : null });

/* ---------- Liens ---------- */

export async function linkEquipment(documentId: string, equipmentId: string) {
  const { error } = await supabase
    .from("document_equipment")
    .upsert({ document_id: documentId, equipment_id: equipmentId }, { ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

export async function unlinkEquipment(documentId: string, equipmentId: string) {
  const { error } = await supabase
    .from("document_equipment")
    .delete()
    .eq("document_id", documentId)
    .eq("equipment_id", equipmentId);
  if (error) throw new Error(error.message);
}

export async function linkIntervention(documentId: string, interventionId: string) {
  const { error } = await supabase
    .from("document_interventions")
    .upsert(
      { document_id: documentId, intervention_id: interventionId },
      { ignoreDuplicates: true },
    );
  if (error) throw new Error(error.message);
}

export async function unlinkIntervention(documentId: string, interventionId: string) {
  const { error } = await supabase
    .from("document_interventions")
    .delete()
    .eq("document_id", documentId)
    .eq("intervention_id", interventionId);
  if (error) throw new Error(error.message);
}
