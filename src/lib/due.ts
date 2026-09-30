/**
 * Langage commun des échéances (D18). Tout se calcule sur des dates locales « AAAA-MM-JJ »
 * pour qu'« en retard » corresponde au jour vécu par l'utilisateur, pas à l'UTC.
 */

export type DueLevel = "late" | "soon" | "week" | "later" | "none";

const DAY = 86_400_000;
const toUtc = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

/** Jours entre aujourd'hui et `date` : négatif = dépassé, 0 = aujourd'hui. */
export function daysUntil(date: string | null | undefined, today: string): number | null {
  return date ? Math.round((toUtc(date) - toUtc(today)) / DAY) : null;
}

export function dueLevel(days: number | null): DueLevel {
  if (days === null) return "none";
  if (days < 0) return "late";
  if (days <= 1) return "soon";
  if (days <= 7) return "week";
  return "later";
}

/** Classe de couleur de texte par niveau : seules les urgences sont colorées. */
export const DUE_TEXT: Record<DueLevel, string> = {
  late: "text-late",
  soon: "text-soon",
  week: "text-foreground",
  later: "text-muted-foreground",
  none: "text-muted-foreground",
};

export const DUE_BG: Record<DueLevel, string> = {
  late: "bg-late",
  soon: "bg-soon",
  week: "bg-foreground",
  later: "bg-steel",
  none: "bg-steel",
};

/** « 2 j de retard », « aujourd'hui », « demain », « dans 5 j ». */
export function relativeDue(days: number | null): string {
  if (days === null) return "sans échéance";
  if (days < 0) return `${-days} j de retard`;
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "demain";
  return `dans ${days} j`;
}

/** Variante pour une date d'expiration de document. */
export function relativeExpiry(days: number | null): string {
  if (days === null) return "sans échéance";
  if (days < 0) return `expiré · ${-days} j`;
  if (days === 0) return "expire auj.";
  if (days === 1) return "expire demain";
  return `expire dans ${days} j`;
}

/** Compte à rebours compact pour les cartes : « −2 j », « Auj. », « Demain », « J−5 ». */
export function countdown(days: number | null): string {
  if (days === null) return "—";
  if (days < 0) return `−${-days} j`;
  if (days === 0) return "Auj.";
  if (days === 1) return "Demain";
  return `J−${days}`;
}

/** Part du délai déjà consommée entre la création et l'échéance, en % (4 à 100). */
export function timeUsed(createdAt: string, due: string | null, today: string): number {
  if (!due) return 0;
  const span = Math.max(1, (toUtc(due) - toUtc(createdAt)) / DAY);
  const used = (toUtc(today) - toUtc(createdAt)) / DAY;
  return Math.min(100, Math.max(4, Math.round((used / span) * 100)));
}

/** Ajoute `n` jours à une date AAAA-MM-JJ. */
export function addDays(iso: string, n: number): string {
  return new Date(toUtc(iso) + n * DAY).toISOString().slice(0, 10);
}

/** Date locale AAAA-MM-JJ d'un horodatage (ex. submitted_at). */
export function toLocalDate(ts: string): string {
  const d = new Date(ts);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}
