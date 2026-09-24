import { ShieldCheck } from "lucide-react";

/** Mise en page partagée par connexion, inscription et onboarding (panneau visuel + formulaire). */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[1fr_minmax(440px,520px)] bg-background">
      <div className="hidden lg:flex relative bg-primary text-primary-foreground p-12 flex-col justify-between overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-[0.06]" />
        <div className="absolute -top-32 -right-32 size-96 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-primary to-transparent" />

        <div className="relative flex items-center gap-2.5">
          <div className="size-9 rounded-md bg-primary-foreground/10 border border-primary-foreground/20 flex items-center justify-center">
            <ShieldCheck className="size-4 text-accent" strokeWidth={2.2} />
          </div>
          <div className="leading-tight">
            <div className="text-base font-bold tracking-tight">
              FORGE<span className="text-accent">OS</span>
            </div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-primary-foreground/60">
              Maintenance Operations Platform
            </div>
          </div>
        </div>

        <div className="relative">
          <h2 className="text-4xl font-bold tracking-tight leading-tight text-balance">
            Discipline opérationnelle.
            <br />
            <span className="text-primary-foreground/60">Traçabilité absolue.</span>
          </h2>
          <p className="mt-4 text-sm text-primary-foreground/70 max-w-md">
            Plateforme de GMAO conçue pour les environnements industriels et techniques exigeants.
            Pilotage du parc, interventions terrain, documentation contrôlée.
          </p>
        </div>

        <div className="relative text-[10px] font-mono text-primary-foreground/40 uppercase tracking-widest">
          GMAO · Maintenance &amp; documentation
        </div>
      </div>

      <div className="flex items-center justify-center p-6 md:p-12">{children}</div>
    </div>
  );
}

export function AuthPending() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-sm text-muted-foreground">
      Chargement…
    </div>
  );
}
