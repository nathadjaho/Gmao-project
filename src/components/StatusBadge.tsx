import { cn } from "@/lib/utils";

/**
 * Statut = glyphe (forme) + libellé. La couleur est réservée à l'urgence (D18) :
 * seuls `critical` (rouge) et `warning` (orange) sont colorés ; tout le reste est en encre/gris.
 * La forme porte le sens, pour que l'information ne dépende jamais de la couleur seule.
 */
type Variant =
  | "operational" // en service / OK
  | "critical" // en panne, expiré, dépassé
  | "warning" // expire bientôt, échéance proche
  | "pending" // à faire
  | "progress" // en cours
  | "review" // soumis, à valider
  | "completed" // terminé
  | "neutral"; // hors service, annulé, archivé

const text: Record<Variant, string> = {
  operational: "text-muted-foreground",
  critical: "text-critical",
  warning: "text-warning",
  pending: "text-muted-foreground",
  progress: "text-foreground",
  review: "text-foreground",
  completed: "text-muted-foreground",
  neutral: "text-muted-foreground",
};

const glyph: Record<Variant, string> = {
  operational: "size-2 m-px rounded-full bg-muted-foreground",
  critical: "size-2.5 bg-critical [clip-path:polygon(50%_0,100%_100%,0_100%)]",
  warning: "size-2.5 rounded-full bg-warning",
  pending: "size-2.5 rounded-full border-[1.5px] border-dashed border-muted-foreground",
  progress:
    "size-2.5 rounded-full border-[1.5px] border-foreground bg-[linear-gradient(90deg,transparent_50%,var(--color-foreground)_50%)]",
  review:
    "size-2.5 rounded-full border-[1.5px] border-foreground bg-[radial-gradient(circle,var(--color-foreground)_0_1.5px,transparent_2px)]",
  completed: "size-2.5 rounded-full bg-muted-foreground",
  neutral:
    "size-2.5 rounded-full border-[1.5px] border-steel bg-[linear-gradient(135deg,transparent_42%,var(--color-steel)_42%_58%,transparent_58%)]",
};

export function StatusBadge({
  variant = "neutral",
  children,
  className,
  withDot = true,
}: {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
  withDot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium",
        text[variant],
        className,
      )}
    >
      {withDot && <span aria-hidden className={cn("shrink-0", glyph[variant])} />}
      {children}
    </span>
  );
}
