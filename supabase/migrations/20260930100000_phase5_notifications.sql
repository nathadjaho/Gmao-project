-- =============================================================================
-- Phase 5 — Notifications réelles + tâche quotidienne (pg_cron)
-- =============================================================================
--
-- Déjà en place (phases 0–1) : table notifications, lecture/marquage limités à
-- l'utilisateur lui-même (RLS + droit UPDATE sur read_at uniquement), et les
-- notifications « événementielles » créées par triggers (assignée, soumise, renvoyée).
--
-- Ajouté ici : les notifications « temporelles », que rien ne déclenche à part
-- le passage du temps : intervention en retard, document qui expire.
-- → une fonction SQL idempotente + un job pg_cron chaque matin.
--
-- Idempotente = on peut la lancer 10 fois, elle ne crée pas 10 fois la même alerte :
-- avant d'insérer, elle vérifie qu'une notification équivalente n'existe pas déjà
-- pour la « période » en cours (depuis l'échéance, ou depuis J-30 de l'expiration).
-- =============================================================================

-- Sert la vérification « déjà notifié ? » (par entité et type).
create index if not exists notifications_entity_idx
  on public.notifications (entity_id, type, user_id, created_at desc);

create or replace function private.generate_daily_notifications(p_today date default current_date)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer := 0;
  v_rows integer;
begin
  -- 1. Interventions en retard -------------------------------------------------
  -- Destinataire : le technicien assigné (s'il est toujours membre actif),
  -- sinon les admins de l'organisation (personne n'est chargé de l'intervention).
  with overdue as (
    select i.id, i.organization_id, i.title, i.due_date, i.assigned_to
    from public.interventions i
    where i.status in ('todo', 'in_progress') and i.due_date < p_today
  ), recipients as (
    select o.*, m.user_id
    from overdue o
    join public.memberships m
      on m.organization_id = o.organization_id and m.deleted_at is null
     and (m.user_id = o.assigned_to
          or (m.role = 'admin' and not exists (
                select 1 from public.memberships a
                where a.user_id = o.assigned_to and a.organization_id = o.organization_id
                  and a.deleted_at is null)))
  )
  insert into public.notifications (organization_id, user_id, type, entity_type, entity_id, message)
  select r.organization_id, r.user_id, 'intervention_overdue', 'intervention', r.id,
         'Intervention en retard (échéance ' || to_char(r.due_date, 'DD/MM/YYYY') || ') : ' || r.title
  from recipients r
  where not exists (
    select 1 from public.notifications n
    where n.entity_id = r.id and n.type = 'intervention_overdue' and n.user_id = r.user_id
      and n.created_at >= r.due_date   -- une seule alerte par échéance dépassée
  );
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  -- 2. Documents qui expirent (J-30) ou ont expiré -------------------------------
  -- Destinataires : les admins. Deux alertes au maximum par date d'expiration :
  -- une à l'entrée dans les 30 jours, une le jour où il expire.
  with docs as (
    select d.id, d.organization_id, d.name, d.expires_on,
           (d.expires_on < p_today) as expired
    from public.documents d
    where d.deleted_at is null and d.expires_on is not null
      and d.expires_on <= p_today + 30
  )
  insert into public.notifications (organization_id, user_id, type, entity_type, entity_id, message)
  select d.organization_id, m.user_id, 'document_expiring', 'document', d.id,
         case when d.expired
              then 'Document expiré depuis le ' || to_char(d.expires_on, 'DD/MM/YYYY') || ' : ' || d.name
              else 'Document à renouveler avant le ' || to_char(d.expires_on, 'DD/MM/YYYY') || ' : ' || d.name
         end
  from docs d
  join public.memberships m
    on m.organization_id = d.organization_id and m.role = 'admin' and m.deleted_at is null
  where not exists (
    select 1 from public.notifications n
    where n.entity_id = d.id and n.type = 'document_expiring' and n.user_id = m.user_id
      and n.created_at >= case when d.expired then d.expires_on else d.expires_on - 30 end
  );
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  return v_count;
end $$;
-- Réservée au planificateur (et aux tests) : aucun utilisateur ne l'appelle.
revoke all on function private.generate_daily_notifications(date) from public, anon, authenticated;

-- Planification : tous les jours à 05:00 UTC (06:00 à Douala).
-- Protégé : si pg_cron n'est pas disponible (base de test locale), on passe.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.unschedule(jobid) from cron.job where jobname = 'gmao-daily-notifications';
    perform cron.schedule('gmao-daily-notifications', '0 5 * * *',
                          'select private.generate_daily_notifications()');
  else
    raise notice 'pg_cron indisponible : planification ignorée';
  end if;
end $$;
