-- =============================================================================
-- Phase 1 (2/2) — Rôles admin/technician + workflow de validation + verrouillage
--
-- Décisions (claude/DECISIONS.md, 2026-09-24) :
--   D5. Deux rôles : admin, technician.
--   D6. Workflow :
--         todo ──► in_progress ──► submitted ──► done
--        (tech/admin)  (tech/admin,    (admin : validation)
--                      rapport requis)
--         submitted ──► in_progress   admin, motif obligatoire (renvoi pour reprise)
--         todo|in_progress|submitted ──► cancelled   admin, motif obligatoire
--         done|cancelled ──► in_progress             admin, motif obligatoire (réouverture)
--   D7. Le périmètre du technicien : SES interventions, et seulement tant qu'elles
--       sont todo/in_progress. Dès « submitted », tout est figé (contenu, checklist,
--       liens documents) — pour tout le monde. L'admin ne fait plus que changer le statut.
--
-- Toutes les policies sont recréées : le type app_role change, et PostgreSQL
-- interdit de supprimer un type encore utilisé par une policy.
-- =============================================================================

-- 1. Supprimer les policies métier (recréées en §8) --------------------------
do $$
declare p record;
begin
  for p in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public'
       or (schemaname = 'storage' and policyname like 'storage documents:%')
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

-- 2. Rôles : admin, technician ------------------------------------------------
drop function private.has_role(public.app_role[]);

alter table public.memberships alter column role drop default;
alter table public.memberships alter column role type text using role::text;
drop type public.app_role;
create type public.app_role as enum ('admin', 'technician');
alter table public.memberships
  alter column role type public.app_role using (
    case role when 'manager' then 'admin' when 'viewer' then 'technician' else role end
  )::public.app_role,
  alter column role set default 'technician';

create function private.has_role(roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships
    where user_id = auth.uid() and deleted_at is null and role = any (roles)
  )
$$;
revoke all on function private.has_role(public.app_role[]) from public, anon;
grant execute on function private.has_role(public.app_role[]) to authenticated;

create function private.is_admin()
returns boolean language sql stable set search_path = '' as $$
  select private.has_role('{admin}')
$$;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

-- 3. Colonnes ------------------------------------------------------------------
alter table public.interventions add column submitted_at timestamptz;
alter table public.interventions drop constraint interventions_done_requires_report;
alter table public.interventions add constraint interventions_report_required
  check (status not in ('submitted', 'done') or work_performed is not null);

alter table public.intervention_status_history add column reason text;

drop index if exists public.interventions_assigned_idx;
create index interventions_assigned_idx on public.interventions (assigned_to)
  where status in ('todo', 'in_progress');

-- 4. Machine à états -----------------------------------------------------------
create or replace function public.intervention_enforce_status()
returns trigger language plpgsql set search_path = public as $$
declare
  v_admin  boolean := auth.uid() is null or private.is_admin(); -- auth.uid() null = opération système
  v_reason text    := nullif(trim(coalesce(current_setting('app.status_reason', true), '')), '');
  v_locked constant public.intervention_status[] := '{submitted,done,cancelled}';
begin
  if tg_op = 'INSERT' then
    if new.status not in ('todo', 'in_progress') then
      raise exception 'Une intervention doit être créée au statut todo ou in_progress (reçu : %)', new.status
        using errcode = 'check_violation';
    end if;
  else
    if new.status is distinct from old.status then
      if    old.status = 'todo'        and new.status = 'in_progress' then null;
      elsif old.status = 'in_progress' and new.status = 'submitted'   then null;
      elsif old.status = 'submitted'   and new.status = 'done'        then
        if not v_admin then
          raise exception 'Seul un administrateur valide une intervention' using errcode = 'insufficient_privilege';
        end if;
      elsif (old.status = 'submitted' and new.status = 'in_progress')                     -- renvoi pour reprise
         or (old.status in ('todo', 'in_progress', 'submitted') and new.status = 'cancelled') -- annulation
         or (old.status in ('done', 'cancelled') and new.status = 'in_progress') then       -- réouverture
        if not v_admin then
          raise exception 'Action réservée à un administrateur (% → %)', old.status, new.status
            using errcode = 'insufficient_privilege';
        end if;
        if v_reason is null or length(v_reason) < 5 then
          raise exception 'Motif obligatoire (5 caractères minimum) pour % → %', old.status, new.status
            using errcode = 'check_violation';
        end if;
      else
        raise exception 'Transition de statut interdite : % → %', old.status, new.status
          using errcode = 'check_violation';
      end if;
    end if;

    -- Contenu figé dès la soumission : seul le statut peut encore bouger.
    if old.status = any (v_locked)
       and (new.type, new.priority, new.title, new.description, new.assigned_to, new.due_date,
            new.equipment_id, new.work_performed, new.duration_minutes, new.parts_used)
           is distinct from
           (old.type, old.priority, old.title, old.description, old.assigned_to, old.due_date,
            old.equipment_id, old.work_performed, old.duration_minutes, old.parts_used) then
      raise exception 'Intervention verrouillée (%) : contenu non modifiable', old.status
        using errcode = 'check_violation';
    end if;

    -- Le technicien ne touche qu'au statut et au rapport.
    if not v_admin
       and (new.type, new.priority, new.title, new.description, new.assigned_to, new.due_date, new.equipment_id)
           is distinct from
           (old.type, old.priority, old.title, old.description, old.assigned_to, old.due_date, old.equipment_id) then
      raise exception 'Un technicien ne peut modifier que le statut et le rapport de travaux'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  -- Horodatages gérés par la base.
  if new.status = 'in_progress' and new.started_at is null then new.started_at := now(); end if;
  if new.status = 'submitted' then new.submitted_at := now(); end if;
  if new.status in ('done', 'cancelled') then new.completed_at := coalesce(new.completed_at, now()); end if;
  if tg_op = 'UPDATE' and new.status = 'in_progress' and old.status <> 'todo' then
    new.submitted_at := null;
    new.completed_at := null;
  end if;
  return new;
