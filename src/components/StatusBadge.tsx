import { cn } from "@/lib/utils";

type Variant = "operational" | "warning" | "critical" | "pending" | "completed" | "neutral";

const styles: Record<Variant, string> = {
  operational: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/30",
  critical: "bg-critical/10 text-critical border-critical/20",
  pending: "bg-muted text-muted-foreground border-border",
  completed: "bg-accent/10 text-accent border-accent/20",
  neutral: "bg-secondary text-secondary-foreground border-border",
};

const dotStyles: Record<Variant, string> = {
  operational: "bg-success",
  warning: "bg-warning",
  critical: "bg-critical",
  pending: "bg-muted-foreground",
  completed: "bg-accent",
  neutral: "bg-steel",
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
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide",
        styles[variant],
        className,
      )}
    >
      {withDot && <span className={cn("size-1.5 rounded-full", dotStyles[variant])} />}
      {children}
    </span>
  );
}
