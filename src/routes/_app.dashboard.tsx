import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowRight, ClipboardList, FileText, Plus } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth, useIsAdmin } from "@/features/auth/use-auth";
import { initials } from "@/features/auth/roles";
import {
  dashboardSummaryQuery,
  expiringDocumentsQuery,
  localToday,
  openInterventionsQuery,
  submittedInterventionsQuery,
  type DashboardSummary,
} from "@/features/dashboard/dashboard-api";
import {
  INTERVENTION_STATUS,
  type InterventionStatus,
} from "@/features/interventions/intervention-model";
import {
  addDays,
  countdown,
  daysUntil,
  DUE_BG,
  DUE_TEXT,
  dueLevel,
  relativeDue,
  relativeExpiry,
  timeUsed,
  toLocalDate,
  type DueLevel,
} from "@/lib/due";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

// D18 : « Aujourd'hui » remplace le Dashboard. L'URL reste /dashboard (redirections auth inchangées).
export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Aujourd'hui — ForgeOS GMAO" }] }),
  component: TodayPage,
});

const PAST_DAYS = 7;
const NEXT_DAYS = 14;
const DOC_HORIZON = 30;

const longDate = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const weekday = new Intl.DateTimeFormat("fr-FR", { weekday: "short" });
const shortDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
const asDate = (iso: string) => new Date(`${iso}T00:00:00`);

/* ---------- Modèle commun : une échéance, quelle que soit sa source ---------- */

type DueItem = {
  key: string;
  kind: "intervention" | "document";
  id: string;
  title: string;
  code: string | null;
  place: string | null;
  date: string | null;
  days: number | null;
  level: DueLevel;
  createdAt: string;
  who: string | null;
  status: InterventionStatus | null;
};

type Person = { full_name: string | null; email: string | null } | null;
const personName = (p: Person) => (p ? p.full_name || p.email : null);

