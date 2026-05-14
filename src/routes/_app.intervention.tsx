import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Check,
  Camera,
  MessageSquare,
  Lock,
  ShieldCheck,
  PenLine,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";

export const Route = createFileRoute("/_app/intervention")({
  head: () => ({
    meta: [
      { title: "Intervention en cours — ForgeOS GMAO" },
      { name: "description", content: "Module d'intervention terrain : checklist guidée, validation étape par étape, photo, signature et verrouillage." },
    ],
  }),
  component: Intervention,
});

const steps = [
  { id: 1, title: "Sécurisation et consignation", status: "done" as const },
  { id: 2, title: "Mesure de la concentricité d'arbre", status: "active" as const },
  { id: 3, title: "Inspection des roulements", status: "pending" as const },
  { id: 4, title: "Application de lubrifiant Spec 401A", status: "pending" as const },
  { id: 5, title: "Validation et signature opérateur", status: "pending" as const },
];

function Intervention() {
  const [done, setDone] = useState<Record<number, boolean>>({ 1: true });

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        eyebrow="Ordre de travail · #WO-4022"
        title="Inspection arbre principal — Turbine génératrice B"
        description="Atelier turbines · Bay 4 · Démarré à 08:12 par M. Lefebvre"
        actions={
          <>
            <StatusBadge variant="warning">En cours</StatusBadge>
            <button className="h-9 px-3 rounded-md border border-border bg-card text-xs font-semibold hover:bg-secondary">
              Mettre en pause
            </button>
          </>
        }
      />

      {/* Stepper */}
      <div className="flex items-center gap-0 mb-8 overflow-x-auto pb-2">
        {steps.map((s, i) => {
          const isDone = s.status === "done";
          const isActive = s.status === "active";
          return (
            <div key={s.id} className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div
                  className={`size-9 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                    isDone
                      ? "bg-success text-success-foreground border-success"
                      : isActive
                      ? "bg-accent text-accent-foreground border-accent"
                      : "bg-card text-muted-foreground border-border"
                  }`}
                >
                  {isDone ? <Check className="size-4" /> : s.id}
                </div>
                <div className="leading-tight">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Étape {s.id}/5
                  </div>
                  <div
                    className={`text-xs font-semibold ${
                      isActive ? "text-foreground" : isDone ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {s.title}
                  </div>
                </div>
              </div>
              {i < steps.length - 1 && (
                <div className={`h-px w-12 mx-3 ${isDone ? "bg-success" : "bg-border"}`} />
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main checklist */}
        <div className="lg:col-span-2 space-y-6">
          <section className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <div className="text-sm font-bold">Checklist · Étape 2/5</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Mesure de la concentricité d'arbre — tolérance ±0.02 mm
                </div>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-warning bg-warning/10 px-2 py-1 rounded">
                Action requise
              </span>
            </div>

            <ul className="divide-y divide-border">
              {[
                "Vérifier l'isolation des sources d'énergie (LOTO)",
                "Positionner l'outil d'alignement laser en référence",
                "Relever la mesure sur 3 axes",
                "Photographier le rapport de mesure",
              ].map((task, i) => {
                const checked = done[i + 10];
                return (
                  <li
                    key={i}
                    className="px-5 py-4 flex items-start gap-4 hover:bg-secondary/30 cursor-pointer transition-colors"
                    onClick={() => setDone((d) => ({ ...d, [i + 10]: !d[i + 10] }))}
                  >
                    <div
                      className={`mt-0.5 size-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                        checked ? "bg-accent border-accent text-accent-foreground" : "border-border bg-background"
                      }`}
                    >
                      {checked && <Check className="size-3.5" strokeWidth={3} />}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm ${checked ? "line-through text-muted-foreground" : "font-medium"}`}>
                        {task}
                      </p>
                      {i === 2 && !checked && (
                        <div className="mt-3 grid grid-cols-3 gap-3">
                          {["Axe X", "Axe Y", "Axe Z"].map((ax) => (
                            <div key={ax}>
                              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
                                {ax} (mm)
                              </label>
                              <input
                                type="text"
                                placeholder="0.00"
                                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm font-mono focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="px-5 py-4 bg-secondary/40 border-t border-border flex items-center gap-3">
              <button className="flex-1 h-10 rounded-md border border-border bg-card text-xs font-semibold inline-flex items-center justify-center gap-2 hover:bg-background">
                <Camera className="size-4" /> Joindre une photo
              </button>
              <button className="flex-1 h-10 rounded-md border border-border bg-card text-xs font-semibold inline-flex items-center justify-center gap-2 hover:bg-background">
                <MessageSquare className="size-4" /> Ajouter un commentaire
              </button>
            </div>
          </section>

          {/* Comment block */}
          <section className="rounded-xl border border-border bg-card shadow-card p-5">
            <div className="text-sm font-bold mb-3">Note d'intervention</div>
            <textarea
              rows={3}
              defaultValue="Vibration constatée à 3 600 rpm sur l'axe Y, conforme à l'historique. Lubrification programmée pour étape 4."
              className="w-full p-3 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none resize-none"
            />
          </section>

          {/* Final validation */}
          <section className="rounded-xl border border-border bg-primary text-primary-foreground p-6 relative overflow-hidden">
            <div className="absolute -right-12 -bottom-12 size-40 rounded-full bg-accent/20 blur-2xl" />
            <div className="relative flex items-start gap-4">
              <div className="size-10 rounded-md bg-accent/20 text-accent flex items-center justify-center shrink-0">
                <ShieldCheck className="size-5" strokeWidth={2} />
              </div>
              <div className="flex-1">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-foreground/60 mb-1">
                  Validation finale
                </div>
                <div className="text-base font-bold">Verrouillage anti-fraude après signature</div>
                <p className="text-xs text-primary-foreground/70 mt-1 max-w-md">
                  Une fois signée, l'intervention est verrouillée. Toute modification ultérieure devra être tracée par un superviseur.
                </p>
              </div>
              <button className="h-10 px-4 rounded-md bg-accent text-accent-foreground text-xs font-bold inline-flex items-center gap-2 hover:brightness-110 transition-all">
                <PenLine className="size-4" /> Signer & clôturer
              </button>
            </div>
          </section>
        </div>

        {/* Right rail */}
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card shadow-card p-5">
            <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-3">
              Équipement
            </div>
            <div className="text-base font-bold">Turbine génératrice B</div>
            <div className="text-xs text-muted-foreground font-mono mt-0.5">TR-4410</div>
            <div className="mt-4 space-y-3 text-xs">
              {[
                ["Zone", "Hall turbines · Bay 4"],
                ["Criticité", "Haute · Niveau 3"],
                ["Dernière intervention", "12 mai 2026"],
                ["Heures de service", "12 488 h"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-border pb-2 last:border-0">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-semibold text-right">{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-warning/30 bg-warning/5 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="size-4 text-warning shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-bold text-warning">Procédure obligatoire</div>
                <p className="text-xs text-foreground/80 mt-1">
                  Cette intervention requiert un EPI complet et la consignation préalable des circuits hydraulique et électrique.
                </p>
                <button className="text-[11px] font-semibold text-accent hover:underline mt-2 inline-flex items-center gap-1">
                  Consulter la procédure <ChevronRight className="size-3" />
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className="text-sm font-bold mb-3 flex items-center gap-2">
              <Lock className="size-4 text-accent" />
              Traçabilité session
            </div>
            <ul className="text-[11px] font-mono text-muted-foreground space-y-1.5">
              <li>08:12 — Démarrage intervention</li>
              <li>08:15 — LOTO validé · J. Doe</li>
              <li>08:32 — Étape 1 clôturée</li>
              <li className="text-foreground">08:42 — Mesure axe Y en cours…</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
