import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Check, ChevronRight, Lock } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { FormField } from "@/components/FormField";
import { useAuth, useIsAdmin } from "@/features/auth/use-auth";
import { ReasonDialog } from "@/features/interventions/components/ReasonDialog";
import {
  changeStatus,
  interventionDetailQuery,
  interventionKeys,
  saveReport,
  toggleStep,
  type InterventionDetail,
} from "@/features/interventions/intervention-api";
import {
  INTERVENTION_STATUS,
  INTERVENTION_TYPE_LABELS,
  PRIORITY_LABELS,
  reportSchema,
  type InterventionStatus,
  type ReportInput,
  type ReportValues,
} from "@/features/interventions/intervention-model";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_app/interventions/$id")({
  head: () => ({ meta: [{ title: "Intervention — ForgeOS GMAO" }] }),
  component: InterventionPage,
});

type ReasonAction = { to: InterventionStatus; title: string; description: string; confirm: string };

const REASON_ACTIONS = {
  return: {
    to: "in_progress",
    title: "Renvoyer pour reprise",
    description: "Le technicien sera notifié avec votre motif et pourra compléter son rapport.",
    confirm: "Renvoyer",
  },
  cancel: {
    to: "cancelled",
    title: "Annuler l'intervention",
    description: "L'intervention sera verrouillée. Le motif est conservé dans l'historique.",
    confirm: "Annuler l'intervention",
  },
  reopen: {
    to: "in_progress",
    title: "Rouvrir l'intervention",
    description: "L'intervention repasse « En cours ». Le motif est conservé dans l'historique.",
    confirm: "Rouvrir",
  },
} satisfies Record<string, ReasonAction>;