function TodayPage() {
  const auth = useAuth();
  const isAdmin = useIsAdmin();
  const today = localToday();
  const scope = isAdmin ? null : auth.userId;

  const summary = useQuery(dashboardSummaryQuery(today));
  const open = useQuery(openInterventionsQuery(scope));
  const submitted = useQuery(submittedInterventionsQuery(scope));
  const docs = useQuery({
    ...expiringDocumentsQuery(addDays(today, DOC_HORIZON)),
    enabled: isAdmin,
  });

  const [day, setDay] = useState<number | null>(null);

  const items = useMemo<DueItem[]>(() => {
    const out: DueItem[] = [];
    for (const i of open.data ?? []) {
      const days = daysUntil(i.due_date, today);
      out.push({
        key: `i-${i.id}`,
        kind: "intervention",
        id: i.id,
        title: i.title,
        code: i.equipment?.code ?? null,
        place: i.equipment?.name ?? null,
        date: i.due_date,
        days,
        level: dueLevel(days),
        createdAt: i.created_at,
        who: personName(i.assignee),
        status: i.status,
      });
    }
    for (const d of docs.data ?? []) {
      const days = daysUntil(d.expires_on, today);
      const eq = d.links.find((l) => l.equipment)?.equipment ?? null;
      out.push({
        key: `d-${d.id}`,
        kind: "document",
        id: d.id,
        title: d.name,
        code: eq?.code ?? null,
        place: eq?.name ?? null,
        date: d.expires_on,
        days,
        level: dueLevel(days),
        createdAt: d.created_at,
        who: null,
        status: null,
      });
    }
    return out.sort((a, b) => (a.days ?? Infinity) - (b.days ?? Infinity));
  }, [open.data, docs.data, today]);

  const visible = day === null ? items : items.filter((x) => x.days === day);
  const lateCount = items.filter((x) => x.level === "late").length;
  const soonCount = items.filter((x) => x.level === "soon").length;
  const loading = open.isPending || (isAdmin && docs.isPending);
  const error = open.error ?? submitted.error ?? docs.error ?? summary.error;
  const firstName = auth.fullName?.split(" ")[0];

  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4 mb-7">
        <div>
          <div className="text-sm text-muted-foreground first-letter:uppercase">
            {longDate.format(asDate(today))}
            {firstName ? ` · ${firstName}` : ""}
          </div>
          <h1 className="text-2xl md:text-[28px] font-semibold tracking-tight leading-tight mt-1 text-balance">
            {loading ? (
              "Chargement de vos échéances…"
            ) : (
              <Headline
                isAdmin={isAdmin}
                late={lateCount}
                soon={soonCount}
                open={items.filter((x) => x.kind === "intervention").length}
                toValidate={submitted.data?.length ?? 0}
              />
            )}
          </h1>
        </div>
        {isAdmin && (
          <Link
            to="/interventions"
            search={{ create: true }}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="size-4" /> Nouvelle intervention
          </Link>
        )}
      </header>

      {error && (
        <div className="mb-6 rounded-md border border-critical/30 bg-critical/5 px-4 py-3 text-sm text-critical">
          Impossible de charger certaines données : {error.message}
        </div>
      )}

      {isAdmin && summary.data && summary.data.equipment.total === 0 && <GettingStarted />}

      <Timeline items={items} today={today} selected={day} onSelect={setDay} />

      {isAdmin ? (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-10 items-start">
          <section aria-labelledby="due-title">
            <SectionTitle id="due-title" count={visible.length}>
              Échéancier
              {day !== null && <ClearDay day={day} today={today} onClear={() => setDay(null)} />}
            </SectionTitle>
            <DueList items={visible} today={today} loading={loading} />
          </section>
          <aside className="space-y-10">
            <ValidationQueue rows={submitted.data} today={today} />
            <Fleet s={summary.data} />
          </aside>
        </div>
      ) : (
        <div className="space-y-10">
          <section aria-labelledby="mine-title">
            <SectionTitle id="mine-title" count={visible.length}>
              Ma file, par échéance
              {day !== null && <ClearDay day={day} today={today} onClear={() => setDay(null)} />}
            </SectionTitle>
            <TechCards items={visible} loading={loading} />
          </section>
          <WaitingValidation rows={submitted.data} />
        </div>
      )}
    </div>
  );
}

/* ---------- En-tête : la réponse d'abord ---------- */

function Headline(p: {
  isAdmin: boolean;
  late: number;
  soon: number;
  open: number;
  toValidate: number;
}) {
  const s = (n: number, one: string, many: string) => (n > 1 ? many : one);
  const late =
    p.late > 0 ? (
      <span className="text-late">
        {p.late} {p.isAdmin ? s(p.late, "échéance dépassée", "échéances dépassées") : "en retard"}
      </span>
    ) : null;

  if (p.isAdmin) {
    const rest = `${p.soon} pour aujourd'hui et demain, ${p.toValidate} à valider.`;
    return late ? (
      <>
        {late}, {rest}
      </>
    ) : (
      <>Rien en retard. {rest.charAt(0).toUpperCase() + rest.slice(1)}</>
    );
  }
  const rest = `${p.open} ${s(p.open, "intervention", "interventions")} dans votre file.`;
  return late ? (
    <>
      {late}, {rest}
    </>
  ) : (
    <>Rien en retard. {rest.charAt(0).toUpperCase() + rest.slice(1)}</>
  );
}

/* ---------- Frise : 7 jours passés → 14 jours à venir ---------- */

