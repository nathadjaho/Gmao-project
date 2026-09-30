import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Download, FileText, FolderOpen, Search, Settings2, Upload } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { useIsAdmin } from "@/features/auth/use-auth";
import { localToday } from "@/features/dashboard/dashboard-api";
import { DocumentFormDialog } from "@/features/documents/components/DocumentFormDialog";
import { CategoryManagerDialog } from "@/features/documents/components/CategoryManagerDialog";
import {
  DOCUMENT_PAGE_SIZE,
  categoriesQuery,
  documentListQuery,
  downloadFile,
  type DocumentListParams,
} from "@/features/documents/document-api";
import { EXPIRY_BADGE, expiryStatus, fileTypeLabel } from "@/features/documents/document-model";
import { formatBytes, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type Search = Omit<DocumentListParams, "page"> & { page?: number; upload?: boolean };

// Même principe que les équipements : l'état de la liste vit dans l'URL.
export const Route = createFileRoute("/_app/documents/")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    page: Number(s.page) > 1 ? Math.floor(Number(s.page)) : undefined,
    q: typeof s.q === "string" && s.q.trim() ? s.q.trim() : undefined,
    category: typeof s.category === "string" && s.category ? s.category : undefined,
    expiry: s.expiry === "expired" || s.expiry === "soon" ? s.expiry : undefined,
    archived: s.archived === true || s.archived === "true" ? true : undefined,
    upload: s.upload === true || s.upload === "true" ? true : undefined,
  }),
  head: () => ({ meta: [{ title: "Documents — ForgeOS GMAO" }] }),
  component: DocumentList,
});

const EXPIRY_FILTERS = [
  { label: "Tous", expiry: undefined },
  { label: "Expire bientôt", expiry: "soon" },
  { label: "Expirés", expiry: "expired" },
] as const;

