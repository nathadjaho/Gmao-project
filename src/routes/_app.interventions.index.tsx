import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Plus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth, useIsAdmin } from "@/features/auth/use-auth";
import { CreateInterventionDialog } from "@/features/interventions/components/CreateInterventionDialog";
import {
  INTERVENTION_PAGE_SIZE,
  interventionListQuery,
  type InterventionView,
} from "@/features/interventions/intervention-api";
import { INTERVENTION_STATUS, PRIORITY_LABELS } from "@/features/interventions/intervention-model";
import { formatDate } from "@/lib/format";

const VIEWS: { id: InterventionView; label: string; adminOnly?: boolean }[] = [
  { id: "mine", label: "Mes interventions" },
  { id: "to_validate", label: "À valider", adminOnly: true },
  { id: "open", label: "En cours / à faire" },
  { id: "all", label: "Toutes" },
];

type Search = { view?: InterventionView; page?: number; create?: boolean };

export const Route = createFileRoute("/_app/interventions/")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    view: VIEWS.some((v) => v.id === s.view) ? (s.view as InterventionView) : undefined,
    page: Number(s.page) > 1 ? Math.floor(Number(s.page)) : undefined,
    create: s.create === true || s.create === "true" ? true : undefined,
  }),
  head: () => ({ meta: [{ title: "Interventions — ForgeOS GMAO" }] }),
  component: InterventionList,
});

function InterventionList() {
  const auth = useAuth();
  const isAdmin = useIsAdmin();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  // Vue par défaut : l'admin arrive sur ce qu'il doit valider, le technicien sur ses tâches.
  const view = search.view ?? (isAdmin ? "to_validate" : "mine");
  const page = search.page ?? 1;

  const { data, isPending, isError, error } = useQuery(
    interventionListQuery({ page, view, userId: auth.userId }),
  );
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / INTERVENTION_PAGE_SIZE));

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        eyebrow="Maintenance"
        title="Interventions"
        description={
          isAdmin
            ? "Planifiez, assignez et validez les interventions."
            : "Vos interventions assignées."
        }
        actions={
          isAdmin && (
            <button
              onClick={() => navigate({ search: (s) => ({ ...s, create: true }) })}
              className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-primary/90"
            >
              <Plus className="size-3.5" /> Nouvelle intervention
            </button>
          )
        }
      />

      <div
        className="flex items-center gap-1 rounded-md border border-border bg-card p-1 mb-4 w-fit"
        role="tablist"
      >
        {VIEWS.filter((v) => isAdmin || !v.adminOnly).map((v) => (
          <button
            key={v.id}
            role="tab"
            aria-selected={view === v.id}
            onClick={() => navigate({ search: (s) => ({ ...s, view: v.id, page: undefined }) })}
            className={`h-7 px-3 text-xs font-semibold rounded transition-colors ${
              view === v.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-card">
        {isPending && <div className="px-4 py-6 text-sm text-muted-foreground">Chargement…</div>}
        {isError && <div className="px-4 py-6 text-sm text-critical">{error.message}</div>}
        {data && data.rows.length === 0 && (
          <div className="px-4 py-12 text-center">
            <ClipboardList className="size-8 mx-auto text-muted-foreground" strokeWidth={1.5} />
            <div className="mt-3 text-sm font-semibold">Aucune intervention dans cette vue</div>
          </div>
        )}
        <ul className="divide-y divide-border">
          {data?.rows.map((i) => {
            const overdue =
              i.due_date &&
              i.due_date < new Date().toISOString().slice(0, 10) &&
              ["todo", "in_progress"].includes(i.status);
            return (
              <li key={i.id}>
                <Link
                  to="/interventions/$id"
                  params={{ id: i.id }}
                  className="px-4 py-3.5 flex items-center gap-4 hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{i.title}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {i.equipment ? `${i.equipment.code} · ${i.equipment.name}` : "—"} ·{" "}
                      {PRIORITY_LABELS[i.priority]}
                      {" · "}
                      {i.assignee?.full_name || i.assignee?.email || "Non assignée"}
                    </div>
                  </div>
                  <div
                    className={`hidden md:block text-xs w-28 text-right ${overdue ? "text-critical font-semibold" : "text-muted-foreground"}`}
                  >
                    {i.due_date ? `Échéance ${formatDate(i.due_date)}` : ""}
                  </div>
                  <StatusBadge variant={INTERVENTION_STATUS[i.status].badge}>
                    {INTERVENTION_STATUS[i.status].label}
                  </StatusBadge>
                </Link>
              </li>
            );
          })}
        </ul>
        {total > INTERVENTION_PAGE_SIZE && (
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

      {isAdmin && (
        <CreateInterventionDialog
          open={Boolean(search.create)}
          onOpenChange={(open) =>
            navigate({ search: (s) => ({ ...s, create: open || undefined }), replace: true })
          }
          onCreated={(id) => navigate({ to: "/interventions/$id", params: { id } })}
        />
      )}
    </div>
  );
}
