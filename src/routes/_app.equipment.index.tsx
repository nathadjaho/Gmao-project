import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Plus, Search, PackageOpen } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { useIsAdmin } from "@/features/auth/use-auth";
import { CriticalityDots } from "@/features/equipment/components/CriticalityDots";
import { EquipmentFormDialog } from "@/features/equipment/components/EquipmentFormDialog";
import { EQUIPMENT_PAGE_SIZE, equipmentListQuery } from "@/features/equipment/equipment-api";
import { EQUIPMENT_STATUS, type EquipmentStatus } from "@/features/equipment/equipment-model";

type Search = { page?: number; q?: string; status?: EquipmentStatus };

// L'état de la liste (page, recherche, filtre) vit dans l'URL : lien partageable,
// bouton « retour » fonctionnel, rechargement sans perte.
export const Route = createFileRoute("/_app/equipment/")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    page: Number(s.page) > 1 ? Math.floor(Number(s.page)) : undefined,
    q: typeof s.q === "string" && s.q.trim() ? s.q.trim() : undefined,
    status:
      typeof s.status === "string" && s.status in EQUIPMENT_STATUS
        ? (s.status as EquipmentStatus)
        : undefined,
  }),
  head: () => ({ meta: [{ title: "Équipements — ForgeOS GMAO" }] }),
  component: EquipmentList,
});

const FILTERS: { label: string; status?: EquipmentStatus }[] = [
  { label: "Tous" },
  { label: "En service", status: "in_service" },
  { label: "En panne", status: "broken_down" },
  { label: "Hors service", status: "out_of_service" },
];

function EquipmentList() {
  const search = Route.useSearch();
  const page = search.page ?? 1;
  const navigate = useNavigate({ from: Route.fullPath });
  const isAdmin = useIsAdmin();
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState(search.q ?? "");

  // Recherche « debounced » : on attend 300 ms après la frappe avant d'interroger la base.
  useEffect(() => {
    const t = setTimeout(() => {
      const q = draft.trim() || undefined;
      if (q !== search.q)
        navigate({ search: (s) => ({ ...s, q, page: undefined }), replace: true });
    }, 300);
    return () => clearTimeout(t);
  }, [draft, search.q, navigate]);

  const { data, isPending, isError, error, isFetching } = useQuery(
    equipmentListQuery({ page, q: search.q, status: search.status }),
  );
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / EQUIPMENT_PAGE_SIZE));

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        eyebrow="Parc machines"
        title="Équipements"
        description={
          isPending
            ? "Chargement du parc…"
            : `${total} équipement${total > 1 ? "s" : ""} dans votre organisation.`
        }
        actions={
          isAdmin && (
            <button
              onClick={() => setCreateOpen(true)}
              className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-primary/90"
            >
              <Plus className="size-3.5" /> Ajouter un équipement
            </button>
          )
        }
      />

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 h-9 px-3 w-80 max-w-full rounded-md border border-input bg-card text-sm">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Rechercher par code, nom, localisation…"
            aria-label="Rechercher un équipement"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
        </div>
        <div
          className="flex items-center gap-1 rounded-md border border-border bg-card p-1"
          role="group"
          aria-label="Filtrer par statut"
        >
          {FILTERS.map((f) => {
            const active = search.status === f.status;
            return (
              <button
                key={f.label}
                aria-pressed={active}
                onClick={() =>
                  navigate({ search: (s) => ({ ...s, status: f.status, page: undefined }) })
                }
                className={`h-7 px-3 text-xs font-semibold rounded transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
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
        <table className="w-full text-sm">
          <thead className="bg-secondary/40">
            <tr className="text-left text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              <th className="px-4 py-3">Équipement</th>
              <th className="px-4 py-3 hidden md:table-cell">Catégorie</th>
              <th className="px-4 py-3 hidden md:table-cell">Localisation</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Criticité</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isPending &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={5} className="px-4 py-4">
                    <div className="h-4 w-1/3 rounded bg-secondary animate-pulse" />
                  </td>
                </tr>
              ))}
            {data?.rows.map((r) => (
              <tr key={r.id} className="hover:bg-secondary/30 transition-colors">
                <td className="px-4 py-3.5">
                  <Link to="/equipment/$id" params={{ id: r.id }} className="block">
                    <div className="font-semibold">{r.name}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">{r.code}</div>
                  </Link>
                </td>
                <td className="px-4 py-3.5 text-muted-foreground text-xs hidden md:table-cell">
                  {r.category ?? "—"}
                </td>
                <td className="px-4 py-3.5 text-muted-foreground text-xs hidden md:table-cell">
                  {r.location ?? "—"}
                </td>
                <td className="px-4 py-3.5">
                  <StatusBadge variant={EQUIPMENT_STATUS[r.status].badge}>
                    {EQUIPMENT_STATUS[r.status].label}
                  </StatusBadge>
                </td>
                <td className="px-4 py-3.5">
                  <CriticalityDots level={r.criticality} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {isError && (
          <div className="px-4 py-8 text-center text-sm text-critical">
            Impossible de charger les équipements : {error.message}
          </div>
        )}
        {data && data.rows.length === 0 && (
          <div className="px-4 py-12 text-center">
            <PackageOpen className="size-8 mx-auto text-muted-foreground" strokeWidth={1.5} />
            <div className="mt-3 text-sm font-semibold">
              {search.q || search.status
                ? "Aucun équipement ne correspond à ces critères"
                : "Aucun équipement pour l'instant"}
            </div>
            {isAdmin && !search.q && !search.status && (
              <button
                onClick={() => setCreateOpen(true)}
                className="mt-3 text-xs font-semibold text-accent hover:underline"
              >
                Ajouter le premier équipement
              </button>
            )}
          </div>
        )}

        {total > EQUIPMENT_PAGE_SIZE && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <div>
              Page {page} sur {pageCount}
            </div>
            <div className="flex gap-1">
              <button
                disabled={page <= 1}
                onClick={() =>
                  navigate({ search: (s) => ({ ...s, page: page - 1 > 1 ? page - 1 : undefined }) })
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

      <EquipmentFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => navigate({ to: "/equipment/$id", params: { id } })}
      />
    </div>
  );
}
