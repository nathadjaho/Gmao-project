import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { AlertTriangle, Clock, Bell, CheckCircle2, Filter } from "lucide-react";

export const Route = createFileRoute("/_app/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications & alertes — ForgeOS GMAO" },
      { name: "description", content: "Centre de notifications : alertes critiques, rappels d'échéance et notifications système." },
    ],
  }),
  component: Notifications,
});

const groups = [
  {
    label: "Critique · Action immédiate",
    color: "critical" as const,
    icon: AlertTriangle,
    items: [
      { id: "TR-4410", title: "Vibration anormale détectée", body: "Turbine génératrice B · Dépassement de seuil 14.2 Hz pendant 4 minutes consécutives.", time: "il y a 8 min" },
      { id: "GE-7700", title: "Échec test démarrage groupe", body: "Groupe électrogène secours · Tension de sortie hors tolérance.", time: "il y a 1 h" },
    ],
  },
  {
    label: "Échéances proches",
    color: "warning" as const,
    icon: Clock,
    items: [
      { id: "AC-1180", title: "Préventif échu depuis 48 h", body: "Compresseur d'air principal · Plan trimestriel à exécuter.", time: "Aujourd'hui" },
      { id: "HP-9022", title: "Calibration capteurs à prévoir", body: "Presse hydraulique Alpha · Échéance 16 mai 2026.", time: "Dans 2 jours" },
      { id: "ISO-27", title: "Audit ISO 27001 programmé", body: "Préparation des dossiers de conformité requise.", time: "Dans 5 jours" },
    ],
  },
  {
    label: "Notifications système",
    color: "neutral" as const,
    icon: Bell,
    items: [
      { id: "SYS", title: "Nouvelle version v1.0.4 déployée", body: "Améliorations : module signature, recherche documentaire.", time: "il y a 3 h" },
      { id: "USR", title: "Nouvel opérateur ajouté", body: "C. Moreau · Atelier Nord · Niveau 2", time: "Hier" },
    ],
  },
];

function Notifications() {
  return (
    <div className="p-6 md:p-8 max-w-[1100px] mx-auto">
      <PageHeader
        eyebrow="Centre opérationnel"
        title="Notifications & alertes"
        description="Toutes les alertes critiques, échéances et notifications système consolidées."
        actions={
          <>
            <button className="h-9 px-3 rounded-md border border-border bg-card text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-secondary">
              <Filter className="size-3.5" /> Filtrer
            </button>
            <button className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-primary/90">
              <CheckCircle2 className="size-3.5" /> Tout marquer lu
            </button>
          </>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {[
          { label: "Critique", value: 2, color: "text-critical bg-critical/10" },
          { label: "Avertissement", value: 7, color: "text-warning bg-warning/10" },
          { label: "Information", value: 14, color: "text-accent bg-accent/10" },
          { label: "Lues 24h", value: 38, color: "text-success bg-success/10" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4 shadow-card">
            <div className={`size-7 rounded-md ${s.color} flex items-center justify-center mb-2`}>
              <Bell className="size-3.5" />
            </div>
            <div className="text-2xl font-bold font-mono">{s.value}</div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold mt-0.5">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-8">
        {groups.map((g) => {
          const Icon = g.icon;
          return (
            <section key={g.label}>
              <div className="flex items-center gap-2 mb-3">
                <div
                  className={`size-7 rounded-md flex items-center justify-center ${
                    g.color === "critical"
                      ? "bg-critical/10 text-critical"
                      : g.color === "warning"
                      ? "bg-warning/10 text-warning"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  <Icon className="size-3.5" strokeWidth={2} />
                </div>
                <h2 className="text-sm font-bold uppercase tracking-[0.12em]">{g.label}</h2>
                <span className="text-[10px] font-mono text-muted-foreground">· {g.items.length}</span>
              </div>

              <ul className="rounded-xl border border-border bg-card divide-y divide-border shadow-card overflow-hidden">
                {g.items.map((it) => (
                  <li
                    key={it.id + it.title}
                    className={`px-5 py-4 flex items-start gap-4 hover:bg-secondary/30 transition-colors ${
                      g.color === "critical"
                        ? "border-l-2 border-l-critical"
                        : g.color === "warning"
                        ? "border-l-2 border-l-warning"
                        : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[11px] font-bold text-muted-foreground">{it.id}</span>
                        <span className="font-semibold text-sm">{it.title}</span>
                        {g.color === "critical" && <StatusBadge variant="critical">Critique</StatusBadge>}
                        {g.color === "warning" && <StatusBadge variant="warning">Échéance</StatusBadge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{it.body}</p>
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono shrink-0 whitespace-nowrap">
                      {it.time}
                    </div>
                    <button className="text-[11px] font-semibold text-accent hover:underline shrink-0">
                      Traiter →
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
