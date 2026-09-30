import { Link, Outlet, useNavigate, useRouteContext, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CalendarClock, FileText, LogOut, Package, Users, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "@/features/auth/auth-api";
import { ROLE_LABELS, initials } from "@/features/auth/roles";
import { unreadCountQuery } from "@/features/notifications/notification-api";

// D18 : 4 entrées seulement. « Aujourd'hui » garde l'URL /dashboard (redirections auth inchangées).
const navItems = [
  { to: "/dashboard", label: "Aujourd'hui", icon: CalendarClock },
  { to: "/equipment", label: "Équipements", icon: Package },
  { to: "/interventions", label: "Interventions", icon: Wrench },
  { to: "/documents", label: "Documents", icon: FileText },
] as const;

export function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { auth } = useRouteContext({ from: "/_app" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const displayName = auth.fullName || auth.email;
  const { data: unread = 0 } = useQuery(unreadCountQuery);

  async function handleSignOut() {
    await signOut(queryClient);
    navigate({ to: "/" });
  }

  const iconBtn =
    "relative size-10 shrink-0 rounded-md inline-flex items-center justify-center text-foreground/70 hover:bg-secondary hover:text-foreground transition-colors";

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 h-15 border-b border-border bg-card">
        <div className="h-full max-w-[1400px] mx-auto px-4 md:px-8 flex items-center gap-4 md:gap-8">
          <Link to="/dashboard" className="flex items-center gap-2 shrink-0" aria-label="Accueil">
            <span className="size-6 rounded-md bg-primary text-primary-foreground font-mono text-xs font-semibold flex items-center justify-center">
              F
            </span>
            <span className="hidden sm:inline text-sm font-semibold tracking-tight">ForgeOS</span>
          </Link>

          <nav
            className="flex items-stretch h-full gap-1 min-w-0"
            aria-label="Navigation principale"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 px-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
                    active
                      ? "border-foreground text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-4 md:hidden" strokeWidth={1.8} aria-hidden />
                  <span className="sr-only md:not-sr-only">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1 md:gap-2">
            <Link
              to="/notifications"
              className={cn(
                iconBtn,
                pathname.startsWith("/notifications") && "bg-secondary text-foreground",
              )}
              aria-label={
                unread > 0
                  ? `Notifications : ${unread} non lue${unread > 1 ? "s" : ""}`
                  : "Notifications"
              }
            >
              <Bell className="size-[18px]" strokeWidth={1.8} />
              {unread > 0 && (
                <span className="absolute top-1 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-critical text-white text-[10px] font-semibold font-mono flex items-center justify-center border-2 border-card">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
            <Link
              to="/team"
              className={cn(
                iconBtn,
                pathname.startsWith("/team") && "bg-secondary text-foreground",
              )}
              aria-label="Équipe"
              title="Équipe"
            >
              <Users className="size-[18px]" strokeWidth={1.8} />
            </Link>

            <div className="flex items-center gap-2.5 pl-2 md:pl-3 ml-1 border-l border-border">
              {/* Ouvre « Mon profil » (nom, mot de passe). */}
              <Link
                to="/profile"
                title="Mon profil"
                aria-current={pathname.startsWith("/profile") ? "page" : undefined}
                className="flex items-center gap-2.5 min-w-0 rounded-md hover:opacity-80 transition-opacity"
              >
                <div className="size-8 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">
                  {initials(displayName)}
                </div>
                <div className="hidden lg:block leading-tight min-w-0 max-w-40">
                  <div className="text-xs font-semibold truncate">{displayName}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {ROLE_LABELS[auth.membership.role]} · {auth.membership.organization.name}
                  </div>
                </div>
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                title="Se déconnecter"
                aria-label="Se déconnecter"
                className={iconBtn}
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
