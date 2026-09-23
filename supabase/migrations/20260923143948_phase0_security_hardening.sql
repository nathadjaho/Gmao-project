-- =============================================================================
-- Phase 0 — Durcissement sécurité (suite aux alertes du Security Advisor Supabase)
--
-- 1. search_path figé sur toutes les fonctions (évite qu'un objet homonyme
--    placé dans un autre schéma soit appelé à la place du bon).
-- 2. Les fonctions de trigger ne doivent pas être appelables via l'API
--    (/rest/v1/rpc/...) : on retire EXECUTE à tout le monde. Les triggers
--    continuent de fonctionner (PostgreSQL ne vérifie pas EXECUTE au déclenchement).
-- 3. Les helpers RLS (current_org_id, has_role) restent appelables par
--    `authenticated` (les policies en ont besoin) mais plus par `anon`.
-- =============================================================================

alter function public.set_updated_at()               set search_path = public;
alter function public.intervention_enforce_status()  set search_path = public;

revoke execute on function public.set_updated_at()               from public, anon, authenticated;
revoke execute on function public.intervention_enforce_status()  from public, anon, authenticated;
revoke execute on function public.audit_row_change()             from public, anon, authenticated;
revoke execute on function public.handle_new_user()              from public, anon, authenticated;
revoke execute on function public.intervention_log_status()      from public, anon, authenticated;
revoke execute on function public.intervention_notify_assignee() from public, anon, authenticated;

revoke execute on function public.current_org_id()               from public, anon;
revoke execute on function public.has_role(public.app_role[])    from public, anon;
grant  execute on function public.current_org_id()               to authenticated;
grant  execute on function public.has_role(public.app_role[])    to authenticated;
