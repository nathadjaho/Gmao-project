import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Search, SlidersHorizontal, Plus, ArrowUpDown, MoreHorizontal } from "lucide-react";

export const Route = createFileRoute("/_app/equipment")({
  head: () => ({
    meta: [
      { title: "Équipements — ForgeOS GMAO" },
      { name: "description", content: "Liste complète du parc d'équipements industriels avec statut, criticité et prochaines maintenances." },
    ],
  }),
  component: EquipmentList,
});

type Row = {
  id: string;
  name: string;
  zone: string;
  status: "operational" | "warning" | "critical" | "completed";
  statusLabel: string;
  criticality: 1 | 2 | 3;
  next: string;
  owner: string;
};

const rows: Row[] = [
  { id: "TX-001", name: "Centrifugeuse industrielle", zone: "Atelier A · Ligne 1", status: "operational", statusLabel: "Opérationnel", criticality: 2, next: "12 juin 2026", owner: "J. Doe" },
  { id: "TR-4410", name: "Turbine génératrice B", zone: "Hall turbines · Bay 4", status: "critical", statusLabel: "Vibration anormale", criticality: 3, next: "Aujourd'hui", owner: "M. Lefebvre" },
  { id: "HP-9022", name: "Presse hydraulique Alpha", zone: "Hall principal · Poste 02", status: "warning", statusLabel: "Pression dérive", criticality: 3, next: "16 mai 2026", owner: "Y. Bernard" },
  { id: "AC-1180", name: "Compresseur d'air principal", zone: "Local technique TGBT", status: "warning", statusLabel: "Préventif échu", criticality: 2, next: "Demain", owner: "Y. Bernard" },
  { id: "HVAC-04", name: "Centrale CTA Unit 4", zone: "Toiture · Bâtiment Nord", status: "operational", statusLabel: "Opérationnel", criticality: 1, next: "30 juin 2026", owner: "C. Moreau" },
  { id: "PM-220", name: "Pompe principale circuit B", zone: "Sous-sol · Salle P-2", status: "operational", statusLabel: "Opérationnel", criticality: 2, next: "8 juillet 2026", owner: "J. Doe" },
  { id: "GE-7700", name: "Groupe électrogène secours", zone: "Local énergie", status: "completed", statusLabel: "Test conforme", criticality: 3, next: "1 août 2026", owner: "M. Lefebvre" },
  { id: "FR-3301", name: "Convoyeur frigorifique 12", zone: "Zone froide · Tunnel 3", status: "operational", statusLabel: "Opérationnel", criticality: 1, next: "21 mai 2026", owner: "C. Moreau" },
  { id: "RB-9001", name: "Bras robotisé soudure", zone: "Atelier C · Cellule 9", status: "operational", statusLabel: "Opérationnel", criticality: 2, next: "5 juin 2026", owner: "Y. Bernard" },
];

const filters = ["Tous", "Critiques", "Préventif dû", "Opérationnels", "Hors service"];

export function EquipmentList() {
  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        eyebrow="Parc machines"
        title="Équipements"
        description="1 248 équipements supervisés sur 7 sites — recherche, filtres et accès rapide aux fiches."
        actions={
          <>
            <button className="h-9 px-3 rounded-md border border-border bg-card text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-secondary">
              Importer CSV
            </button>
            <button className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-primary/90">
              <Plus className="size-3.5" /> Ajouter un équipement
            </button>
          </>
        }
      />

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 h-9 px-3 w-80 max-w-full rounded-md border border-input bg-card text-sm">
          <Search className="size-4 text-muted-foreground" />
          <input
            placeholder="Rechercher par ID, nom, zone…"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex items-center gap-1 rounded-md border border-border bg-card p-1">
          {filters.map((f, i) => (
            <button
              key={f}
              className={`h-7 px-3 text-xs font-semibold rounded transition-colors ${
                i === 0 ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <button className="h-9 px-3 rounded-md border border-border bg-card text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-secondary">
          <SlidersHorizontal className="size-3.5" /> Filtres avancés
        </button>
        <div className="ml-auto text-xs text-muted-foreground font-mono">{rows.length} résultats</div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40">
            <tr className="text-left text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              <Th>Équipement</Th>
              <Th>Zone</Th>
              <Th>Statut</Th>
              <Th>
                <span className="inline-flex items-center gap-1">Criticité <ArrowUpDown className="size-3" /></span>
              </Th>
              <Th>Prochaine maintenance</Th>
              <Th>Responsable</Th>
              <Th className="text-right">Action</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-secondary/30 transition-colors group">
                <td className="px-4 py-3.5">
                  <Link to="/equipment/$id" params={{ id: r.id }} className="block">
                    <div className="font-semibold">{r.name}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">{r.id}</div>
                  </Link>
                </td>
                <td className="px-4 py-3.5 text-muted-foreground text-xs">{r.zone}</td>
                <td className="px-4 py-3.5">
                  <StatusBadge variant={r.status}>{r.statusLabel}</StatusBadge>
                </td>
                <td className="px-4 py-3.5">
                  <CriticalityDots level={r.criticality} />
                </td>
                <td className="px-4 py-3.5 text-xs">
                  <span
                    className={
                      r.next === "Aujourd'hui" || r.next === "Demain"
                        ? "font-semibold text-warning"
                        : "text-foreground"
                    }
                  >
                    {r.next}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="size-6 rounded-full bg-secondary text-foreground/70 flex items-center justify-center text-[10px] font-bold">
                      {r.owner.split(" ").map((p) => p[0]).join("")}
                    </div>
                    <span className="text-xs">{r.owner}</span>
                  </div>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <Link
                    to="/equipment/$id"
                    params={{ id: r.id }}
                    className="text-[11px] font-semibold text-accent opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Voir fiche →
                  </Link>
                  <button className="ml-2 size-7 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground">
                    <MoreHorizontal className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <div>Page 1 sur 138</div>
          <div className="flex gap-1">
            <button className="h-7 px-2 rounded border border-border bg-background hover:bg-secondary">‹</button>
            <button className="h-7 px-2 rounded border border-border bg-primary text-primary-foreground">1</button>
            <button className="h-7 px-2 rounded border border-border bg-background hover:bg-secondary">2</button>
            <button className="h-7 px-2 rounded border border-border bg-background hover:bg-secondary">3</button>
            <button className="h-7 px-2 rounded border border-border bg-background hover:bg-secondary">›</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 ${className}`}>{children}</th>;
}

function CriticalityDots({ level }: { level: 1 | 2 | 3 }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className={`size-1.5 rounded-full ${
            i <= level ? (level === 3 ? "bg-critical" : level === 2 ? "bg-warning" : "bg-success") : "bg-border"
          }`}
        />
      ))}
    </div>
  );
}
