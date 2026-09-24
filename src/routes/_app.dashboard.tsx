import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileWarning,
  Package,
  Wrench,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth, useIsAdmin } from "@/features/auth/use-auth";
import { initials } from "@/features/auth/roles";
import { CriticalityDots } from "@/features/equipment/components/CriticalityDots";
import {
  brokenEquipmentQuery,
  dashboardSummaryQuery,
  localToday,
  recentActivityQuery,
  upcomingInterventionsQuery,
  type DashboardSummary,
} from "@/features/dashboard/dashboard-api";
import { INTERVENTION_STATUS, PRIORITY_LABELS } from "@/features/interventions/intervention-model";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — ForgeOS GMAO" }] }),
  component: Dashboard,
});

const longDate = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

function Dashboard() {
  const auth = useAuth();
  const isAdmin = useIsAdmin();
  const today = localToday();
  const summary = useQuery(dashboardSummaryQuery(today));
  const s = summary.data;

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        eyebrow={`Vue d'ensemble · ${longDate.format(new Date())}`}
        title={
          isAdmin
            ? "Centre de pilotage maintenance"
            : `Bonjour ${auth.fullName?.split(" ")[0] ?? ""}`.trim()
        }
        description={
          isAdmin
            ? "Ce qui demande votre attention aujourd'hui."
            : "Vos interventions et l'état du parc."
        }
      />

      {summary.isError && (
        <div className="mb-6 rounded-md border border-critical/30 bg-critical/5 px-4 py-3 text-sm text-critical">
          Impossible de charger les indicateurs : {summary.error.message}
        </div>
      )}

      {s && s.equipment.total === 0 && isAdmin && <GettingStarted />}

      <KpiRow s={s} isAdmin={isAdmin} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <UpcomingCard userId={isAdmin ? null : auth.userId} today={today} />
          <ActivityCard />
        </div>
        <div className="space-y-6">
          <FleetCard s={s} />
          <BrokenCard />
          {s && s.documents.expiring_30d + s.documents.expired > 0 && <DocumentsAlert s={s} />}
        </div>
      </div>
    </div>
  );
}

/* ---------- KPI ---------- */

function KpiRow({ s, isAdmin }: { s: DashboardSummary | undefined; isAdmin: boolean }) {
  const i = s?.interventions;
  const v = (n: number | undefined) => (n === undefined ? "—" : String(n));

  // Chaque carte mène à la liste filtrée correspondante : un chiffre doit toujours être « cliquable vers le détail ».
  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {isAdmin ? (
        <>
          <Kpi
            label="À valider"
            value={v(i?.to_validate)}
            hint="Soumises par les techniciens"
            tone={i && i.to_validate > 0 ? "accent" : undefined}
            icon={<ClipboardCheck className="size-4" />}
            link={{ to: "/interventions", search: { view: "to_validate" } }}
          />
          <Kpi
            label="En retard"
            value={v(i?.overdue)}
            hint="Échéance dépassée, non soumises"
            tone={i && i.overdue > 0 ? "critical" : undefined}
            icon={<CalendarClock className="size-4" />}
            link={{ to: "/interventions", search: { view: "open" } }}
          />
          <Kpi
            label="Ouvertes"
            value={v(i?.open)}
            hint="À faire + en cours"
            icon={<Wrench className="size-4" />}
            link={{ to: "/interventions", search: { view: "open" } }}
          />
        </>
      ) : (
        <>
          <Kpi
            label="Mes interventions"
            value={v(i?.mine_open)}
            hint="À faire + en cours"
            tone={i && i.mine_open > 0 ? "accent" : undefined}
            icon={<Wrench className="size-4" />}
            link={{ to: "/interventions", search: { view: "mine" } }}
          />
          <Kpi
            label="Mes retards"
            value={v(i?.mine_overdue)}
            hint="Échéance dépassée"
            tone={i && i.mine_overdue > 0 ? "critical" : undefined}
            icon={<CalendarClock className="size-4" />}
            link={{ to: "/interventions", search: { view: "mine" } }}
          />
          <Kpi
            label="En attente de validation"
            value={v(i?.mine_submitted)}
            hint="Soumises, verrouillées"
            icon={<ClipboardCheck className="size-4" />}
            link={{ to: "/interventions", search: { view: "mine" } }}
          />
        </>
      )}
      <Kpi
        label="Équipements en panne"
        value={v(s?.equipment.broken_down)}
        hint={s ? `sur ${s.equipment.total} suivis` : ""}
        tone={s && s.equipment.broken_down > 0 ? "critical" : undefined}
        icon={<AlertTriangle className="size-4" />}
        link={{ to: "/equipment", search: { status: "broken_down" } }}
      />
    </section>
  );
}

