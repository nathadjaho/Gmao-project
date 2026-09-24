export function CriticalityDots({ level }: { level: number }) {
  const color = level >= 3 ? "bg-critical" : level === 2 ? "bg-warning" : "bg-success";
  return (
    <div className="flex gap-1" role="img" aria-label={`Criticité ${level} sur 3`}>
      {[1, 2, 3].map((i) => (
        <div key={i} className={`size-1.5 rounded-full ${i <= level ? color : "bg-border"}`} />
      ))}
    </div>
  );
}
