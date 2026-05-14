import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ShieldCheck, Lock, ArrowRight } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Connexion sécurisée — ForgeOS GMAO" },
      { name: "description", content: "Accès opérateur à la plateforme de gestion de maintenance assistée par ordinateur." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => navigate({ to: "/dashboard" }), 600);
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-[1fr_minmax(440px,520px)] bg-background">
      {/* Visual side */}
      <div className="hidden lg:flex relative bg-primary text-primary-foreground p-12 flex-col justify-between overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-[0.06]" />
        <div className="absolute -top-32 -right-32 size-96 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-primary to-transparent" />

        <div className="relative flex items-center gap-2.5">
          <div className="size-9 rounded-md bg-primary-foreground/10 border border-primary-foreground/20 flex items-center justify-center">
            <ShieldCheck className="size-4 text-accent" strokeWidth={2.2} />
          </div>
          <div className="leading-tight">
            <div className="text-base font-bold tracking-tight">FORGE<span className="text-accent">OS</span></div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-primary-foreground/60">
              Maintenance Operations Platform
            </div>
          </div>
        </div>

        <div className="relative space-y-8">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent mb-3">
              Environnement classifié · Niveau 3
            </div>
            <h2 className="text-4xl font-bold tracking-tight leading-tight text-balance">
              Discipline opérationnelle.<br />
              <span className="text-primary-foreground/60">Traçabilité absolue.</span>
            </h2>
            <p className="mt-4 text-sm text-primary-foreground/70 max-w-md">
              Plateforme de GMAO conçue pour les environnements industriels et techniques exigeants. Pilotage du parc, interventions terrain, documentation contrôlée.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 max-w-md">
            {[
              { v: "98.4%", l: "Disponibilité" },
              { v: "1 248", l: "Équipements" },
              { v: "ISO 27001", l: "Sécurité" },
            ].map((s) => (
              <div key={s.l} className="border-l-2 border-accent/40 pl-3">
                <div className="text-xl font-bold font-mono">{s.v}</div>
                <div className="text-[10px] uppercase tracking-wider text-primary-foreground/50 mt-0.5">
                  {s.l}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-[10px] font-mono text-primary-foreground/40 uppercase tracking-widest flex justify-between">
          <span>Session ID · 0x4F22-A901</span>
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-accent animate-pulse" />
            Liaison sécurisée AES-256
          </span>
        </div>
      </div>

      {/* Form side */}
      <div className="flex items-center justify-center p-6 md:p-12">
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-7">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2">
              Identification opérateur
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Connexion à votre poste</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Renseignez vos identifiants techniques pour accéder à la plateforme.
            </p>
          </div>

          <div className="space-y-4">
            <Field label="Matricule / Email" defaultValue="m.lefebvre@forge.ops" />
            <Field label="Mot de passe" type="password" defaultValue="••••••••••••" />

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 text-muted-foreground">
                <input type="checkbox" className="size-3.5 accent-accent" defaultChecked />
                Maintenir la session sur ce poste
              </label>
              <a className="text-accent hover:underline font-semibold">Aide</a>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="group w-full h-11 rounded-md bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {loading ? "Authentification…" : "Accéder à la plateforme"}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </button>

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground border-t border-border pt-5">
            <Lock className="size-3.5 text-accent" />
            Connexion chiffrée. Toute tentative est journalisée.
          </div>

          <Link to="/dashboard" className="block text-center text-xs text-muted-foreground hover:text-foreground">
            Aperçu démo →
          </Link>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  type = "text",
  defaultValue,
}: {
  label: string;
  type?: string;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        defaultValue={defaultValue}
        className="mt-1.5 w-full h-11 px-3 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
      />
    </label>
  );
}
