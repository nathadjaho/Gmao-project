-- =============================================================================
-- Phase 1 (1/2) — Nouvelles valeurs d'enum.
-- Isolé dans sa propre migration : PostgreSQL interdit d'UTILISER une valeur
-- d'enum dans la transaction qui l'a créée (contraintes, policies…).
-- =============================================================================
alter type public.intervention_status add value if not exists 'submitted' after 'in_progress';
alter type public.notification_type  add value if not exists 'intervention_submitted';
alter type public.notification_type  add value if not exists 'intervention_returned';
