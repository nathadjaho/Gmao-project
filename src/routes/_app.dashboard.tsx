import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import {
  AlertTriangle,
  TrendingUp,
  Clock,
  Activity,
  ChevronRight,
  Wrench,
  Calendar,
  CheckCircle2,
  Cog,
  Gauge,
} from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — ForgeOS GMAO" },
      { name: "description", content: "Vue d'ensemble du parc, KPIs maintenance, alertes critiques et planning d'opérations." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        eyebrow="Vue d'ensemble · 14 mai 2026"
        title="Centre de pilotage maintenance"
        description="État du parc, opérations en cours et alertes critiques en temps réel."
        actions={
          <>
            <button className="h-9 px-3 rounded-md border border-border bg-card text-xs font-semibold hover:bg-secondary transition-colors">
              Exporter rapport
            </button>
            <Link
              to="/interventions"
              className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-primary/90"
            >
              <Wrench className="size-3.5" />
              Nouvelle intervention
            </Link>
          </>
        }
      />

      {/* KPIs */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard label="Disponibilité parc" value="98.4%" delta="+1.2%" deltaPositive icon={<Gauge className="size-4" />}>
          <Spark values={[60, 68, 72, 65, 78, 82, 90, 94, 92, 98]} color="success" />
        </KpiCard>
        <KpiCard label="Interventions actives" value="12" delta="3 critiques" deltaWarning icon={<Wrench className="size-4" />}>
          <div className="flex items-end gap-1 h-10 mt-2">
            {[40, 30, 60, 45, 70, 55, 80].map((h, i) => (
              <div key={i} className="flex-1 bg-warning/60 rounded-sm" style={{ height: `${h}%` }} />
            ))}
          </div>
        </KpiCard>
        <KpiCard label="MTBF moyen" value="242 h" delta="+12.4%" deltaPositive icon={<Clock className="size-4" />}>
          <Spark values={[40, 50, 45, 60, 55, 70, 78, 75, 82, 88]} color="accent" />
        </KpiCard>
        <KpiCard label="Conformité ordre" value="96.7%" delta="Objectif 95%" icon={<CheckCircle2 className="size-4" />}>
          <div className="mt-3 h-1.5 rounded-full bg-secondary overflow-hidden">
            <div className="h-full bg-accent" style={{ width: "96.7%" }} />
          </div>
        </KpiCard>
      </section>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Critical alerts */}
          <Card>
            <CardHeader title="Alertes critiques" subtitle="3 équipements requièrent une action immédiate" actionLabel="Tout voir" />
            <ul className="divide-y divide-border">
              {[
                {
                  id: "TR-4410",
                  name: "Turbine génératrice B",
                  zone: "Atelier B · Ligne 4",
                  level: "critical" as const,
                  msg: "Vibration anormale · 14.2 Hz au-dessus du seuil",
                  time: "il y a 8 min",
                },
                {
                  id: "HP-9022",
                  name: "Presse hydraulique Alpha",
                  zone: "Hall principal · Poste 02",
                  level: "warning" as const,
                  msg: "Pression circuit secondaire en dérive",
                  time: "il y a 22 min",
                },
                {
                  id: "AC-1180",
                  name: "Compresseur d'air principal",
                  zone: "Local technique · TGBT",
                  level: "warning" as const,
                  msg: "Maintenance préventive échue depuis 48 h",
                  time: "il y a 1 h",
                },
              ].map((a) => (
                <li key={a.id} className="flex items-start gap-4 px-5 py-4 hover:bg-secondary/40 transition-colors">
                  <div
                    className={`size-9 rounded-md flex items-center justify-center shrink-0 ${
                      a.level === "critical" ? "bg-critical/10 text-critical" : "bg-warning/10 text-warning"
                    }`}
                  >
                    <AlertTriangle className="size-4" strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[11px] font-bold text-muted-foreground">{a.id}</span>
                      <span className="font-semibold text-sm">{a.name}</span>
                      <StatusBadge variant={a.level}>
                        {a.level === "critical" ? "Critique" : "Avertissement"}
                      </StatusBadge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {a.zone} · {a.msg}
                    </p>
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono shrink-0">{a.time}</div>
                  <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                </li>
              ))}
            </ul>
          </Card>

          {/* Activity */}
          <Card>
            <CardHeader title="Activité récente" subtitle="Dernières actions opérateurs sur la plateforme" />
            <div className="px-5 py-4 relative">
              <div className="absolute left-[28px] top-6 bottom-6 w-px bg-border" />
              <ul className="space-y-5">
                {[
                  { who: "J. Doe", what: "a clôturé l'OT", target: "#WO-4022 Pompe hydraulique", time: "08:42", color: "success" },
                  { who: "M. Lefebvre", what: "a validé la fiche", target: "TX-001 Centrifugeuse", time: "08:15", color: "accent" },
                  { who: "Système", what: "a généré un OT préventif", target: "HVAC Unit 4", time: "07:30", color: "muted" },
                  { who: "Y. Bernard", what: "a téléversé un rapport", target: "Inspection trimestrielle Q2", time: "07:12", color: "muted" },
                ].map((e, i) => (
                  <li key={i} className="flex gap-4 items-start relative">
                    <div className="size-9 rounded-full bg-card border-2 border-border flex items-center justify-center shrink-0 z-10 text-[10px] font-bold text-muted-foreground">
                      {e.who.split(" ").map((p) => p[0]).join("")}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm">
                        <span className="font-semibold">{e.who}</span>{" "}
                        <span className="text-muted-foreground">{e.what}</span>{" "}
                        <span className="font-semibold">{e.target}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mt-0.5">
                        {e.time} · Aujourd'hui
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </div>

        {/* Right rail */}
        <div className="space-y-6">
          {/* Fleet status */}
          <Card>
            <CardHeader title="État du parc" subtitle="1 248 équipements suivis" />
            <div className="p-5 space-y-4">
              {[
                { label: "Opérationnel", count: 1178, color: "bg-success", pct: 94.4 },
                { label: "En maintenance", count: 42, color: "bg-accent", pct: 3.4 },
                { label: "Avertissement", count: 19, color: "bg-warning", pct: 1.5 },
                { label: "Critique / arrêt", count: 9, color: "bg-critical", pct: 0.7 },
              ].map((s) => (
                <div key={s.label}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">{s.label}</span>
                    <span className="font-mono font-bold">{s.count}</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className={`h-full ${s.color}`} style={{ width: `${s.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Calendar */}
          <Card>
            <CardHeader title="Planning" subtitle="14 — 18 mai" actionLabel="Calendrier" />
            <div className="p-5 space-y-3">
              {[
                { day: "MER 14", op: "Inspection turbines", count: 4, accent: true },
                { day: "JEU 15", op: "Maintenance préventive HVAC", count: 6 },
                { day: "VEN 16", op: "Calibration capteurs", count: 2 },
                { day: "LUN 19", op: "Audit ISO 27001", count: 1, warning: true },
              ].map((d) => (
                <div
                  key={d.day}
                  className={`flex items-center gap-3 p-2.5 rounded-md border ${
                    d.accent
                      ? "border-accent/30 bg-accent/5"
                      : d.warning
                      ? "border-warning/30 bg-warning/5"
                      : "border-border"
                  }`}
                >
                  <div className="font-mono text-[10px] font-bold text-muted-foreground w-12">{d.day}</div>
                  <div className="flex-1 text-xs font-medium">{d.op}</div>
                  <div className="text-[10px] font-mono text-muted-foreground">{d.count} OT</div>
                </div>
              ))}
            </div>
          </Card>

          <div className="rounded-xl bg-primary text-primary-foreground p-5 relative overflow-hidden">
            <div className="absolute -right-8 -bottom-8 size-32 rounded-full bg-accent/20 blur-2xl" />
            <Cog className="size-5 text-accent mb-3" />
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-foreground/60 mb-1">
              Indicateur global
            </div>
            <div className="text-3xl font-bold tracking-tight">Conformité 96,7%</div>
            <p className="text-xs text-primary-foreground/70 mt-2">
              Objectif annuel atteint sur 11 des 12 lignes opérationnelles.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">{children}</div>;
}

function CardHeader({
  title,
  subtitle,
  actionLabel,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-border">
      <div>
        <div className="text-sm font-bold tracking-tight">{title}</div>
        {subtitle && <div className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</div>}
      </div>
      {actionLabel && (
        <button className="text-[11px] font-semibold text-accent hover:underline">{actionLabel}</button>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  delta,
  deltaPositive,
  deltaWarning,
  icon,
  children,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaPositive?: boolean;
  deltaWarning?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-start justify-between mb-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">{label}</div>
        <div className="size-7 rounded-md bg-secondary text-foreground/60 flex items-center justify-center">
          {icon}
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <div className="text-3xl font-bold tracking-tight font-mono">{value}</div>
        {delta && (
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              deltaPositive
                ? "bg-success/10 text-success"
                : deltaWarning
                ? "bg-warning/10 text-warning"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            {deltaPositive && <TrendingUp className="inline size-3 mr-0.5" />}
            {delta}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function Spark({ values, color }: { values: number[]; color: "success" | "accent" }) {
  const max = Math.max(...values);
  const points = values
    .map((v, i) => `${(i / (values.length - 1)) * 100},${100 - (v / max) * 90}`)
    .join(" ");
  const stroke = color === "success" ? "var(--success)" : "var(--accent)";
  return (
    <svg viewBox="0 0 100 50" className="w-full h-10 mt-3" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
