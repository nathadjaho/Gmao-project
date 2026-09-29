import { useId, useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { formatBytes } from "@/lib/format";
import { ACCEPT_ATTR } from "../document-model";

type Props = {
  file: File | undefined;
  onChange: (file: File | undefined) => void;
  error?: string | null;
};

/** Zone de sélection de fichier (clic ou glisser-déposer), avec contrôle immédiat. */
export function FilePicker({ file, onChange, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const errorId = useId();

  function pick(f: File | undefined) {
    onChange(f);
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          pick(e.dataTransfer.files[0]);
        }}
        aria-describedby={error ? errorId : undefined}
        className={`w-full rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
          dragOver
            ? "border-accent bg-accent/5"
            : error
              ? "border-critical/50"
              : "border-border hover:bg-secondary/40"
        }`}
      >
        <FileUp className="size-5 mx-auto text-muted-foreground" />
        {file ? (
          <div className="mt-2 text-sm">
            <span className="font-semibold">{file.name}</span>
            <span className="text-muted-foreground"> · {formatBytes(file.size)}</span>
          </div>
        ) : (
          <div className="mt-2 text-sm text-muted-foreground">
            Cliquez ou déposez un fichier ici
            <div className="text-[11px] mt-0.5">PDF, image, Word ou Excel · 50 Mo maximum</div>
          </div>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => pick(e.target.files?.[0])}
      />
      {error && (
        <span id={errorId} role="alert" className="mt-1 block text-xs text-critical">
          {error}
        </span>
      )}
    </div>
  );
}