function Timeline({
  items,
  today,
  selected,
  onSelect,
}: {
  items: DueItem[];
  today: string;
  selected: number | null;
  onSelect: (d: number | null) => void;
}) {
  const days = Array.from({ length: PAST_DAYS + NEXT_DAYS + 1 }, (_, k) => k - PAST_DAYS);
  // Les échéances antérieures à la fenêtre restent visibles : on les empile sur le premier jour.
  const at = (offset: number) =>
    items.filter((x) =>
      x.days === null ? false : offset === -PAST_DAYS ? x.days <= offset : x.days === offset,
    );

  return (
    <section
      className="rounded-lg border border-border bg-card px-3 pt-3 pb-2 mb-9"
      aria-label="Frise des échéances"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 mb-2">
        <h2 className="text-[13px] font-semibold">Échéances · 7 jours passés → 14 jours à venir</h2>
        <Legend />
      </div>
      <div className="grid grid-flow-col auto-cols-[minmax(0,1fr)] gap-0.5 overflow-x-auto">
        {days.map((o) => {
          const date = addDays(today, o);
          const dow = asDate(date).getDay();
          const its = at(o);
          const isToday = o === 0;
          return (
            <button
              key={o}
              type="button"
              onClick={() => onSelect(selected === o ? null : o)}
              aria-pressed={selected === o}
              aria-label={`${shortDate.format(asDate(date))} : ${its.length} échéance${its.length > 1 ? "s" : ""}`}
              className={cn(
                "min-w-8 flex flex-col items-center gap-1 pt-2 pb-1.5 min-h-[84px] rounded-md transition-colors",
                isToday ? "bg-primary text-primary-foreground" : "hover:bg-secondary",
                !isToday &&
                  (dow === 0 || dow === 6) &&
                  "bg-[repeating-linear-gradient(135deg,transparent_0_5px,var(--color-secondary)_5px_6px)]",
                selected === o && "ring-2 ring-ring ring-inset",
              )}
            >
              <span
                className={cn(
                  "text-[10px] uppercase tracking-wide",
                  isToday ? "text-primary-foreground/70" : "text-muted-foreground",
                )}
              >
                {weekday.format(asDate(date)).replace(".", "")}
              </span>
              <span
                className={cn(
                  "font-mono text-[13px] font-medium",
                  o < 0 && !isToday && "text-muted-foreground",
                )}
              >
                {asDate(date).getDate()}
              </span>
              <span className="flex flex-col items-center gap-[3px] mt-0.5">
                {its.slice(0, 5).map((x) => (
                  <span
                    key={x.key}
                    className={cn(
                      "size-2",
                      DUE_BG[x.level],
                      x.kind === "document"
                        ? "rotate-45 rounded-[1px] size-[7px] my-px"
                        : "rounded-full",
                      isToday && "ring-[1.5px] ring-primary",
                    )}
                  />
                ))}
                {its.length > 5 && <span className="text-[10px] font-mono">+{its.length - 5}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Legend() {
  const dot = (cls: string, label: string) => (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-2 rounded-full", cls)} />
      {label}
    </span>
  );
  return (
    <div className="hidden md:flex flex-wrap items-center gap-3.5 text-xs text-muted-foreground">
      {dot("bg-late", "Dépassé")}
      {dot("bg-soon", "Aujourd'hui / demain")}
      {dot("bg-foreground", "7 jours")}
      {dot("bg-steel", "Plus tard")}
      <span>● intervention · ◆ document</span>
    </div>
  );
}

function ClearDay({ day, today, onClear }: { day: number; today: string; onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="ml-2 text-xs font-normal text-muted-foreground underline underline-offset-2 hover:text-foreground"
    >
      {shortDate.format(asDate(addDays(today, day)))} · retirer le filtre
    </button>
  );
}

/* ---------- Échéancier (admin) ---------- */

const GROUPS: { level: DueLevel; label: string }[] = [
  { level: "late", label: "En retard / expiré" },
  { level: "soon", label: "Aujourd'hui et demain" },
  { level: "week", label: "7 prochains jours" },
  { level: "later", label: "Plus tard" },
  { level: "none", label: "Sans échéance" },
];

function DueList({ items, today, loading }: { items: DueItem[]; today: string; loading: boolean }) {
  if (loading) return <Empty>Chargement…</Empty>;
  if (items.length === 0) return <Empty>Aucune échéance. Tout est à jour.</Empty>;
  return (
    <div>
      {GROUPS.map((g) => {
        const rows = items.filter((x) => x.level === g.level);
        if (rows.length === 0) return null;
        return (
          <div key={g.level} className="mt-6 first:mt-3">
            <h3
              className={cn(
                "flex items-center gap-2 pb-2 border-b border-border text-xs font-semibold uppercase tracking-wider",
                g.level === "week" ? "text-foreground" : DUE_TEXT[g.level],
              )}
            >
              {g.label}
              <span className="font-mono font-medium text-steel">{rows.length}</span>
            </h3>
            {rows.map((x) => (
              <DueRow key={x.key} item={x} today={today} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function DueRow({ item: x, today }: { item: DueItem; today: string }) {
  const rel = x.kind === "document" ? relativeExpiry(x.days) : relativeDue(x.days);
  return (
    <ItemLink
      item={x}
      className="grid grid-cols-[104px_minmax(0,1fr)] md:grid-cols-[120px_minmax(0,1fr)_170px_110px] items-center gap-x-4 gap-y-1 px-2 pt-3 pb-2.5 border-b border-border hover:bg-secondary/70 transition-colors"
    >
      <span
        className={cn("font-mono text-[12.5px] font-semibold leading-tight", DUE_TEXT[x.level])}
      >
        {rel}
        {x.date && (
          <span className="block font-normal text-[11px] text-steel mt-0.5">
            {shortDate.format(asDate(x.date))}
          </span>
        )}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 font-medium truncate">
          {x.kind === "document" ? (
            <FileText className="size-3.5 shrink-0 text-muted-foreground" aria-label="Document" />
          ) : (
            <ClipboardList
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-label="Intervention"
            />
          )}
          <span className="truncate">{x.title}</span>
        </span>
        <span className="block text-xs text-muted-foreground truncate mt-0.5">
          {x.code && <span className="font-mono text-foreground/80">{x.code}</span>}
          {x.code && x.place && " · "}
          {x.place}
        </span>
      </span>
      <span className="hidden md:flex items-center gap-2 text-xs text-muted-foreground min-w-0">
        {x.kind === "intervention" ? (
          x.who ? (
            <>
              <Avatar name={x.who} />
              <span className="truncate">{x.who}</span>
            </>
          ) : (
            <span className="text-soon">Non assignée</span>
          )
        ) : (
          <span>Certificat à renouveler</span>
        )}
      </span>
      <span className="hidden md:block">
        {x.status ? (
          <StatusBadge variant={INTERVENTION_STATUS[x.status].badge}>
            {INTERVENTION_STATUS[x.status].label}
          </StatusBadge>
        ) : (
          <StatusBadge variant={x.level === "late" ? "critical" : "warning"}>
            {x.level === "late" ? "Expiré" : "À renouveler"}
          </StatusBadge>
        )}
      </span>
      {x.kind === "intervention" && x.date && (
        <span className="col-span-full h-[3px] rounded-full bg-border overflow-hidden" aria-hidden>
          <span
            className={cn(
              "block h-full rounded-full",
              x.level === "later" ? "bg-input" : DUE_BG[x.level],
            )}
            style={{ width: `${timeUsed(x.createdAt, x.date, today)}%` }}
          />
        </span>
      )}
    </ItemLink>
  );
}

/* ---------- File « À valider » (admin) ---------- */

type SubmittedRow = {
  id: string;
  title: string;
  submitted_at: string | null;
  equipment: { code: string; name: string } | null;
  assignee: Person;
};

function ValidationQueue({ rows, today }: { rows: SubmittedRow[] | undefined; today: string }) {
  // Les plus anciennes d'abord : une validation qui traîne est aussi un retard.
  return (
    <section aria-labelledby="queue-title">
      <SectionTitle
        id="queue-title"
        count={rows?.length}
        action={
          <Link
            to="/interventions"
            search={{ view: "to_validate" }}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            Tout voir <ArrowRight className="size-3" />
          </Link>
        }
      >
        À valider
      </SectionTitle>
      <div className="border-t border-border">
        {!rows ? (
          <Empty>Chargement…</Empty>
        ) : rows.length === 0 ? (
          <Empty>Rien à valider.</Empty>
        ) : (
          rows.slice(0, 6).map((r) => {
            const wait = r.submitted_at ? -(daysUntil(toLocalDate(r.submitted_at), today) ?? 0) : 0;
            return (
              <Link
                key={r.id}
                to="/interventions/$id"
                params={{ id: r.id }}
                className="block py-3 border-b border-border hover:bg-secondary/70 transition-colors px-1 -mx-1 rounded-sm"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium truncate">{r.title}</span>
                  <span
                    className={cn(
                      "font-mono text-xs font-semibold whitespace-nowrap",
                      wait >= 2 ? "text-late" : wait === 1 ? "text-soon" : "text-muted-foreground",
                    )}
                  >
                    {wait === 0 ? "soumise auj." : `attend ${wait} j`}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground truncate mt-0.5">
                  {r.equipment && (
                    <span className="font-mono text-foreground/80">{r.equipment.code}</span>
                  )}
                  {r.equipment && " · "}
                  {personName(r.assignee) ?? "—"}
                </div>
                <div className="mt-2 text-xs font-medium inline-flex items-center gap-1">
                  Examiner le rapport <ArrowRight className="size-3" />
                </div>
              </Link>
            );
          })
        )}
      </div>
    </section>
  );
}

/* ---------- État du parc (remplace l'ancien Dashboard) ---------- */

function Fleet({ s }: { s: DashboardSummary | undefined }) {
  const e = s?.equipment;
  const v = (n: number | undefined) => (n === undefined ? "—" : String(n));
  const cells = [
    {
      status: "in_service" as const,
      n: e?.in_service,
      label: "En service",
      variant: "operational" as const,
    },
    {
      status: "broken_down" as const,
      n: e?.broken_down,
      label: "En panne",
      variant: "critical" as const,
    },
    {
      status: "out_of_service" as const,
      n: e?.out_of_service,
      label: "Hors service",
      variant: "neutral" as const,
    },
  ];
  return (
    <section aria-labelledby="fleet-title">
      <SectionTitle id="fleet-title" count={e?.total}>
        État du parc
      </SectionTitle>
      <div className="grid grid-cols-3 gap-px bg-border border border-border rounded-lg overflow-hidden mt-2">
        {cells.map((c) => (
          <Link
            key={c.status}
            to="/equipment"
            search={{ status: c.status }}
            className="bg-card p-3.5 hover:bg-secondary/60 transition-colors"
          >
            <b
              className={cn(
                "block font-mono text-[22px] font-semibold leading-tight",
                c.status === "broken_down" && (c.n ?? 0) > 0 && "text-late",
              )}
            >
              {v(c.n)}
            </b>
            <StatusBadge variant={c.variant} className="mt-1 text-muted-foreground">
              {c.label}
            </StatusBadge>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ---------- Vue technicien ---------- */

const CARD_BORDER: Record<DueLevel, string> = {
  late: "border-l-late",
  soon: "border-l-soon",
  week: "border-l-foreground",
  later: "border-l-input",
  none: "border-l-input",
};

function TechCards({ items, loading }: { items: DueItem[]; loading: boolean }) {
  if (loading) return <Empty>Chargement…</Empty>;
  if (items.length === 0) return <Empty>Rien dans votre file. Bon travail.</Empty>;
  return (
    <div className="grid gap-2.5 mt-3">
      {items.map((x) => (
        <div
          key={x.key}
          className={cn(
            "grid grid-cols-[76px_minmax(0,1fr)] sm:grid-cols-[96px_minmax(0,1fr)_auto] items-center gap-4 rounded-lg border border-border border-l-4 bg-card p-4 min-h-[88px]",
            CARD_BORDER[x.level],
          )}
        >
          <div
            className={cn(
              "font-mono text-xl sm:text-2xl font-semibold leading-none",
              DUE_TEXT[x.level],
            )}
          >
            {countdown(x.days)}
            <span className="block mt-1.5 font-sans text-xs font-normal text-muted-foreground">
              {x.date ? shortDate.format(asDate(x.date)) : "sans échéance"}
            </span>
          </div>
          <div className="min-w-0">
            <div className="font-medium truncate">{x.title}</div>
            <div className="text-xs text-muted-foreground truncate mt-0.5">
              {x.code && <span className="font-mono text-foreground/80">{x.code}</span>}
              {x.code && x.place && " · "}
              {x.place}
            </div>
            {x.status && (
              <StatusBadge variant={INTERVENTION_STATUS[x.status].badge} className="mt-2">
                {INTERVENTION_STATUS[x.status].label}
              </StatusBadge>
            )}
          </div>
          <Link
            to="/interventions/$id"
            params={{ id: x.id }}
            className={cn(
              "col-span-2 sm:col-span-1 inline-flex items-center justify-center h-11 px-5 rounded-md text-sm font-medium transition-colors",
              x.level === "late" || x.level === "soon"
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "border border-input bg-card hover:bg-secondary",
            )}
          >
            {x.status === "todo" ? "Commencer" : "Continuer"}
          </Link>
        </div>
      ))}
    </div>
  );
}

function WaitingValidation({ rows }: { rows: SubmittedRow[] | undefined }) {
  return (
    <section aria-labelledby="wait-title">
      <SectionTitle id="wait-title" count={rows?.length}>
        En attente de validation
      </SectionTitle>
      <div className="border-t border-border">
        {!rows ? (
          <Empty>Chargement…</Empty>
        ) : rows.length === 0 ? (
          <Empty>Aucune intervention en attente.</Empty>
        ) : (
          rows.map((r) => (
            <Link
              key={r.id}
              to="/interventions/$id"
              params={{ id: r.id }}
              className="flex items-center justify-between gap-4 py-3 px-1 border-b border-border hover:bg-secondary/70 transition-colors"
            >
              <span className="min-w-0">
                <span className="block font-medium truncate">{r.title}</span>
                <span className="block text-xs text-muted-foreground truncate mt-0.5">
                  Soumise le {formatDate(r.submitted_at)} · figée jusqu'à la décision d'un admin
                </span>
              </span>
              <StatusBadge variant="review">À valider</StatusBadge>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}

/* ---------- Démarrage (organisation vide) ---------- */

function GettingStarted() {
  return (
    <div className="mb-8 rounded-lg border border-border bg-card p-5 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex-1">
        <div className="text-sm font-semibold">Bienvenue ! Commencez par votre parc.</div>
        <p className="text-sm text-muted-foreground mt-1">
          Ajoutez vos équipements, puis votre équipe : cette page se remplira avec les échéances.
        </p>
      </div>
      <div className="flex gap-2">
        <Link
          to="/equipment"
          className="h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium inline-flex items-center"
        >
          Ajouter un équipement
        </Link>
        <Link
          to="/team"
          className="h-10 px-4 rounded-md border border-input bg-card text-sm font-medium inline-flex items-center hover:bg-secondary"
        >
          Créer l'équipe
        </Link>
      </div>
    </div>
  );
}

/* ---------- Briques ---------- */

function ItemLink({
  item,
  className,
  children,
}: {
  item: DueItem;
  className: string;
  children: ReactNode;
}) {
  return item.kind === "intervention" ? (
    <Link to="/interventions/$id" params={{ id: item.id }} className={className}>
      {children}
    </Link>
  ) : (
    <Link to="/documents/$id" params={{ id: item.id }} className={className}>
      {children}
    </Link>
  );
}

function SectionTitle({
  id,
  count,
  action,
  children,
}: {
  id: string;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 mb-1">
      <h2 id={id} className="text-[15px] font-semibold flex flex-wrap items-center gap-2">
        {children}
        {count !== undefined && (
          <span className="font-mono text-xs font-medium text-steel">{count}</span>
        )}
      </h2>
      {action}
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="size-[22px] shrink-0 rounded-full bg-secondary border border-input text-[10px] font-semibold text-foreground/80 flex items-center justify-center">
      {initials(name)}
    </span>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="py-8 text-center text-sm text-muted-foreground border-b border-border">
      {children}
    </div>
  );
}
