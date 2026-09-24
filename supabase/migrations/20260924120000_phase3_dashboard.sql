-- Phase 3 : tableau de bord réel.
--
-- Pourquoi une fonction SQL plutôt que N requêtes depuis le navigateur :
--   * un seul aller-retour réseau au lieu d'une dizaine de COUNT ;
--   * les agrégats sont calculés par Postgres (on ne rapatrie jamais les lignes) ;
--   * SECURITY INVOKER : la RLS de l'appelant s'applique, donc chaque utilisateur
--     ne compte que les données de SON organisation, sans filtre à écrire ici.
--
-- p_today est passé par le client : « en retard » dépend du fuseau de l'utilisateur,
-- pas de celui du serveur (UTC).

create or replace function public.dashboard_summary(p_today date default current_date)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'interventions', (
      select jsonb_build_object(
        'to_validate',  count(*) filter (where i.status = 'submitted'),
        'open',         count(*) filter (where i.status in ('todo', 'in_progress')),
        'overdue',      count(*) filter (where i.status in ('todo', 'in_progress') and i.due_date < p_today),
        'mine_open',    count(*) filter (where i.status in ('todo', 'in_progress') and i.assigned_to = auth.uid()),
        'mine_overdue', count(*) filter (where i.status in ('todo', 'in_progress') and i.assigned_to = auth.uid()
                                          and i.due_date < p_today),
        'mine_submitted', count(*) filter (where i.status = 'submitted' and i.assigned_to = auth.uid()),
        'done_30d',     count(*) filter (where i.status = 'done' and i.completed_at >= p_today - 30)
      )
      from public.interventions i
    ),
    'equipment', (
      select jsonb_build_object(
        'total',          count(*),
        'in_service',     count(*) filter (where e.status = 'in_service'),
        'broken_down',    count(*) filter (where e.status = 'broken_down'),
        'out_of_service', count(*) filter (where e.status = 'out_of_service')
      )
      from public.equipment e
      where e.deleted_at is null
    ),
    'documents', (
      select jsonb_build_object(
        'expiring_30d', count(*) filter (where d.expires_on between p_today and p_today + 30),
        'expired',      count(*) filter (where d.expires_on < p_today)
      )
      from public.documents d
      where d.deleted_at is null and d.expires_on is not null
    )
  );
$$;

revoke all on function public.dashboard_summary(date) from public, anon;
grant execute on function public.dashboard_summary(date) to authenticated;

-- « Activité récente » : les derniers changements de statut de l'organisation.
-- L'index existant est par intervention ; celui-ci sert le tri global par organisation.
create index if not exists status_history_org_recent_idx
  on public.intervention_status_history (organization_id, changed_at desc);
