import { forwardRef, useId } from "react";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

/** Champ de formulaire partagé (auth, équipements…), compatible react-hook-form (`{...register()}`). */
export const FormField = forwardRef<HTMLInputElement, Props>(function FormField(
  { label, error, ...inputProps },
  ref,
) {
  const errorId = useId();
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <input
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="mt-1.5 w-full h-11 px-3 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all aria-[invalid=true]:border-critical"
        {...inputProps}
      />
      {error && (
        <span id={errorId} role="alert" className="mt-1 block text-xs text-critical">
          {error}
        </span>
      )}
    </label>
  );
});

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded-md border border-critical/30 bg-critical/10 px-3 py-2 text-xs text-critical"
    >
      {message}
    </div>
  );
}

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  options: readonly { value: string; label: string }[];
};

export const FormSelect = forwardRef<HTMLSelectElement, SelectProps>(function FormSelect(
  { label, error, options, ...selectProps },
  ref,
) {
  const errorId = useId();
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <select
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="mt-1.5 w-full h-11 px-3 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all aria-[invalid=true]:border-critical"
        {...selectProps}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && (
        <span id={errorId} role="alert" className="mt-1 block text-xs text-critical">
          {error}
        </span>
      )}
    </label>
  );
});
