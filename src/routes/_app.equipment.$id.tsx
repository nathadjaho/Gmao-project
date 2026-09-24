import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronRight, FileText, Pencil, Wrench } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { useIsAdmin } from "@/features/auth/use-auth";
import { CriticalityDots } from "@/features/equipment/components/CriticalityDots";
import { EquipmentFormDialog } from "@/features/equipment/components/EquipmentFormDialog";
import { equipmentDetailQuery } from "@/features/equipment/equipment-api";
import { EQUIPMENT_STATUS } from "@/features/equipment/equipment-model";
import {
  INTERVENTION_STATUS,
  INTERVENTION_TYPE_LABELS,
} from "@/features/interventions/intervention-model";
import { formatBytes, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_app/equipment/$id")({
  head: () => ({ meta: [{ title: "Fiche équipement — ForgeOS GMAO" }] }),
  component: EquipmentDetail,
});

function EquipmentDetail() {
  const { id } = Route.useParams();
  const isAdmin = useIsAdmin();
  const [editOpen, setEditOpen] = useState(false);
  const { data: eq, isPending, isError, error } = useQuery(equipmentDetailQuery(id));

  if (isPending) {
    return <div className="p-8 text-sm text-muted-foreground">Chargement de la fiche…</div>;
  }
  if (isError || !eq) {
    return (
      <div className="p-8 max-w-xl">
        <div className="text-sm font-semibold">Équipement introuvable</div>
        <p className="text-sm text-muted-foreground mt-1">
          {isError ? error.message : "Il n'existe pas, ou n'appartient pas à votre organisation."}
        </p>
        <Link
          to="/equipment"
          className="mt-3 inline-block text-xs font-semibold text-accent hover:underline"
        >
          ← Retour aux équipements
        </Link>
      </div>
    );
  }

  const status = EQUIPMENT_STATUS[eq.status];
  const documents = eq.document_equipment.flatMap((l) => (l.documents ? [l.documents] : []));

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto">
      <nav className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground font-bold mb-3">
        <Link to="/equipment" className="hover:text-foreground">
          Équipements
        </Link>
        <ChevronRight className="size-3" />
        <span className="text-foreground">{eq.code}</span>
      </nav>

      <PageHeader
        title={eq.name}
        description={[eq.code, eq.category, eq.location].filter(Boolean).join(" · ")}
        actions={
          isAdmin && (
            <button
              onClick={() => setEditOpen(true)}
              className="h-9 px-3 rounded-md border border-border bg-card text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-secondary"
            >
              <Pencil className="size-3.5" /> Modifier
            </button>
          )
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat
          label="Statut"
          value={<StatusBadge variant={status.badge}>{status.label}</StatusBadge>}
        />
        <Stat
          label="Criticité"
          value={
            <span className="inline-flex items-center gap-2 font-semibold">
              <CriticalityDots level={eq.criticality} /> {eq.criticality} / 3
            </span>
          }
        />
        <Stat
          label="Mise en service"
          value={<span className="font-semibold">{formatDate(eq.commissioned_on)}</span>}
        />
        <Stat
          label="Interventions"
          value={<span className="font-mono font-bold">{eq.interventions.length}</span>}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 rounded-xl border border-border bg-card shadow-card">
          <div className="px-5 py-4 border-b border-border text-sm font-bold flex items-center gap-2">
            <Wrench className="size-4 text-accent" /> Historique des interventions
          </div>
          {eq.interventions.length === 0 ? (
            <p className="px-5 py-8 text-sm text-muted-foreground text-center">
              Aucune intervention sur cet équipement.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {eq.interventions.map((i) => (
                <li key={i.id} className="px-5 py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{i.title}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {INTERVENTION_TYPE_LABELS[i.type]} · créée le {formatDate(i.created_at)}
                      {i.due_date && ` · échéance ${formatDate(i.due_date)}`}
                    </div>
                  </div>
                  <StatusBadge variant={INTERVENTION_STATUS[i.status].badge}>
                    {INTERVENTION_STATUS[i.status].label}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card shadow-card">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="text-sm font-bold">Documentation associée</div>
            <Link to="/documents" className="text-[11px] font-semibold text-accent hover:underline">
              Centre documentaire →
            </Link>
          </div>
          {documents.length === 0 ? (
            <p className="px-5 py-8 text-sm text-muted-foreground text-center">
              Aucun document lié.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {documents.map((d) => (
                <li key={d.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="size-9 rounded-md bg-accent/10 text-accent flex items-center justify-center shrink-0">
                    <FileText className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{d.name}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">
                      {formatBytes(d.size_bytes)}
                      {d.expires_on && ` · expire le ${formatDate(d.expires_on)}`}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <EquipmentFormDialog open={editOpen} onOpenChange={setEditOpen} equipment={eq} />
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