end $$;
revoke execute on function public.intervention_enforce_status() from public, anon, authenticated;

-- Historique avec motif.
create or replace function public.intervention_log_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.intervention_status_history
      (organization_id, intervention_id, from_status, to_status, changed_by, reason)
    values
      (new.organization_id, new.id, case when tg_op = 'UPDATE' then old.status end, new.status,
       auth.uid(), nullif(trim(coalesce(current_setting('app.status_reason', true), '')), ''));
  end if;
  return new;
end $$;

-- 5. Notifications du workflow -------------------------------------------------
create function private.intervention_notify_workflow()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'submitted' and old.status <> 'submitted' then
    -- Tous les admins de l'organisation : une intervention attend leur validation.
    insert into public.notifications (organization_id, user_id, type, entity_type, entity_id, message)
    select new.organization_id, m.user_id, 'intervention_submitted', 'intervention', new.id,
           'Intervention soumise, à valider : ' || new.title
    from public.memberships m
    where m.organization_id = new.organization_id and m.role = 'admin' and m.deleted_at is null
      and m.user_id is distinct from auth.uid();
  elsif old.status = 'submitted' and new.status = 'in_progress' and new.assigned_to is not null then
    insert into public.notifications (organization_id, user_id, type, entity_type, entity_id, message)
    values (new.organization_id, new.assigned_to, 'intervention_returned', 'intervention', new.id,
            'Intervention renvoyée pour reprise : ' || new.title || ' — '
            || coalesce(nullif(current_setting('app.status_reason', true), ''), 'sans motif'));
  end if;
  return new;
end $$;

create trigger interventions_notify_workflow
  after update of status on public.interventions
  for each row execute function private.intervention_notify_workflow();

-- 6. Verrou des « enfants » (checklist, liens documents) -----------------------
create function private.intervention_children_lock()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_status public.intervention_status;
begin
  select i.status into v_status
  from public.interventions i
  where i.id = coalesce(new.intervention_id, old.intervention_id);

  if v_status in ('submitted', 'done', 'cancelled') then
    raise exception 'Intervention verrouillée (%) : checklist et documents ne sont plus modifiables', v_status
      using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end $$;

create trigger intervention_steps_lock
  before insert or update or delete on public.intervention_steps
  for each row execute function private.intervention_children_lock();
create trigger document_interventions_lock
  before insert or update or delete on public.document_interventions
  for each row execute function private.intervention_children_lock();

-- Le technicien coche/décoche seulement ; completed_by est posé par la base.
create function private.intervention_steps_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and not private.is_admin()
     and (new.title, new.position, new.intervention_id) is distinct from (old.title, old.position, old.intervention_id) then
    raise exception 'Un technicien ne peut que cocher/décocher une étape'
      using errcode = 'insufficient_privilege';
  end if;
  if new.completed_at is not null and (tg_op = 'INSERT' or old.completed_at is null) then
    new.completed_by := auth.uid();
  elsif new.completed_at is null then
    new.completed_by := null;
  end if;
  return new;
end $$;

create trigger intervention_steps_guard
  before insert or update on public.intervention_steps
  for each row execute function private.intervention_steps_guard();

-- 7. API de changement de statut (avec motif) ---------------------------------
-- SECURITY INVOKER : s'exécute avec les droits de l'appelant, donc la RLS et le
-- trigger ci-dessus décident. La fonction ne fait que transporter le motif.
create function public.change_intervention_status(
  p_intervention_id uuid,
  p_status public.intervention_status,
  p_reason text default null
)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform set_config('app.status_reason', coalesce(trim(p_reason), ''), true);

  update public.interventions set status = p_status where id = p_intervention_id;
  if not found then
    raise exception 'Intervention introuvable, ou hors de votre périmètre' using errcode = 'no_data_found';
  end if;

  perform set_config('app.status_reason', '', true);