function DocumentList() {
  const search = Route.useSearch();
  const page = search.page ?? 1;
  const navigate = useNavigate({ from: Route.fullPath });
  const isAdmin = useIsAdmin();
  const today = localToday();
  const [draft, setDraft] = useState(search.q ?? "");
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      const q = draft.trim() || undefined;
      if (q !== search.q)
        navigate({ search: (s) => ({ ...s, q, page: undefined }), replace: true });
    }, 300);
    return () => clearTimeout(t);
  }, [draft, search.q, navigate]);

  const categories = useQuery(categoriesQuery);
  const { data, isPending, isError, error, isFetching } = useQuery(
    documentListQuery({
      page,
      q: search.q,
      category: search.category,
      expiry: search.expiry,
      archived: search.archived,
    }),
  );
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / DOCUMENT_PAGE_SIZE));

  async function onDownload(e: React.MouseEvent, path: string, filename: string) {
    e.preventDefault(); // la ligne est un lien vers la fiche : on ne navigue pas
    try {
      await downloadFile(path, filename);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Téléchargement impossible");
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        eyebrow="Bibliothèque technique"
        title="Documents"
        description={
          isPending
            ? "Chargement…"
            : `${total} document${total > 1 ? "s" : ""}${search.archived ? " archivé(s)" : ""}.`
        }
        actions={
          <button
            onClick={() => navigate({ search: (s) => ({ ...s, upload: true }) })}
            className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-primary/90"
          >
            <Upload className="size-3.5" /> Ajouter un document
          </button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
        {/* Catégories */}
        <aside className="space-y-1" aria-label="Catégories">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground px-3 py-2">
            Catégories
          </div>
          {[{ id: undefined, name: "Toutes" }, ...(categories.data ?? [])].map((c) => {
            const active = search.category === c.id;
            return (
              <button
                key={c.id ?? "all"}
                aria-pressed={active}
                onClick={() =>
                  navigate({ search: (s) => ({ ...s, category: c.id, page: undefined }) })
                }
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-left transition-colors",
                  active
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-foreground/80 hover:bg-secondary",
                )}
              >
                <FolderOpen className="size-4 shrink-0" strokeWidth={1.8} />
                <span className="truncate">{c.name}</span>
              </button>
            );
          })}
          {isAdmin && (
            <button
              aria-pressed={Boolean(search.archived)}
              onClick={() =>
                navigate({
                  search: (s) => ({
                    ...s,
                    archived: s.archived ? undefined : true,
                    page: undefined,
                  }),
                })
              }
              className={cn(
                "w-full mt-4 px-3 py-2 rounded-md text-xs text-left transition-colors",
                search.archived
                  ? "bg-secondary font-semibold"
                  : "text-muted-foreground hover:bg-secondary",
              )}
            >
              {search.archived ? "← Documents actifs" : "Voir les archivés"}
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => setCategoriesOpen(true)}
              className="w-full px-3 py-2 rounded-md text-xs text-left text-muted-foreground hover:bg-secondary inline-flex items-center gap-2"
            >
              <Settings2 className="size-3.5" /> Gérer les catégories
            </button>
          )}
        </aside>

        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-2 h-9 px-3 w-80 max-w-full rounded-md border border-input bg-card text-sm">
              <Search className="size-4 text-muted-foreground" />
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Rechercher un document…"
                aria-label="Rechercher un document"
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
              />
            </div>
            <div
              className="flex items-center gap-1 rounded-md border border-border bg-card p-1"
              role="group"
              aria-label="Filtrer par échéance"
            >
              {EXPIRY_FILTERS.map((f) => {
                const active = search.expiry === f.expiry;
                return (
                  <button
                    key={f.label}
                    aria-pressed={active}
                    onClick={() =>
                      navigate({ search: (s) => ({ ...s, expiry: f.expiry, page: undefined }) })
                    }
                    className={cn(
                      "h-7 px-3 text-xs font-semibold rounded transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
            {isFetching && !isPending && (
              <span className="text-xs text-muted-foreground">Mise à jour…</span>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-card">
            {isError && <div className="px-4 py-6 text-sm text-critical">{error.message}</div>}
            {isPending && (
              <div className="px-4 py-6 text-sm text-muted-foreground">Chargement…</div>
            )}
            {data && data.rows.length === 0 && (
              <div className="px-4 py-12 text-center">
                <FileText className="size-8 mx-auto text-muted-foreground" strokeWidth={1.5} />
                <div className="mt-3 text-sm font-semibold">
                  {search.q || search.category || search.expiry
                    ? "Aucun document ne correspond"
                    : "Aucun document pour le moment"}
                </div>
                {!search.q && !search.category && !search.expiry && !search.archived && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Ajoutez vos manuels, procédures et certificats : ils seront accessibles à toute
                    l'équipe.
                  </p>
                )}
              </div>
            )}
            <ul className="divide-y divide-border">
              {data?.rows.map((d) => {
                const exp = expiryStatus(d.expires_on, today);
                const codes = d.links.flatMap((l) => (l.equipment ? [l.equipment.code] : []));
                return (
                  <li key={d.id}>
                    <Link
                      to="/documents/$id"
                      params={{ id: d.id }}
                      className="px-4 py-3.5 flex items-center gap-4 hover:bg-secondary/30 transition-colors"
                    >
                      <div className="size-10 rounded-md bg-secondary text-foreground flex flex-col items-center justify-center shrink-0">
                        <FileText className="size-4" />
                        <span className="text-[8px] font-bold mt-0.5">
                          {fileTypeLabel(d.mime_type)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{d.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {d.category?.name ?? "—"} · v{d.current_version} ·{" "}
                          {formatBytes(d.size_bytes)}
                          {codes.length > 0 &&
                            ` · ${codes.slice(0, 3).join(", ")}${codes.length > 3 ? "…" : ""}`}
                        </div>
                      </div>
                      <div className="hidden md:block text-xs text-muted-foreground w-28 text-right">
                        {formatDate(d.updated_at)}
                      </div>
                      <div className="w-28 hidden sm:flex justify-end">
                        {(exp === "expired" || exp === "soon") && (
                          <StatusBadge variant={EXPIRY_BADGE[exp].badge}>
                            {EXPIRY_BADGE[exp].label}
                          </StatusBadge>
                        )}
                      </div>
                      <button
                        type="button"
                        title="Télécharger"
                        aria-label={`Télécharger ${d.name}`}
                        onClick={(e) =>
                          onDownload(e, d.storage_path, d.original_filename ?? d.name)
                        }
                        className="size-8 rounded-md inline-flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground shrink-0"
                      >
                        <Download className="size-4" />
                      </button>
                    </Link>
                  </li>
                );
              })}
            </ul>
            {total > DOCUMENT_PAGE_SIZE && (
              <div className="px-4 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <div>
                  Page {page} sur {pageCount}
                </div>
                <div className="flex gap-1">
                  <button
                    disabled={page <= 1}
                    onClick={() =>
                      navigate({
                        search: (s) => ({ ...s, page: page - 1 > 1 ? page - 1 : undefined }),
                      })
                    }
                    className="h-7 px-2 rounded border border-border bg-background hover:bg-secondary disabled:opacity-40"
                    aria-label="Page précédente"
                  >
                    ‹
                  </button>
                  <button
                    disabled={page >= pageCount}
                    onClick={() => navigate({ search: (s) => ({ ...s, page: page + 1 }) })}
                    className="h-7 px-2 rounded border border-border bg-background hover:bg-secondary disabled:opacity-40"
                    aria-label="Page suivante"
                  >
                    ›
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {isAdmin && <CategoryManagerDialog open={categoriesOpen} onOpenChange={setCategoriesOpen} />}
      <DocumentFormDialog
        open={Boolean(search.upload)}
        onOpenChange={(open) =>
          navigate({ search: (s) => ({ ...s, upload: open || undefined }), replace: true })
        }
        onCreated={(id) => navigate({ to: "/documents/$id", params: { id } })}
      />
    </div>
  );
}
