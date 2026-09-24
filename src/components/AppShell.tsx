import { Link, Outlet, useNavigate, useRouteContext, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Wrench,
  Package,
  FileText,
  Bell,
  Search,
  ClipboardCheck,
  Users,
  ShieldCheck,
  HelpCircle,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "@/features/auth/auth-api";
import { ROLE_LABELS, initials } from "@/features/auth/roles";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/equipment", label: "Équipements", icon: Package },
  { to: "/interventions", label: "Interventions", icon: Wrench },
  { to: "/documents", label: "Documents", icon: FileText },
  { to: "/notifications", label: "Notifications", icon: Bell },
];

export function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { auth } = useRouteContext({ from: "/_app" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const displayName = auth.fullName || auth.email;

  async function handleSignOut() {
    await signOut(queryClient);
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 border-r border-border bg-sidebar flex flex-col sticky top-0 h-screen">
        <div className="h-14 flex items-center gap-2 px-5 border-b border-border">
          <div className="size-8 rounded-md bg-primary flex items-center justify-center">
            <ShieldCheck className="size-4 text-accent" strokeWidth={2.2} />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold tracking-tight">
              FORGE<span className="text-accent">OS</span>
            </div>
            <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              GMAO · v1.0
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground px-2 py-2">
            Pilotage
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-foreground/70 hover:bg-secondary hover:text-foreground",
                )}
              >
                <Icon className="size-4" strokeWidth={1.8} />
                {item.label}
              </Link>
            );
          })}

          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground px-2 py-2 mt-4">
            Système
          </div>
          <Link
            to="/team"
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
              pathname.startsWith("/team")
                ? "bg-primary text-primary-foreground font-semibold"
                : "text-foreground/70 hover:bg-secondary hover:text-foreground",
            )}
          >
            <Users className="size-4" strokeWidth={1.8} /> Équipe
          </Link>
          <Link
            to="/dashboard"
            className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-foreground/70 hover:bg-secondary"
          >
            <HelpCircle className="size-4" strokeWidth={1.8} /> Aide
          </Link>
        </nav>

        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-2.5 rounded-md p-2 bg-secondary/60">
            <div className="size-8 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
              {initials(displayName)}
            </div>
            <div className="leading-tight min-w-0 flex-1">
              <div className="text-xs font-semibold truncate">{displayName}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">
                {ROLE_LABELS[auth.membership.role]}
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              title="Se déconnecter"
              aria-label="Se déconnecter"
              className="size-7 shrink-0 rounded-md inline-flex items-center justify-center text-muted-foreground hover:bg-background hover:text-foreground"
            >
              <LogOut className="size-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-card/60 backdrop-blur sticky top-0 z-40 flex items-center justify-between px-6">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">{auth.membership.organization.name}</span>
            <span className="text-border">/</span>
            <span className="font-semibold capitalize">
              {pathname.split("/")[1] || "dashboard"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 h-9 px-3 w-72 rounded-md border border-border bg-background text-xs text-muted-foreground">
              <Search className="size-3.5" />
              Rechercher équipement, OT, document…
              <kbd className="ml-auto font-mono text-[10px] px-1.5 py-0.5 rounded border border-border bg-card">
                ⌘K
              </kbd>
            </div>
            {auth.membership.role === "admin" && (
              <Link
                to="/interventions"
                search={{ create: true }}
                className="inline-flex items-center gap-2 h-9 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold shadow-sm hover:bg-primary/90 transition-colors"
              >
                <ClipboardCheck className="size-3.5" />
                Nouvelle intervention
              </Link>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
