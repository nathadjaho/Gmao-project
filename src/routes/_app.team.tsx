import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth, useIsAdmin } from "@/features/auth/use-auth";
import { ROLE_LABELS, initials, type AppRole } from "@/features/auth/roles";
import { CreateMemberDialog } from "@/features/team/components/CreateMemberDialog";
import { setMemberActive, teamKeys, teamQuery, updateMemberRole } from "@/features/team/team-api";

export const Route = createFileRoute("/_app/team")({
  head: () => ({ meta: [{ title: "Équipe — ForgeOS GMAO" }] }),
  component: TeamPage,
});

function TeamPage() {
  const auth = useAuth();
  const isAdmin = useIsAdmin();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const { data: members, isPending, isError, error } = useQuery(teamQuery);

  const onDone = (msg: string) => async () => {
    await queryClient.invalidateQueries({ queryKey: teamKeys.all });
    toast.success(msg);
  };
  const onError = (e: Error) => toast.error(e.message);

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: AppRole }) =>
      updateMemberRole(userId, role),
    onSuccess: onDone("Rôle mis à jour"),
    onError,
  });
  const activeMutation = useMutation({
    mutationFn: ({ userId, active }: { userId: string; active: boolean }) =>
      setMemberActive(userId, active),
    onSuccess: (_, v) => onDone(v.active ? "Membre réactivé" : "Membre désactivé")(),
    onError,
  });

  return (
    <div className="p-6 md:p-8 max-w-[1100px] mx-auto">
      <PageHeader
        eyebrow="Organisation"
        title="Équipe"
        description={`Membres de ${auth.membership.organization.name}.`}
        actions={
          isAdmin && (
            <button
              onClick={() => setCreateOpen(true)}
              className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-primary/90"
            >
              <UserPlus className="size-3.5" /> Ajouter un membre
            </button>
          )
        }
      />

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-card">
        {isPending && <div className="px-4 py-6 text-sm text-muted-foreground">Chargement…</div>}
        {isError && <div className="px-4 py-6 text-sm text-critical">{error.message}</div>}
        <ul className="divide-y divide-border">
          {members?.map((m) => {
            const isSelf = m.user_id === auth.userId;
            const active = !m.deleted_at;
            const name = m.profile?.full_name || m.profile?.email || "—";
            return (
              <li
                key={m.user_id}
                className={`px-4 py-3 flex items-center gap-4 ${active ? "" : "opacity-60"}`}
              >
                <div className="size-9 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                  {initials(name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">
                    {name}{" "}
                    {isSelf && <span className="text-muted-foreground font-normal">(vous)</span>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{m.profile?.email}</div>
                </div>

                {isAdmin && !isSelf ? (
                  <select
                    aria-label={`Rôle de ${name}`}
                    value={m.role}
                    disabled={!active || roleMutation.isPending}
                    onChange={(e) =>
                      roleMutation.mutate({ userId: m.user_id, role: e.target.value as AppRole })
                    }
                    className="h-8 px-2 rounded-md border border-input bg-card text-xs"
                  >
                    <option value="technician">{ROLE_LABELS.technician}</option>
                    <option value="admin">{ROLE_LABELS.admin}</option>
                  </select>
                ) : (
                  <span className="text-xs font-semibold">{ROLE_LABELS[m.role]}</span>
                )}

                <StatusBadge variant={active ? "operational" : "neutral"}>
                  {active ? "Actif" : "Désactivé"}
                </StatusBadge>

                {isAdmin && !isSelf && (
                  <button
                    onClick={() => activeMutation.mutate({ userId: m.user_id, active: !active })}
                    disabled={activeMutation.isPending}
                    className="h-8 px-2.5 rounded-md border border-border bg-card text-xs font-semibold hover:bg-secondary"
                  >
                    {active ? "Désactiver" : "Réactiver"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <CreateMemberDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
