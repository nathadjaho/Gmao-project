import type { Enums } from "@/integrations/supabase/types";

export type AppRole = Enums<"app_role">;

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrateur",
  technician: "Technicien",
};

export function initials(nameOrEmail: string): string {
  const parts = nameOrEmail.split(/[\s.@_-]+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").concat(parts[1]?.[0] ?? "").toUpperCase();
}
