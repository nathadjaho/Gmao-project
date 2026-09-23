-- =============================================================================
-- Phase 0 — Sortir les fonctions SECURITY DEFINER du schéma exposé par l'API
--
-- Problème : tout ce qui est dans `public` est appelable via /rest/v1/rpc/...
-- Une fonction SECURITY DEFINER s'exécute avec les droits de son propriétaire
-- (elle contourne la RLS) : elle ne doit pas être joignable directement.
--
-- Solution (pattern recommandé par Supabase) :
--   - schéma `private`, NON exposé par l'API ;
--   - les helpers RLS y sont déplacés (les policies et DEFAULT suivent
--     automatiquement : PostgreSQL les référence par OID, pas par nom) ;
--   - create_organization : la logique privilégiée va dans `private`, et
--     `public` ne garde qu'une façade SECURITY INVOKER (appelable par l'app,
--     sans privilège propre).
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- 1. Helpers RLS -------------------------------------------------------------
alter function public.current_org_id()            set schema private;
alter function public.has_role(public.app_role[]) set schema private;

-- Le corps PL/pgSQL est du texte résolu à l'exécution : il faut le mettre à jour.
create or replace function public.intervention_enforce_status()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.status not in ('todo', 'in_progress') then
      raise exception 'Une intervention doit être créée au statut todo ou in_progress (reçu : %)', new.status
        using errcode = 'check_violation';
    end if;
  elsif new.status is distinct from old.status then
    if not (
         (old.status = 'todo'        and new.status in ('in_progress', 'cancelled'))
      or (old.status = 'in_progress' and new.status in ('done', 'cancelled'))
    ) then
      raise exception 'Transition de statut interdite : % → %', old.status, new.status
        using errcode = 'check_violation';
    end if;
  elsif old.status in ('done', 'cancelled') then
    raise exception 'Intervention clôturée : modification interdite'
      using errcode = 'check_violation';
  end if;

  if tg_op = 'UPDATE' and auth.uid() is not null and not private.has_role('{admin,manager}') then
    if (new.type, new.priority, new.title, new.description, new.assigned_to, new.due_date)
       is distinct from
       (old.type, old.priority, old.title, old.description, old.assigned_to, old.due_date) then
      raise exception 'Un technicien ne peut modifier que le statut et le rapport de clôture'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  if new.status = 'in_progress' and new.started_at is null then
    new.started_at := now();
  end if;
  if new.status in ('done', 'cancelled') and new.completed_at is null then
    new.completed_at := now();
  end if;
  return new;
end $$;
revoke execute on function public.intervention_enforce_status() from public, anon, authenticated;

-- 2. Onboarding --------------------------------------------------------------
alter function public.create_organization(text) set schema private;
revoke all on function private.create_organization(text) from public, anon;
grant execute on function private.create_organization(text) to authenticated;

-- Façade publique : SECURITY INVOKER, aucun privilège propre.
-- L'app appelle toujours supabase.rpc('create_organization', { org_name }).
create or replace function public.create_organization(org_name text)
returns uuid language sql security invoker set search_path = '' as $$
  select private.create_organization(org_name)
$$;
revoke all on function public.create_organization(text) from public, anon;
grant execute on function public.create_organization(text) to authenticated;
