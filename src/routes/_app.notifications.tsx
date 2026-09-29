import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import {
  NOTIFICATION_PAGE_SIZE,
  NOTIFICATION_TYPES,
  markAllRead,
  markRead,
  notificationKeys,
  notificationListQuery,
  type NotificationRow,
} from "@/features/notifications/notification-api";
import { cn } from "@/lib/utils";

type Search = { unread?: boolean; page?: number };

export const Route = createFileRoute("/_app/notifications")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    unread: s.unread === true || s.unread === "true" ? true : undefined,
    page: Number(s.page) > 1 ? Math.floor(Number(s.page)) : undefined,
  }),
  head: () => ({ meta: [{ title: "Notifications — ForgeOS GMAO" }] }),
  component: Notifications,
});

const TONE_CLASS = {
  critical: "bg-critical/10 text-critical",
  warning: "bg-warning/10 text-warning",
  accent: "bg-accent/10 text-accent",
  neutral: "bg-secondary text-muted-foreground",
} as const;

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });

/** « il y a 5 min », « il y a 3 h », sinon la date. */
function relativeTime(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return dateTime.format(new Date(iso));
}

function Notifications() {
  const search = Route.useSearch();
  const page = search.page ?? 1;
  const unreadOnly = Boolean(search.unread);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isPending, isError, error } = useQuery(notificationListQuery({ page, unreadOnly }));
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / NOTIFICATION_PAGE_SIZE));

  const refresh = () => queryClient.invalidateQueries({ queryKey: notificationKeys.all });

  const readOne = useMutation({ mutationFn: markRead, onSuccess: refresh });
  const readAll = useMutation({
    mutationFn: markAllRead,
    onSuccess: async () => {
      await refresh();
      toast.success("Tout est marqué comme lu");
    },
    onError: (e) => toast.error(e.message),
  });

  // Ouvrir une notification = la marquer lue + aller sur l'objet concerné.
  function open(n: NotificationRow) {
    if (!n.read_at) readOne.mutate(n.id);
    if (n.entity_type === "intervention")
      navigate({ to: "/interventions/$id", params: { id: n.entity_id } });
    else if (n.entity_type === "document")
      navigate({ to: "/documents/$id", params: { id: n.entity_id } });
  }

  return (
    <div className="p-6 md:p-8 max-w-[1000px] mx-auto">
      <PageHeader
        eyebrow="Centre d'alertes"
        title="Notifications"
        description="Assignations, validations, retards et documents à renouveler."
        actions={
          <button
            onClick={() => readAll.mutate()}
            disabled={readAll.isPending}
            className="h-9 px-3 rounded-md border border-border bg-card text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-secondary disabled:opacity-60"
          >
            <CheckCheck className="size-3.5" /> Tout marquer comme lu
          </button>
        }
      />

      <div
        className="flex items-center gap-1 rounded-md border border-border bg-card p-1 mb-4 w-fit"
        role="group"
      >
        {[
          { label: "Toutes", unread: undefined },
          { label: "Non lues", unread: true },
        ].map((f) => (
          <button
            key={f.label}
            aria-pressed={unreadOnly === Boolean(f.unread)}
            onClick={() => navigate({ to: "/notifications", search: { unread: f.unread } })}
            className={cn(
              "h-7 px-3 text-xs font-semibold rounded transition-colors",
              unreadOnly === Boolean(f.unread)
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-card">
        {isPending && <div className="px-4 py-6 text-sm text-muted-foreground">Chargement…</div>}
        {isError && <div className="px-4 py-6 text-sm text-critical">{error.message}</div>}
        {data && data.rows.length === 0 && (
          <div className="px-4 py-12 text-center">
            <Bell className="size-8 mx-auto text-muted-foreground" strokeWidth={1.5} />
            <div className="mt-3 text-sm font-semibold">
              {unreadOnly ? "Aucune notification non lue" : "Aucune notification"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Vous serez prévenu ici des assignations, validations, retards et échéances.
            </p>
          </div>
        )}
        <ul className="divide-y divide-border">
          {data?.rows.map((n) => {
            const meta = NOTIFICATION_TYPES[n.type];
            const Icon = meta.icon;
            const unread = !n.read_at;
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => open(n)}
                  className={cn(
                    "w-full text-left px-5 py-4 flex items-start gap-4 hover:bg-secondary/40 transition-colors",
                    unread && "bg-accent/[0.04]",
                  )}
                >
                  <div
                    className={cn(
                      "size-9 rounded-md flex items-center justify-center shrink-0",
                      TONE_CLASS[meta.tone],
                    )}
                  >
                    <Icon className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {meta.label}
                    </div>
                    <p
                      className={cn(
                        "text-sm mt-0.5",
                        unread ? "font-semibold" : "text-foreground/80",
                      )}
                    >
                      {n.message}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {relativeTime(n.created_at)}
                    </span>
                    {unread && (
                      <span className="size-2 rounded-full bg-accent" aria-label="Non lue" />
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
        {total > NOTIFICATION_PAGE_SIZE && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <div>
              Page {page} sur {pageCount}
            </div>
            <div className="flex gap-1">
              <button
                disabled={page <= 1}
                onClick={() =>
                  navigate({
                    to: "/notifications",
                    search: { unread: search.unread, page: page - 1 > 1 ? page - 1 : undefined },
                  })
                }
                className="h-7 px-2 rounded border border-border bg-background hover:bg-secondary disabled:opacity-40"
                aria-label="Page précédente"
              >
                ‹
              </button>
              <button
                disabled={page >= pageCount}
                onClick={() =>
                  navigate({
                    to: "/notifications",
                    search: { unread: search.unread, page: page + 1 },
                  })
                }
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
  );
}
