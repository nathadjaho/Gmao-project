import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormError } from "@/components/FormField";
import {
  categoriesWithCountQuery,
  createCategory,
  deleteCategory,
  documentKeys,
  renameCategory,
} from "../document-api";

const inputClass =
  "flex-1 h-9 px-3 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/15 focus:border-primary";

/** Gestion des catégories (admin) : ajouter, renommer, supprimer si aucun document ne l'utilise. */
export function CategoryManagerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({ ...categoriesWithCountQuery, enabled: open });
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNewName("");
      setEditing(null);
      setError(null);
    }
  }, [open]);

  const done = async (message: string) => {
    setError(null);
    await queryClient.invalidateQueries({ queryKey: documentKeys.all });
    toast.success(message);
  };
  const onError = (e: Error) => setError(e.message);

  const add = useMutation({
    mutationFn: createCategory,
    onSuccess: async () => {
      setNewName("");
      await done("Catégorie ajoutée");
    },
    onError,
  });
  const rename = useMutation({
    mutationFn: (c: { id: string; name: string }) => renameCategory(c.id, c.name),
    onSuccess: async () => {
      setEditing(null);
      await done("Catégorie renommée");
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => done("Catégorie supprimée"),
    onError,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Catégories de documents</DialogTitle>
          <DialogDescription>
            Une catégorie utilisée par des documents ne peut pas être supprimée.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (newName.trim()) add.mutate(newName);
          }}
        >
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nouvelle catégorie (ex. Plan électrique)"
            maxLength={80}
            aria-label="Nom de la nouvelle catégorie"
            className={inputClass}
          />
          <button
            type="submit"
            disabled={!newName.trim() || add.isPending}
            className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus className="size-3.5" /> Ajouter
          </button>
        </form>

        <FormError message={error} />

        <ul className="divide-y divide-border rounded-md border border-border max-h-[50vh] overflow-y-auto">
          {isPending && <li className="px-3 py-3 text-sm text-muted-foreground">Chargement…</li>}
          {data?.map((c) =>
            editing?.id === c.id ? (
              <li key={c.id} className="px-3 py-2">
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (editing.name.trim()) rename.mutate(editing);
                  }}
                >
                  <input
                    autoFocus
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    maxLength={80}
                    aria-label="Nouveau nom"
                    className={inputClass}
                  />
                  <IconButton label="Valider" type="submit" disabled={rename.isPending}>
                    <Check className="size-4" />
                  </IconButton>
                  <IconButton label="Annuler" onClick={() => setEditing(null)}>
                    <X className="size-4" />
                  </IconButton>
                </form>
              </li>
            ) : (
              <li key={c.id} className="px-3 py-2 flex items-center gap-2">
                <span className="flex-1 text-sm truncate">{c.name}</span>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {c.count} doc{c.count > 1 ? "s" : ""}
                </span>
                <IconButton
                  label={`Renommer ${c.name}`}
                  onClick={() => setEditing({ id: c.id, name: c.name })}
                >
                  <Pencil className="size-3.5" />
                </IconButton>
                <IconButton
                  label={c.count > 0 ? "Utilisée par des documents" : `Supprimer ${c.name}`}
                  disabled={c.count > 0 || remove.isPending}
                  onClick={() => remove.mutate(c.id)}
                >
                  <Trash2 className="size-3.5" />
                </IconButton>
              </li>
            ),
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function IconButton({
  label,
  children,
  onClick,
  disabled,
  type = "button",
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="size-8 rounded-md inline-flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