type KpiLink =
  | { to: "/interventions"; search: { view: "to_validate" | "open" | "mine" } }
  | { to: "/equipment"; search: { status: "broken_down" } };

function Kpi({
  label,
  value,
  hint,
  tone,
  icon,
  link,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "accent" | "critical";
  icon: ReactNode;
  link: KpiLink;
}) {
  return (
    <Link
      {...link}
      className="group rounded-xl border border-border bg-card p-5 shadow-card hover:border-foreground/20 transition-colors"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
          {label}
        </div>
        <div
          className={cn(
            "size-7 rounded-md flex items-center justify-center",
            tone === "critical"
              ? "bg-critical/10 text-critical"
              : tone === "accent"
                ? "bg-accent/10 text-accent"
                : "bg-secondary text-foreground/60",
          )}
        >
          {icon}
        </div>
      </div>
      <div
        className={cn(
          "text-3xl font-bold tracking-tight font-mono",
          tone === "critical" && "text-critical",
        )}
      >
        {value}
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground flex items-center justify-between">
        <span>{hint}</span>
        <ChevronRight className="size-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </Link>
  );
}

/* ---------- Colonne principale ---------- */

function UpcomingCard({ userId, today }: { userId: string | null; today: string }) {
  const { data, isPending } = useQuery(upcomingInterventionsQuery(userId));
  return (
    <Card>
      <CardHeader
        title={userId ? "Mes prochaines interventions" : "Prochaines échéances"}
        subtitle="Interventions à faire ou en cours, les plus urgentes d'abord"
        link={{
          to: "/interventions",
          search: { view: userId ? "mine" : "open" },
          label: "Tout voir",
        }}
      />
      {isPending ? (
        <Empty>Chargement…</Empty>
      ) : !data?.length ? (
        <Empty>
          <CheckCircle2 className="size-5 mx-auto mb-2 text-success" />
          Rien en attente.
        </Empty>
      ) : (
        <ul className="divide-y divide-border">
          {data.map((it) => {
            const overdue = it.due_date !== null && it.due_date < today;
            return (
              <li key={it.id}>
                <Link
                  to="/interventions/$id"
                  params={{ id: it.id }}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-secondary/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{it.title}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {it.equipment ? `${it.equipment.code} · ${it.equipment.name}` : "—"}
                      {" · "}
                      {PRIORITY_LABELS[it.priority]}
                      {!userId &&
                        ` · ${it.assignee?.full_name || it.assignee?.email || "Non assignée"}`}
                    </div>
                  </div>
                  <div
                    className={cn(
                      "hidden sm:block text-xs text-right w-28",
                      overdue ? "text-critical font-semibold" : "text-muted-foreground",
                    )}
                  >
                    {it.due_date
                      ? overdue
                        ? `En retard · ${formatDate(it.due_date)}`
                        : formatDate(it.due_date)
                      : "Sans échéance"}
                  </div>
                  <StatusBadge variant={INTERVENTION_STATUS[it.status].badge}>
                    {INTERVENTION_STATUS[it.status].label}
                  </StatusBadge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

const ACTIVITY_VERB: Record<string, string> = {
  todo: "a créé",
  in_progress: "a démarré",
  submitted: "a soumis",
  done: "a validé",
  cancelled: "a annulé",
};

function activityVerb(from: string | null, to: string): string {
  if (to === "in_progress" && from === "submitted") return "a renvoyé pour reprise";
  if (to === "in_progress" && (from === "done" || from === "cancelled")) return "a rouvert";
  return ACTIVITY_VERB[to] ?? "a modifié";
}

const timeFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function ActivityCard() {
  const { data, isPending } = useQuery(recentActivityQuery);
  return (
    <Card>
      <CardHeader
        title="Activité récente"
        subtitle="Derniers changements de statut des interventions"
      />
      {isPending ? (
        <Empty>Chargement…</Empty>
      ) : !data?.length ? (
        <Empty>Aucune activité pour le moment.</Empty>
      ) : (
        <ul className="px-5 py-4 space-y-4">
          {data.map((e) => {
            const who = e.author?.full_name || e.author?.email || "Système";
            return (
              <li key={e.id} className="flex gap-3 items-start">
                <div className="size-8 rounded-full bg-secondary flex items-center justify-center shrink-0 text-[10px] font-bold text-muted-foreground">
                  {initials(who)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-semibold">{who}</span>{" "}
                    <span className="text-muted-foreground">
                      {activityVerb(e.from_status, e.to_status)}
                    </span>{" "}
                    {e.intervention ? (
                      <Link
                        to="/interventions/$id"
                        params={{ id: e.intervention.id }}
                        className="font-semibold hover:underline"
                      >
                        {e.intervention.title}
                      </Link>
                    ) : (
                      "une intervention"
                    )}
                  </p>
                  {e.reason && (
                    <p className="text-xs italic text-muted-foreground truncate">« {e.reason} »</p>
                  )}
                  <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mt-0.5">
                    {timeFmt.format(new Date(e.changed_at))}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* ---------- Colonne de droite ---------- */

function FleetCard({ s }: { s: DashboardSummary | undefined }) {
  const e = s?.equipment;
  const rows = [
    { label: "En service", count: e?.in_service ?? 0, color: "bg-success" },
    { label: "En panne", count: e?.broken_down ?? 0, color: "bg-critical" },
    { label: "Hors service", count: e?.out_of_service ?? 0, color: "bg-steel" },
  ];
  return (
    <Card>
      <CardHeader
        title="État du parc"
        subtitle={
          e ? `${e.total} équipement${e.total > 1 ? "s" : ""} suivi${e.total > 1 ? "s" : ""}` : "…"
        }
        link={{ to: "/equipment", label: "Équipements" }}
      />
      <div className="p-5 space-y-4">
        {rows.map((r) => {
          const pct = e && e.total > 0 ? (r.count / e.total) * 100 : 0;
          return (
            <div key={r.label}>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="font-mono font-bold">
                  {r.count}
                  <span className="text-muted-foreground font-normal"> · {Math.round(pct)} %</span>
                </span>
              </div>
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div className={`h-full ${r.color}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function BrokenCard() {
  const { data } = useQuery(brokenEquipmentQuery);
  if (!data?.length) return null;
  return (
    <Card>
      <CardHeader title="Équipements en panne" subtitle="Par criticité décroissante" />
      <ul className="divide-y divide-border">
        {data.map((eq) => (
          <li key={eq.id}>
            <Link
              to="/equipment/$id"
              params={{ id: eq.id }}
              className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/40 transition-colors"
            >
              <Package className="size-4 text-critical shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">
                  <span className="font-mono text-[11px] text-muted-foreground mr-1.5">
                    {eq.code}
                  </span>
                  {eq.name}
                </div>
                {eq.location && (
                  <div className="text-[11px] text-muted-foreground truncate">{eq.location}</div>
                )}
              </div>
              <CriticalityDots level={eq.criticality} />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function DocumentsAlert({ s }: { s: DashboardSummary }) {
  return (
    <div className="rounded-xl border border-warning/30 bg-warning/5 p-5">
      <div className="flex items-center gap-2 text-sm font-bold">
        <FileWarning className="size-4 text-warning" /> Documents à renouveler
      </div>
      <p className="text-xs text-muted-foreground mt-1.5">
        {s.documents.expired > 0 &&
          `${s.documents.expired} expiré${s.documents.expired > 1 ? "s" : ""}. `}
        {s.documents.expiring_30d > 0 &&
          `${s.documents.expiring_30d} expire${s.documents.expiring_30d > 1 ? "nt" : ""} dans les 30 jours.`}
      </p>
    </div>
  );
}

function GettingStarted() {
  return (
    <div className="mb-8 rounded-xl border border-accent/30 bg-accent/5 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex-1">
        <div className="text-sm font-bold">Bienvenue ! Commencez par votre parc.</div>
        <p className="text-xs text-muted-foreground mt-1">
          Ajoutez vos équipements, puis votre équipe : le tableau de bord se remplira avec les
          interventions.
        </p>
      </div>
      <div className="flex gap-2">
        <Link
          to="/equipment"
          className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold inline-flex items-center"
        >
          Ajouter un équipement
        </Link>
        <Link
          to="/team"
          className="h-9 px-3 rounded-md border border-border bg-card text-xs font-semibold inline-flex items-center hover:bg-secondary"
        >
          Inviter l'équipe
        </Link>
      </div>
    </div>
  );
}

/* ---------- Briques ---------- */

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
      {children}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="px-5 py-8 text-center text-sm text-muted-foreground">{children}</div>;
}

type HeaderLink =
  | { to: "/interventions"; search: { view: "open" | "mine" }; label: string }
  | { to: "/equipment"; label: string };

function CardHeader({
  title,
  subtitle,
  link,
}: {
  title: string;
  subtitle?: string;
  link?: HeaderLink;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-border">
      <div>
        <div className="text-sm font-bold tracking-tight">{title}</div>
        {subtitle && <div className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</div>}
      </div>
      {link &&
        (link.to === "/interventions" ? (
          <Link
            to={link.to}
            search={link.search}
            className="text-[11px] font-semibold text-accent hover:underline"
          >
            {link.label} →
          </Link>
        ) : (
          <Link to={link.to} className="text-[11px] font-semibold text-accent hover:underline">
            {link.label} →
          </Link>
        ))}
    </div>
  );
}
