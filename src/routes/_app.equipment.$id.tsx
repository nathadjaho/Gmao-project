import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { useState } from "react";
import {
  ChevronRight,
  FileText,
  Download,
  Wrench,
  Calendar,
  Image as ImageIcon,
  Box,
  Activity,
} from "lucide-react";

export const Route = createFileRoute("/_app/equipment/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.id} — Fiche équipement` },
      { name: "description", content: `Fiche technique complète de l'équipement ${params.id} : informations, historique d'interventions, documentation et pièces.` },
    ],
  }),
  component: EquipmentDetail,
});

const tabs = [
  { id: "overview", label: "Vue d'ensemble", icon: Box },
  { id: "history", label: "Historique", icon: Activity },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "parts", label: "Pièces", icon: Wrench },
  { id: "schedule", label: "Planning", icon: Calendar },
];

function EquipmentDetail() {
  const { id } = Route.useParams();
  const [tab, setTab] = useState("overview");

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground font-bold mb-3">
        <Link to="/equipment" className="hover:text-foreground">Équipements</Link>
        <ChevronRight className="size-3" />
        <span className="text-foreground">{id}</span>
      </nav>

      <PageHeader
        title="Turbine génératrice B"
        description={`${id} · AeroSteel Heavy Industries · Mise en service 14/03/2019`}
        actions={
          <>
            <button className="h-9 px-3 rounded-md border border-border bg-card text-xs font-semibold hover:bg-secondary">
              Imprimer fiche
            </button>
            <Link
              to="/intervention"
              className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-primary/90"
            >
              <Wrench className="size-3.5" /> Lancer intervention
            </Link>
          </>
        }
      />

      {/* Status row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Statut" value={<StatusBadge variant="critical">Vibration anormale</StatusBadge>} />
        <Stat label="Criticité" value={<span className="font-bold text-critical">Haute · Niveau 3</span>} />
        <Stat label="Disponibilité 30 j" value={<span className="font-mono font-bold">94.2%</span>} />
        <Stat label="Heures de service" value={<span className="font-mono font-bold">12 488 h</span>} />
      </div>

      {/* Tabs */}
      <div className="border-b border-border mb-6 flex gap-1 overflow-x-auto">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 -mb-px transition-colors ${
                active
                  ? "border-accent text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Photo + specs */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-card">
            <div className="aspect-[16/7] grid-bg bg-secondary/30 relative flex items-center justify-center">
              <div className="size-20 rounded-full bg-card border border-border flex items-center justify-center">
                <ImageIcon className="size-8 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <div className="absolute bottom-3 left-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground bg-card/80 px-2 py-1 rounded">
                Vue technique · Schéma 3D
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 divide-x divide-y divide-border border-t border-border">
              {[
                ["N° série", "SN-992-044-B"],
                ["Modèle", "AeroSteel T-900"],
                ["Tension", "400 V triphasé"],
                ["Puissance", "1.2 MW"],
                ["Régime nominal", "3 600 rpm"],
                ["Garantie", "Jusqu'au 14/03/2027"],
              ].map(([k, v]) => (
                <div key={k} className="px-5 py-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{k}</div>
                  <div className="text-sm font-semibold font-mono">{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Documents */}
          <div className="rounded-xl border border-border bg-card shadow-card">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div className="text-sm font-bold">Documentation associée</div>
              <Link to="/documents" className="text-[11px] font-semibold text-accent hover:underline">
                Centre documentaire →
              </Link>
            </div>
            <ul className="divide-y divide-border">
              {[
                { name: "Manuel utilisateur T-900 v4.2", size: "12.4 MB", type: "PDF" },
                { name: "Schéma électrique principal", size: "3.1 MB", type: "DWG" },
                { name: "Procédure de maintenance trimestrielle", size: "880 KB", type: "PDF" },
                { name: "Rapport d'inspection 04/2026", size: "1.7 MB", type: "PDF" },
              ].map((d) => (
                <li key={d.name} className="px-5 py-3 flex items-center gap-4 hover:bg-secondary/40 transition-colors">
                  <div className="size-9 rounded-md bg-accent/10 text-accent flex items-center justify-center shrink-0">
                    <FileText className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{d.name}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">
                      {d.type} · {d.size}
                    </div>
                  </div>
                  <button className="size-8 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground">
                    <Download className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right rail: timeline */}
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card shadow-card">
            <div className="px-5 py-4 border-b border-border">
              <div className="text-sm font-bold">Timeline d'activité</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">12 derniers événements</div>
            </div>
            <div className="px-5 py-5 relative">
              <div className="absolute left-[28px] top-6 bottom-6 w-px bg-border" />
              <ul className="space-y-5">
                {[
                  { t: "Aujourd'hui · 08:42", title: "Alerte vibration déclenchée", body: "14.2 Hz au-dessus du seuil défini.", color: "critical" },
                  { t: "12 mai · 14:20", title: "OT préventif clôturé", body: "Inspection trimestrielle conforme.", color: "success" },
                  { t: "28 avr. · 09:10", title: "Remplacement joint d'étanchéité", body: "Pièce P-4022 installée par J. Doe.", color: "accent" },
                  { t: "14 mars · 11:05", title: "Calibration capteurs vibration", body: "Tolérance ±0.02 mm validée.", color: "muted" },
                ].map((e, i) => (
                  <li key={i} className="flex gap-4 relative">
                    <div
                      className={`size-9 rounded-full border-2 border-card flex items-center justify-center shrink-0 z-10 ${
                        e.color === "critical"
                          ? "bg-critical/10"
                          : e.color === "success"
                          ? "bg-success/10"
                          : e.color === "accent"
                          ? "bg-accent/10"
                          : "bg-secondary"
                      }`}
                    >
                      <div
                        className={`size-2 rounded-full ${
                          e.color === "critical"
                            ? "bg-critical"
                            : e.color === "success"
                            ? "bg-success"
                            : e.color === "accent"
                            ? "bg-accent"
                            : "bg-muted-foreground"
                        }`}
                      />
                    </div>
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        {e.t}
                      </div>
                      <div className="text-sm font-semibold mt-0.5">{e.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{e.body}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className="text-sm font-bold mb-3">Pièces critiques</div>
            <ul className="space-y-2.5 text-xs">
              {[
                ["Joint d'étanchéité P-4022", "En stock · 14"],
                ["Roulement à billes RB-770", "En stock · 6"],
                ["Capteur vibration CV-12", "Commande en cours"],
                ["Filtre huile FH-902", "Stock faible · 2"],
              ].map(([p, s]) => (
                <li key={p} className="flex justify-between gap-3">
                  <span>{p}</span>
                  <span className="text-muted-foreground font-mono text-[11px] text-right shrink-0">{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-card">
      <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-1.5">
        {label}
      </div>
      <div className="text-sm">{value}</div>
    </div>
  );
}
