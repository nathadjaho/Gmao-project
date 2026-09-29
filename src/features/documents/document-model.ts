import { z } from "zod";

/** Mêmes valeurs que le bucket Storage « documents » (file_size_limit, allowed_mime_types). */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export const ACCEPTED_MIME: Record<string, string> = {
  "application/pdf": "PDF",
  "image/png": "PNG",
  "image/jpeg": "JPG",
  "image/webp": "WEBP",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/vnd.ms-excel": "XLS",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
};
export const ACCEPT_ATTR = Object.keys(ACCEPTED_MIME).join(",");

export function fileTypeLabel(mime: string): string {
  return ACCEPTED_MIME[mime] ?? "Fichier";
}

export function isPreviewable(mime: string): "pdf" | "image" | null {
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  return null;
}

/** Contrôle côté navigateur (confort) ; Storage et la base revérifient. */
export function validateFile(file: File | undefined): string | null {
  if (!file) return "Choisissez un fichier";
  if (!ACCEPTED_MIME[file.type]) return "Format non accepté (PDF, image, Word ou Excel)";
  if (file.size > MAX_FILE_BYTES) return "Fichier trop volumineux (50 Mo maximum)";
  if (file.size === 0) return "Fichier vide";
  return null;
}

/**
 * Nom de fichier sûr pour une clé Storage : sans accents, espaces ni caractères
 * spéciaux (les clés Storage n'acceptent pas tout). Le nom d'origine est conservé
 * à part (original_filename) pour le téléchargement.
 */
export function safeStorageName(filename: string): string {
  const dot = filename.lastIndexOf(".");
  const base = dot > 0 ? filename.slice(0, dot) : filename;
  const ext =
    dot > 0
      ? filename
          .slice(dot + 1)
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
      : "";
  const clean =
    base
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "fichier";
  return ext ? `${clean}.${ext}` : clean;
}

/** Nom proposé par défaut : le nom du fichier sans extension. */
export function defaultDocumentName(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return (dot > 0 ? filename.slice(0, dot) : filename).replace(/[_-]+/g, " ").trim().slice(0, 255);
}

export type ExpiryStatus = "expired" | "soon" | "ok" | "none";

export function expiryStatus(expiresOn: string | null, today: string): ExpiryStatus {
  if (!expiresOn) return "none";
  if (expiresOn < today) return "expired";
  const in30 = new Date(`${today}T00:00:00`);
  in30.setDate(in30.getDate() + 30);
  return expiresOn <= in30.toISOString().slice(0, 10) ? "soon" : "ok";
}

export const EXPIRY_BADGE: Record<
  Exclude<ExpiryStatus, "none" | "ok">,
  { label: string; badge: "critical" | "warning" }
> = {
  expired: { label: "Expiré", badge: "critical" },
  soon: { label: "Expire bientôt", badge: "warning" },
};

const optionalDate = z
  .string()
  .transform((v) => (v === "" ? null : v))
  .pipe(
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide")
      .nullable(),
  );

/** Métadonnées saisies à l'envoi (le fichier est validé à part : validateFile). */
export const documentMetaSchema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(255, "255 caractères maximum"),
  category_id: z.string().uuid("Choisissez une catégorie"),
  expires_on: optionalDate,
});
export type DocumentMetaInput = z.input<typeof documentMetaSchema>;
export type DocumentMetaValues = z.output<typeof documentMetaSchema>;

export const newVersionSchema = z.object({
  comment: z.string().trim().max(500, "500 caractères maximum"),
  expires_on: optionalDate,
});
export type NewVersionInput = z.input<typeof newVersionSchema>;
export type NewVersionValues = z.output<typeof newVersionSchema>;
