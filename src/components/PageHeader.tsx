export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
      <div>
        {eyebrow && (
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-2">
            {eyebrow}
          </div>
        )}
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-balance">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}