end $$;
revoke all on function public.change_intervention_status(uuid, public.intervention_status, text) from public, anon;
grant execute on function public.change_intervention_status(uuid, public.intervention_status, text) to authenticated;

grant update (status) on public.interventions to authenticated;

-- 8. Policies ------------------------------------------------------------------
create policy "org: members read" on public.organizations for select to authenticated
  using (id = private.current_org_id());
create policy "org: admin updates" on public.organizations for update to authenticated
  using (id = private.current_org_id() and private.is_admin())
  with check (id = private.current_org_id());

create policy "profiles: self or same org read" on public.profiles for select to authenticated using (
  id = auth.uid()
  or exists (select 1 from public.memberships m
             where m.user_id = profiles.id and m.organization_id = private.current_org_id())
);
create policy "profiles: self update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "memberships: org read" on public.memberships for select to authenticated
  using (organization_id = private.current_org_id());
create policy "memberships: admin manages others" on public.memberships for update to authenticated
  using (organization_id = private.current_org_id() and private.is_admin())
  with check (organization_id = private.current_org_id() and user_id <> auth.uid());

create policy "equipment: org read" on public.equipment for select to authenticated
  using (organization_id = private.current_org_id());
create policy "equipment: admin insert" on public.equipment for insert to authenticated
  with check (organization_id = private.current_org_id() and private.is_admin());
create policy "equipment: admin update" on public.equipment for update to authenticated
  using (organization_id = private.current_org_id() and private.is_admin())
  with check (organization_id = private.current_org_id());

create policy "interventions: org read" on public.interventions for select to authenticated
  using (organization_id = private.current_org_id());
create policy "interventions: admin insert" on public.interventions for insert to authenticated
  with check (organization_id = private.current_org_id() and private.is_admin());
-- Périmètre du technicien : ses interventions, tant qu'elles sont todo / in_progress.
create policy "interventions: admin, or assignee while open" on public.interventions for update to authenticated
  using (organization_id = private.current_org_id()
         and (private.is_admin()
              or (assigned_to = auth.uid() and status in ('todo', 'in_progress'))))
  with check (organization_id = private.current_org_id());

create policy "status history: org read" on public.intervention_status_history for select to authenticated
  using (organization_id = private.current_org_id());

create policy "steps: org read" on public.intervention_steps for select to authenticated
  using (organization_id = private.current_org_id());
create policy "steps: admin write" on public.intervention_steps for all to authenticated
  using (organization_id = private.current_org_id() and private.is_admin())
  with check (organization_id = private.current_org_id() and private.is_admin());
create policy "steps: assignee checks while in progress" on public.intervention_steps for update to authenticated
  using (organization_id = private.current_org_id() and exists (
    select 1 from public.interventions i
    where i.id = intervention_steps.intervention_id
      and i.assigned_to = auth.uid() and i.status = 'in_progress'))
  with check (organization_id = private.current_org_id());

create policy "categories: org read" on public.document_categories for select to authenticated
  using (organization_id = private.current_org_id());
create policy "categories: admin write" on public.document_categories for all to authenticated
  using (organization_id = private.current_org_id() and private.is_admin())
  with check (organization_id = private.current_org_id() and private.is_admin());

create policy "documents: org read" on public.documents for select to authenticated
  using (organization_id = private.current_org_id());
create policy "documents: members insert" on public.documents for insert to authenticated
  with check (organization_id = private.current_org_id());
create policy "documents: admin update" on public.documents for update to authenticated
  using (organization_id = private.current_org_id() and private.is_admin())
  with check (organization_id = private.current_org_id());

create policy "doc-equipment: org read" on public.document_equipment for select to authenticated
  using (organization_id = private.current_org_id());
create policy "doc-equipment: members write" on public.document_equipment for all to authenticated
  using (organization_id = private.current_org_id())
  with check (organization_id = private.current_org_id());

create policy "doc-interventions: org read" on public.document_interventions for select to authenticated
  using (organization_id = private.current_org_id());
create policy "doc-interventions: members write" on public.document_interventions for all to authenticated
  using (organization_id = private.current_org_id())
  with check (organization_id = private.current_org_id());

create policy "notifications: own read" on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy "notifications: own mark read" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "audit: admin read" on public.audit_log for select to authenticated
  using (organization_id = private.current_org_id() and private.is_admin());

create policy "storage documents: org read" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = private.current_org_id()::text);
create policy "storage documents: members upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = private.current_org_id()::text);
