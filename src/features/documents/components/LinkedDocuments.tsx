import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FileText, Plus } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { localToday } from "@/features/dashboard/dashboard-api";
import { formatBytes } from "@/lib/format";
import { EXPIRY_BADGE, expiryStatus, fileTypeLabel } from "../document-model";
import { linkedDocumentsQuery } from "../document-api";
import { DocumentFormDialog } from "./DocumentFormDialog";

type Props =
  | { equipmentId: string; interventionId?: never; canAdd: boolean }
  | { interventionId: string; equipmentId?: never; canAdd: boolean };

/** Section « Documents » des fiches équipement et intervention (liste + ajout pré-lié). */
export function LinkedDocuments({ equipmentId, interventionId, canAdd }: Props) {
  const [open, setOpen] = useState(false);
  const { data, isPending } = useQuery(
    linkedDocumentsQuery(
      equipmentId
        ? { kind: "equipment", id: equipmentId }
        : { kind: "intervention", id: interventionId as string },
    ),
  );
  const today = localToday();

  return (
    <section className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="text-sm font-bold">Documents</div>
        {canAdd && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-[11px] font-semibold text-accent hover:underline inline-flex items-center gap-1"
          >
            <Plus className="size-3" /> Ajouter
          </button>
        )}
      </div>
      {isPending ? (
        <p className="px-5 py-6 text-sm text-muted-foreground text-center">Chargement…</p>
      ) : !data?.length ? (
        <p className="px-5 py-6 text-sm text-muted-foreground text-center">Aucun document lié.</p>
      ) : (
        <ul className="divide-y divide-border">
          {data.map((d) => {
            const exp = expiryStatus(d.expires_on, today);
            return (
              <li key={d.id}>
                <Link
                  to="/documents/$id"
                  params={{ id: d.id }}
                  className="px-5 py-3 flex items-center gap-3 hover:bg-secondary/30 transition-colors"
                >
                  <div className="size-9 rounded-md bg-accent/10 text-accent flex items-center justify-center shrink-0">
                    <FileText className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate">{d.name}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">
                      {fileTypeLabel(d.mime_type)} · {formatBytes(d.size_bytes)} · v
                      {d.current_version}
                    </div>
                  </div>
                  {(exp === "expired" || exp === "soon") && (
                    <StatusBadge variant={EXPIRY_BADGE[exp].badge}>
                      {EXPIRY_BADGE[exp].label}
                    </StatusBadge>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {canAdd && (
        <DocumentFormDialog
          open={open}
          onOpenChange={setOpen}
          link={equipmentId ? { equipmentId } : { interventionId }}
        />
      )}
    </section>
  );
}
