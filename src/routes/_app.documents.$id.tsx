import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  ChevronRight,
  Download,
  FileUp,
  History,
  Link2,
  Pencil,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { useIsAdmin } from "@/features/auth/use-auth";
import { dashboardKeys, localToday } from "@/features/dashboard/dashboard-api";
import { DocumentFormDialog } from "@/features/documents/components/DocumentFormDialog";
import { NewVersionDialog } from "@/features/documents/components/NewVersionDialog";
import {
  documentDetailQuery,
  documentKeys,
  downloadFile,
  linkEquipment,
  restoreVersion,
  setArchived,
  signedUrl,
  unlinkEquipment,
} from "@/features/documents/document-api";
import {
  EXPIRY_BADGE,
  expiryStatus,
  fileTypeLabel,
  isPreviewable,
} from "@/features/documents/document-model";
import { equipmentOptionsQuery } from "@/features/interventions/intervention-api";
import { INTERVENTION_STATUS } from "@/features/interventions/intervention-model";
import { formatBytes, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_app/documents/$id")({
  head: () => ({ meta: [{ title: "Document — ForgeOS GMAO" }] }),
  component: DocumentPage,
});

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });

function DocumentPage() {
  const { id } = Route.useParams();
  const isAdmin = useIsAdmin();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);
  const { data: doc, isPending, isError, error } = useQuery(documentDetailQuery(id));

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: documentKeys.all }),
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
    ]);

  const archive = useMutation({
    mutationFn: (archived: boolean) => setArchived(id, archived),
    onSuccess: async (_, archived) => {
      await refresh();
      toast.success(archived ? "Document archivé" : "Document réactivé");
    },
    onError: (e) => toast.error(e.message),
  });

  const restore = useMutation({
    mutationFn: restoreVersion,
    onSuccess: async (n) => {
      await refresh();
      toast.success(`Restauré : c'est maintenant la version ${n}`);
    },
    onError: (e) => toast.error(e.message),
  });

  async function download(path: string, filename: string) {
    try {
      await downloadFile(path, filename);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Téléchargement impossible");
    }
  }

  if (isPending) return <div className="p-8 text-sm text-muted-foreground">Chargement…</div>;
  if (isError || !doc) {
    return (
      <div className="p-8">
        <div className="text-sm font-semibold">Document introuvable</div>
        <p className="text-sm text-muted-foreground mt-1">
          {isError ? error.message : "Il n'existe pas ou n'appartient pas à votre organisation."}
        </p>
        <Link
          to="/documents"
          className="mt-3 inline-block text-xs font-semibold text-accent hover:underline"
        >
          ← Retour aux documents
        </Link>
      </div>
    );
  }

  const archived = Boolean(doc.deleted_at);
  const exp = expiryStatus(doc.expires_on, localToday());
  const filename = doc.original_filename ?? doc.name;

  return (
    <div className="p-6 md:p-8 max-w-[1200px] mx-auto">
      <nav className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground font-bold mb-3">
        <Link to="/documents" className="hover:text-foreground">
          Documents
        </Link>
        <ChevronRight className="size-3" />
        <span className="text-foreground truncate">{doc.name}</span>
      </nav>

      <PageHeader
        eyebrow={`${doc.category?.name ?? "Document"} · ${fileTypeLabel(doc.mime_type)} · version ${doc.current_version}`}
        title={doc.name}
        description={`${filename} · ${formatBytes(doc.size_bytes)}`}
        actions={
          <div className="flex flex-wrap gap-2 items-center">
            {archived && <StatusBadge variant="neutral">Archivé</StatusBadge>}
            {(exp === "expired" || exp === "soon") && (
              <StatusBadge variant={EXPIRY_BADGE[exp].badge}>{EXPIRY_BADGE[exp].label}</StatusBadge>
            )}
            <ActionButton primary onClick={() => download(doc.storage_path, filename)}>
              <Download className="size-3.5" /> Télécharger
            </ActionButton>
            {isAdmin && !archived && (
              <>
                <ActionButton onClick={() => setVersionOpen(true)}>
                  <FileUp className="size-3.5" /> Nouvelle version
                </ActionButton>
                <ActionButton onClick={() => setEditOpen(true)}>
                  <Pencil className="size-3.5" /> Modifier
                </ActionButton>
              </>
            )}
            {isAdmin && (
              <ActionButton pending={archive.isPending} onClick={() => archive.mutate(!archived)}>
                {archived ? (
                  <ArchiveRestore className="size-3.5" />
                ) : (
                  <Archive className="size-3.5" />
                )}
                {archived ? "Réactiver" : "Archiver"}
              </ActionButton>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Preview path={doc.storage_path} mime={doc.mime_type} version={doc.current_version} />

          <section className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border text-sm font-bold flex items-center gap-2">
              <History className="size-4 text-accent" /> Historique des versions
            </div>
            <ul className="divide-y divide-border">
              {doc.versions.map((v) => {
                const current = v.version_number === doc.current_version;
                return (
                  <li key={v.id} className="px-5 py-3 flex items-center gap-4">
                    <div className="font-mono text-sm font-bold w-10">v{v.version_number}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">
                        {v.comment || v.original_filename}
                        {current && (
                          <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-accent">
                            Actuelle
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {dateTime.format(new Date(v.created_at))} ·{" "}
                        {v.author?.full_name || v.author?.email || "—"} · {v.original_filename} ·{" "}
                        {formatBytes(v.size_bytes)}
                      </div>
                    </div>
                    <button
                      type="button"
                      title="Télécharger cette version"
                      aria-label={`Télécharger la version ${v.version_number}`}
                      onClick={() => download(v.storage_path, v.original_filename)}
                      className="size-8 rounded-md inline-flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      <Download className="size-4" />
                    </button>
                    {isAdmin && !archived && !current && (
                      <button
                        type="button"
                        disabled={restore.isPending}
                        onClick={() => restore.mutate(v.id)}
                        className="h-8 px-2.5 rounded-md border border-border bg-card text-[11px] font-semibold hover:bg-secondary disabled:opacity-60"
                      >
                        Restaurer
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-xl border border-border bg-card shadow-card p-5 text-xs space-y-3">
            <Info label="Catégorie">{doc.category?.name ?? "—"}</Info>
            <Info label="Expiration">{formatDate(doc.expires_on)}</Info>
            <Info label="Ajouté le">{formatDate(doc.created_at)}</Info>
            <Info label="Mis à jour">{formatDate(doc.updated_at)}</Info>
          </section>

          <EquipmentLinks
            documentId={doc.id}
            links={doc.equipment_links.flatMap((l) => (l.equipment ? [l.equipment] : []))}
            canEdit={!archived}
            onChanged={refresh}
          />

          <section className="rounded-xl border border-border bg-card shadow-card p-5">
            <div className="text-sm font-bold mb-3">Interventions</div>
            {doc.intervention_links.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Aucune. Ajoutez le document depuis la fiche d'une intervention.
              </p>
            ) : (
              <ul className="space-y-2">
                {doc.intervention_links.flatMap((l) =>
                  l.intervention
                    ? [
                        <li
                          key={l.intervention.id}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <Link
                            to="/interventions/$id"
                            params={{ id: l.intervention.id }}
                            className="font-semibold hover:underline truncate"
                          >
                            {l.intervention.title}
                          </Link>
                          <StatusBadge variant={INTERVENTION_STATUS[l.intervention.status].badge}>
                            {INTERVENTION_STATUS[l.intervention.status].label}
                          </StatusBadge>
                        </li>,
                      ]
                    : [],
                )}
              </ul>
            )}
          </section>
        </aside>
      </div>

      {isAdmin && (
        <>
          <DocumentFormDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            document={{
              id: doc.id,
              name: doc.name,
              category_id: doc.category_id,
              expires_on: doc.expires_on,
            }}
          />
          <NewVersionDialog
            open={versionOpen}
            onOpenChange={setVersionOpen}
            documentId={doc.id}
            nextVersion={doc.current_version + 1}
          />
        </>
      )}
    </div>
  );
}

/** Aperçu intégré pour les PDF et images (lien signé de 10 min, régénéré à chaque nouvelle version). */
function Preview({ path, mime, version }: { path: string; mime: string; version: number }) {
  const kind = isPreviewable(mime);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!kind) return;
    let cancelled = false;
    setUrl(null);
    signedUrl(path, { seconds: 600 })
      .then((u) => !cancelled && setUrl(u))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [path, kind, version]);

  if (!kind) return null;
  return (
    <section className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
      {failed ? (
        <p className="px-5 py-10 text-sm text-muted-foreground text-center">Aperçu indisponible.</p>
      ) : !url ? (
        <div className="h-[480px] animate-pulse bg-secondary/40" />
      ) : kind === "pdf" ? (
        <iframe src={url} title="Aperçu du document" className="w-full h-[640px] bg-secondary/20" />
      ) : (
        <img
          src={url}
          alt="Aperçu du document"
          className="w-full max-h-[640px] object-contain bg-secondary/20"
        />
      )}
    </section>
  );
}

function EquipmentLinks({
  documentId,
  links,
  canEdit,
  onChanged,
}: {
  documentId: string;
  links: { id: string; code: string; name: string }[];
  canEdit: boolean;
  onChanged: () => Promise<unknown>;
}) {
  const [adding, setAdding] = useState(false);
  const options = useQuery({ ...equipmentOptionsQuery, enabled: adding });
  const linked = new Set(links.map((l) => l.id));

  const add = useMutation({
    mutationFn: (equipmentId: string) => linkEquipment(documentId, equipmentId),
    onSuccess: async () => {
      await onChanged();
      setAdding(false);
      toast.success("Équipement lié");
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (equipmentId: string) => unlinkEquipment(documentId, equipmentId),
    onSuccess: onChanged,
    onError: (e) => toast.error(e.message),
  });

  return (
    <section className="rounded-xl border border-border bg-card shadow-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-bold">Équipements</div>
        {canEdit && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-[11px] font-semibold text-accent hover:underline inline-flex items-center gap-1"
          >
            <Link2 className="size-3" /> Lier
          </button>
        )}
      </div>
      {adding && (
        <select
          autoFocus
          aria-label="Choisir un équipement à lier"
          defaultValue=""
          disabled={add.isPending}
          onChange={(e) => e.target.value && add.mutate(e.target.value)}
          onBlur={() => !add.isPending && setAdding(false)}
          className="mb-3 w-full h-9 px-2 rounded-md border border-input bg-card text-sm"
        >
          <option value="">
            {options.isPending ? "Chargement…" : "— Choisir un équipement —"}
          </option>
          {(options.data ?? [])
            .filter((o) => !linked.has(o.id))
            .map((o) => (
              <option key={o.id} value={o.id}>
                {o.code} · {o.name}
              </option>
            ))}
        </select>
      )}
      {links.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aucun équipement lié.</p>
      ) : (
        <ul className="space-y-2">
          {links.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2 text-xs">
              <Link
                to="/equipment/$id"
                params={{ id: e.id }}
                className="font-semibold hover:underline truncate"
              >
                {e.code} · {e.name}
              </Link>
              {canEdit && (
                <button
                  type="button"
                  title="Retirer le lien"
                  aria-label={`Retirer le lien avec ${e.code}`}
                  onClick={() => remove.mutate(e.id)}
                  className="size-6 rounded inline-flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ActionButton({
  children,
  onClick,
  primary,
  pending,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  pending?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={`h-9 px-3 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-60 ${
        primary
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : "border border-border bg-card hover:bg-secondary"
      }`}
    >
      {children}
    </button>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border pb-2 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-right">{children}</span>
    </div>
  );
}