function InterventionPage() {
  const { id } = Route.useParams();
  const auth = useAuth();
  const isAdmin = useIsAdmin();
  const queryClient = useQueryClient();
  const [reasonAction, setReasonAction] = useState<ReasonAction | null>(null);
  const { data: itv, isPending, isError, error } = useQuery(interventionDetailQuery(id));

  const refresh = () => queryClient.invalidateQueries({ queryKey: interventionKeys.all });

  const statusMutation = useMutation({
    mutationFn: ({ to, reason }: { to: InterventionStatus; reason?: string }) =>
      changeStatus(id, to, reason),
    onSuccess: async (_, { to }) => {
      await refresh();
      setReasonAction(null);
      toast.success(`Statut : ${INTERVENTION_STATUS[to].label}`);
    },
    onError: (e) => toast.error(e.message),
  });

  if (isPending) return <div className="p-8 text-sm text-muted-foreground">Chargement…</div>;
  if (isError || !itv) {
    return (
      <div className="p-8">
        <div className="text-sm font-semibold">Intervention introuvable</div>
        <p className="text-sm text-muted-foreground mt-1">
          {isError ? error.message : "Elle n'existe pas ou n'appartient pas à votre organisation."}
        </p>
        <Link
          to="/interventions"
          className="mt-3 inline-block text-xs font-semibold text-accent hover:underline"
        >
          ← Retour aux interventions
        </Link>
      </div>
    );
  }

  const isAssignee = itv.assigned_to === auth.userId;
  // Qui peut agir sur le contenu : l'admin, ou le technicien assigné tant que ce n'est pas soumis.
  const canWork = itv.status === "in_progress" && (isAdmin || isAssignee);
  const locked = ["submitted", "done", "cancelled"].includes(itv.status);
  const status = INTERVENTION_STATUS[itv.status];

  return (
    <div className="p-6 md:p-8 max-w-[1200px] mx-auto">
      <nav className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground font-bold mb-3">
        <Link to="/interventions" className="hover:text-foreground">
          Interventions
        </Link>
        <ChevronRight className="size-3" />
        <span className="text-foreground truncate">{itv.title}</span>
      </nav>

      <PageHeader
        eyebrow={`${INTERVENTION_TYPE_LABELS[itv.type]} · Priorité ${PRIORITY_LABELS[itv.priority].toLowerCase()}`}
        title={itv.title}
        description={itv.description ?? undefined}
        actions={<StatusBadge variant={status.badge}>{status.label}</StatusBadge>}
      />

      {/* Barre d'actions : n'affiche que ce que la base autoriserait (la base revérifie de toute façon). */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {itv.status === "todo" && (isAdmin || isAssignee) && (
          <ActionButton
            primary
            pending={statusMutation.isPending}
            onClick={() => statusMutation.mutate({ to: "in_progress" })}
          >
            Démarrer
          </ActionButton>
        )}
        {itv.status === "submitted" && isAdmin && (
          <>
            <ActionButton
              primary
              pending={statusMutation.isPending}
              onClick={() => statusMutation.mutate({ to: "done" })}
            >
              <Check className="size-3.5" /> Valider (terminé)
            </ActionButton>
            <ActionButton onClick={() => setReasonAction(REASON_ACTIONS.return)}>
              Renvoyer pour reprise
            </ActionButton>
          </>
        )}
        {["todo", "in_progress", "submitted"].includes(itv.status) && isAdmin && (
          <ActionButton onClick={() => setReasonAction(REASON_ACTIONS.cancel)}>
            Annuler
          </ActionButton>
        )}
        {["done", "cancelled"].includes(itv.status) && isAdmin && (
          <ActionButton onClick={() => setReasonAction(REASON_ACTIONS.reopen)}>
            Rouvrir
          </ActionButton>
        )}
        {itv.status === "submitted" && !isAdmin && (
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
            <Lock className="size-3.5" /> Soumise : en attente de validation par un administrateur.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Checklist itv={itv} editable={canWork} onChanged={refresh} />
          <ReportSection itv={itv} editable={canWork} locked={locked} onSubmitted={refresh} />
        </div>

        <aside className="space-y-6">
          <section className="rounded-xl border border-border bg-card shadow-card p-5 text-xs space-y-3">
            <Info label="Équipement">
              {itv.equipment ? (
                <Link
                  to="/equipment/$id"
                  params={{ id: itv.equipment.id }}
                  className="font-semibold text-accent hover:underline"
                >
                  {itv.equipment.code} · {itv.equipment.name}
                </Link>
              ) : (
                "—"
              )}
            </Info>
            <Info label="Assignée à">
              {itv.assignee?.full_name || itv.assignee?.email || "Non assignée"}
            </Info>
            <Info label="Échéance">{formatDate(itv.due_date)}</Info>
            <Info label="Démarrée">{formatDate(itv.started_at)}</Info>
            <Info label="Soumise">{formatDate(itv.submitted_at)}</Info>
            <Info label="Clôturée">{formatDate(itv.completed_at)}</Info>
          </section>

          <section className="rounded-xl border border-border bg-card shadow-card p-5">
            <div className="text-sm font-bold mb-3">Historique</div>
            <ol className="space-y-3">
              {itv.history.map((h) => (
                <li key={h.id} className="text-xs">
                  <div className="font-semibold">{INTERVENTION_STATUS[h.to_status].label}</div>
                  <div className="text-muted-foreground">
                    {new Date(h.changed_at).toLocaleString("fr-FR")} ·{" "}
                    {h.author?.full_name || "Système"}
                  </div>
                  {h.reason && <div className="mt-0.5 italic">« {h.reason} »</div>}
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>

      <ReasonDialog
        open={reasonAction !== null}
        onOpenChange={(o) => !o && setReasonAction(null)}
        title={reasonAction?.title ?? ""}
        description={reasonAction?.description ?? ""}
        confirmLabel={reasonAction?.confirm ?? ""}
        pending={statusMutation.isPending}
        onConfirm={(reason) =>
          reasonAction && statusMutation.mutate({ to: reasonAction.to, reason })
        }
      />
    </div>
  );
}

function Checklist({
  itv,
  editable,
  onChanged,
}: {
  itv: InterventionDetail;
  editable: boolean;
  onChanged: () => void;
}) {
  const mutation = useMutation({
    mutationFn: ({ stepId, done }: { stepId: string; done: boolean }) => toggleStep(stepId, done),
    onSuccess: onChanged,
    onError: (e) => toast.error(e.message),
  });
  if (itv.steps.length === 0) return null;
  const doneCount = itv.steps.filter((s) => s.completed_at).length;

  return (
    <section className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="text-sm font-bold">Checklist</div>
        <div className="text-[11px] font-mono text-muted-foreground">
          {doneCount}/{itv.steps.length}
        </div>
      </div>
      <ul className="divide-y divide-border">
        {itv.steps.map((s) => {
          const done = Boolean(s.completed_at);
          return (
            <li key={s.id}>
              <button
                type="button"
                disabled={!editable || mutation.isPending}
                onClick={() => mutation.mutate({ stepId: s.id, done: !done })}
                className="w-full px-5 py-3.5 flex items-center gap-3 text-left enabled:hover:bg-secondary/30 disabled:cursor-default"
                aria-pressed={done}
              >
                <span
                  className={`size-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                    done
                      ? "bg-accent border-accent text-accent-foreground"
                      : "border-border bg-background"
                  }`}
                >
                  {done && <Check className="size-3.5" strokeWidth={3} />}
                </span>
                <span
                  className={`text-sm ${done ? "line-through text-muted-foreground" : "font-medium"}`}
                >
                  {s.title}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ReportSection({
  itv,
  editable,
  locked,
  onSubmitted,
}: {
  itv: InterventionDetail;
  editable: boolean;
  locked: boolean;
  onSubmitted: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReportInput, unknown, ReportValues>({ resolver: zodResolver(reportSchema) });

  useEffect(() => {
    reset({
      work_performed: itv.work_performed ?? "",
      duration_minutes: itv.duration_minutes?.toString() ?? "",
      parts_used: itv.parts_used ?? "",
    });
  }, [itv.work_performed, itv.duration_minutes, itv.parts_used, reset]);

  // Enregistrer puis soumettre : deux appels, chacun revérifié par la base.
  const submitMutation = useMutation({
    mutationFn: async ({ values, submit }: { values: ReportValues; submit: boolean }) => {
      await saveReport(itv.id, values);
      if (submit) await changeStatus(itv.id, "submitted");
    },
    onSuccess: (_, { submit }) => {
      onSubmitted();
      toast.success(submit ? "Intervention soumise pour validation" : "Rapport enregistré");
    },
    onError: (e) => toast.error(e.message),
  });

  if (!editable) {
    if (!itv.work_performed) return null;
    return (
      <section className="rounded-xl border border-border bg-card shadow-card p-5 space-y-3">
        <div className="text-sm font-bold flex items-center gap-2">
          Rapport de travaux {locked && <Lock className="size-3.5 text-muted-foreground" />}
        </div>
        <p className="text-sm whitespace-pre-wrap">{itv.work_performed}</p>
        <div className="text-xs text-muted-foreground">
          Durée : {itv.duration_minutes != null ? `${itv.duration_minutes} min` : "—"} · Pièces :{" "}
          {itv.parts_used || "—"}
        </div>
      </section>
    );
  }

  return (
    <form
      noValidate
      className="rounded-xl border border-border bg-card shadow-card p-5 space-y-4"
      onSubmit={handleSubmit((values) => submitMutation.mutate({ values, submit: true }))}
    >
      <div className="text-sm font-bold">Rapport de travaux</div>
      <label className="block">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Travaux réalisés *
        </span>
        <textarea
          rows={4}
          className="mt-1.5 w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          {...register("work_performed")}
        />
        {errors.work_performed && (
          <span className="mt-1 block text-xs text-critical">{errors.work_performed.message}</span>
        )}
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          label="Durée (minutes)"
          type="number"
          min={0}
          error={errors.duration_minutes?.message}
          {...register("duration_minutes")}
        />
        <FormField
          label="Pièces utilisées"
          error={errors.parts_used?.message}
          {...register("parts_used")}
        />
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          disabled={submitMutation.isPending}
          onClick={handleSubmit((values) => submitMutation.mutate({ values, submit: false }))}
          className="h-9 px-3 rounded-md border border-border bg-card text-xs font-semibold hover:bg-secondary disabled:opacity-60"
        >
          Enregistrer le brouillon
        </button>
        <button
          type="submit"
          disabled={submitMutation.isPending}
          className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-60"
        >
          {submitMutation.isPending ? "Envoi…" : "Soumettre pour validation"}
        </button>
      </div>
    </form>
  );
}

function ActionButton({
  children,
  onClick,
  primary,
  pending,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  pending?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={`h-9 px-3 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-60 ${
        primary
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : "border border-border bg-card hover:bg-secondary"
      }`}
    >
      {children}
    </button>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border pb-2 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-right">{children}</span>
    </div>
  );
}
