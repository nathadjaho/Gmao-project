import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Search, FileText, FolderOpen, Filter, Star, Download, Upload } from "lucide-react";

export const Route = createFileRoute("/_app/documents")({
  head: () => ({
    meta: [
      { title: "Centre documentaire — ForgeOS GMAO" },
      { name: "description", content: "Bibliothèque technique : manuels, schémas, procédures et rapports d'intervention." },
    ],
  }),
  component: Documents,
});

const categories = [
  { name: "Tous les documents", count: 1842, active: true },
  { name: "Manuels techniques", count: 312 },
  { name: "Schémas électriques", count: 198 },
  { name: "Procédures", count: 540 },
  { name: "Rapports d'intervention", count: 624 },
  { name: "Certifications", count: 168 },
];

const docs = [
  { name: "Manuel utilisateur T-900 v4.2", cat: "Manuel", asset: "TR-4410 Turbine B", date: "12 mai 2026", size: "12.4 MB", type: "PDF", starred: true },
  { name: "Procédure de maintenance trimestrielle", cat: "Procédure", asset: "Tous compresseurs", date: "10 mai 2026", size: "880 KB", type: "PDF" },
  { name: "Schéma électrique principal Bay-4", cat: "Schéma", asset: "Hall turbines", date: "28 avril 2026", size: "3.1 MB", type: "DWG" },
  { name: "Rapport inspection Q2 2026", cat: "Rapport", asset: "Atelier A", date: "22 avril 2026", size: "1.7 MB", type: "PDF", starred: true },
  { name: "Certification ISO 27001 — Site Nord", cat: "Certification", asset: "Site Nord", date: "01 avril 2026", size: "440 KB", type: "PDF" },
  { name: "Manuel HVAC Centrale Unit 4", cat: "Manuel", asset: "HVAC-04", date: "15 mars 2026", size: "8.2 MB", type: "PDF" },
];

function Documents() {
  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        eyebrow="Bibliothèque technique"
        title="Centre documentaire"
        description="1 842 documents indexés et accessibles aux opérateurs autorisés."
        actions={
          <>
            <button className="h-9 px-3 rounded-md border border-border bg-card text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-secondary">
              <Filter className="size-3.5" /> Filtres
            </button>
            <button className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-primary/90">
              <Upload className="size-3.5" /> Téléverser
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
        {/* Categories */}
        <aside className="space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground px-3 py-2">
            Catégories
          </div>
          {categories.map((c) => (
            <button
              key={c.name}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
                c.active
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-foreground/70 hover:bg-secondary"
              }`}
            >
              <span className="flex items-center gap-2">
                <FolderOpen className="size-4" strokeWidth={1.8} />
                {c.name}
              </span>
              <span className={`text-[11px] font-mono ${c.active ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                {c.count}
              </span>
            </button>
          ))}

          <div className="pt-4 mt-4 border-t border-border">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground px-3 py-2">
              Récents
            </div>
            <ul className="text-xs text-muted-foreground space-y-2 px-3">
              <li>Rapport inspection Q2 2026</li>
              <li>Manuel utilisateur T-900</li>
              <li>Procédure trimestrielle</li>
            </ul>
          </div>
        </aside>

        {/* Documents */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2 h-10 px-3 flex-1 rounded-md border border-input bg-card">
              <Search className="size-4 text-muted-foreground" />
              <input
                placeholder="Recherche intelligente — nom, équipement, contenu PDF…"
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
              />
              <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-border bg-background text-muted-foreground">
                ⌘K
              </kbd>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-card">
            <div className="px-5 py-3 border-b border-border bg-secondary/30 flex items-center text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              <span className="flex-1">Document</span>
              <span className="hidden md:block w-40">Équipement lié</span>
              <span className="hidden md:block w-32">Mis à jour</span>
              <span className="w-20 text-right">Action</span>
            </div>
            <ul className="divide-y divide-border">
              {docs.map((d) => (
                <li key={d.name} className="px-5 py-4 flex items-center hover:bg-secondary/30 transition-colors group">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="size-10 rounded-md bg-accent/10 text-accent flex items-center justify-center shrink-0 relative">
                      <FileText className="size-4" />
                      <div className="absolute -bottom-0.5 -right-0.5 text-[8px] font-bold bg-primary text-primary-foreground rounded px-1 leading-none py-0.5">
                        {d.type}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold flex items-center gap-2">
                        {d.name}
                        {d.starred && <Star className="size-3 text-warning fill-warning" />}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {d.cat} · {d.size}
                      </div>
                    </div>
                  </div>
                  <div className="hidden md:block w-40 text-xs text-muted-foreground truncate pr-3">{d.asset}</div>
                  <div className="hidden md:block w-32 text-xs text-muted-foreground">{d.date}</div>
                  <div className="w-20 flex justify-end gap-1">
                    <button className="size-8 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground">
                      <Download className="size-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
