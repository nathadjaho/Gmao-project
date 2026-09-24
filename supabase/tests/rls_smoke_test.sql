-- Scénarios RLS / règles métier (Phase 1 : rôles admin + technician, verrouillage).
-- Usage local : psql -f supabase_shim.sql, puis toutes les migrations dans l'ordre, puis ce fichier.
-- Chaque ligne « ✔ » ou « ✘ » est une assertion ; toute ligne « ✘ » est un échec.
\set ON_ERROR_STOP 0
\set QUIET 1
\pset tuples_only on
\pset format unaligned

insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a', 'alice@org1', '{"full_name":"Alice"}'),
 ('00000000-0000-0000-0000-00000000000b', 'bob@org2',   '{}'),
 ('00000000-0000-0000-0000-00000000000c', 'tech@org1',  '{}');

create function pg_temp.check(label text, ok boolean) returns text language sql as
  $$ select case when ok then '✔ ' else '✘ ' end || label $$;
create function pg_temp.fails(label text, stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return '✘ ' || label || ' (aurait dû échouer)';
exception when others then
  return '✔ ' || label || ' → ' || sqlerrm;
end $$;
grant execute on all functions in schema pg_temp to authenticated;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.create_organization('Org One') \gset org1_
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select public.create_organization('Org Two') \gset org2_
reset role;
-- En attendant les invitations : ajout du technicien en superutilisateur.
insert into public.memberships (user_id, organization_id)
values ('00000000-0000-0000-0000-00000000000c', :'org1_create_organization');
set role authenticated;

\echo '--- Rôles'
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select pg_temp.check('rôle par défaut d''un nouveau membre = technician',
  (select role::text from public.memberships where user_id = '00000000-0000-0000-0000-00000000000c') = 'technician');
select pg_temp.check('le créateur de l''organisation est admin',
  (select role::text from public.memberships where user_id = '00000000-0000-0000-0000-00000000000a') = 'admin');

\echo '--- Alice (admin org1) crée un équipement et une intervention assignée au technicien'
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into public.equipment (code, name, criticality) values ('TR-4410', 'Turbine B', 3);
insert into public.interventions (equipment_id, title, assigned_to, due_date)
  select id, 'Inspection arbre', '00000000-0000-0000-0000-00000000000c', current_date + 1
  from public.equipment where code = 'TR-4410';
insert into public.intervention_steps (intervention_id, position, title)
  select id, 0, 'Consignation' from public.interventions;
select id as itv from public.interventions \gset
select id as cat from public.document_categories limit 1 \gset
insert into public.documents (category_id, name, storage_path, mime_type, size_bytes)
  values (:'cat', 'Rapport', :'org1_create_organization' || '/d/r.pdf', 'application/pdf', 1000);
select id as doc from public.documents \gset

\echo '--- Isolation entre organisations'
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select pg_temp.check('Bob (org2) ne voit rien de org1',
  (select count(*) from public.equipment) + (select count(*) from public.interventions) + (select count(*) from public.audit_log) = 0);
select pg_temp.fails('Bob ne peut pas insérer dans org1',
  format('insert into public.equipment (organization_id, code, name) values (%L, ''HACK'', ''x'')', :'org1_create_organization'));

\echo '--- Technicien'
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select pg_temp.fails('le technicien ne crée pas d''équipement',
  'insert into public.equipment (code, name) values (''T-1'', ''x'')');
select pg_temp.fails('le technicien ne crée pas d''intervention',
  format('insert into public.interventions (equipment_id, title) select id, ''x'' from public.equipment'));
select pg_temp.check('le technicien a reçu la notification d''assignation',
  (select count(*) from public.notifications where type = 'intervention_assigned') = 1);
select pg_temp.fails('le technicien ne change pas la priorité',
  'update public.interventions set priority = ''low''');
update public.interventions set status = 'in_progress';
update public.intervention_steps set completed_at = now();
select pg_temp.check('étape cochée, completed_by posé par la base',
  (select completed_by = '00000000-0000-0000-0000-00000000000c' from public.intervention_steps));
select pg_temp.fails('le technicien ne renomme pas une étape',
  'update public.intervention_steps set title = ''autre''');
select pg_temp.fails('le technicien ne peut pas annuler',
  format('select public.change_intervention_status(%L, ''cancelled'', ''plus besoin'')', :'itv'));
select pg_temp.fails('le technicien ne peut pas passer directement à terminé',
  'update public.interventions set status = ''done'', work_performed = ''x''');
select pg_temp.fails('soumission impossible sans rapport',
  'update public.interventions set status = ''submitted''');
update public.interventions set work_performed = 'Roulements remplacés', duration_minutes = 90;
select public.change_intervention_status(:'itv', 'submitted');
select pg_temp.check('intervention soumise, submitted_at posé',
  (select status = 'submitted' and submitted_at is not null from public.interventions));

\echo '--- Périmètre du technicien terminé dès la soumission'
update public.interventions set work_performed = 'modifié après coup'; -- filtré par RLS : 0 ligne
select pg_temp.check('le rapport soumis n''a pas bougé',
  (select work_performed = 'Roulements remplacés' from public.interventions));
update public.intervention_steps set completed_at = null; -- filtré par RLS : 0 ligne
select pg_temp.check('la checklist soumise reste cochée',
  (select completed_at is not null from public.intervention_steps));
select pg_temp.fails('le technicien ne peut plus lier de document',
  format('insert into public.document_interventions (document_id, intervention_id) values (%L, %L)', :'doc', :'itv'));
select pg_temp.fails('le technicien ne peut pas valider sa propre intervention',
  format('select public.change_intervention_status(%L, ''done'')', :'itv'));
select pg_temp.check('le technicien ne lit pas le journal d''audit', (select count(*) from public.audit_log) = 0);

\echo '--- Admin : vérification'
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select pg_temp.check('l''admin a reçu la notification « à valider »',
  (select count(*) from public.notifications where type = 'intervention_submitted') = 1);
select pg_temp.fails('admin : le contenu soumis est figé',
  'update public.interventions set title = ''x''');
select pg_temp.fails('admin : pas d''étape ajoutée à une intervention soumise',
  format('insert into public.intervention_steps (intervention_id, position, title) values (%L, 1, ''x'')', :'itv'));
select pg_temp.fails('admin : renvoi pour reprise sans motif',
  format('select public.change_intervention_status(%L, ''in_progress'')', :'itv'));
select public.change_intervention_status(:'itv', 'in_progress', 'Photo du rapport de mesure manquante');
select pg_temp.check('renvoyée : in_progress, submitted_at effacé',
  (select status = 'in_progress' and submitted_at is null from public.interventions));

\echo '--- Technicien : reprise puis nouvelle soumission'
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select pg_temp.check('le technicien a reçu la notification de renvoi avec le motif',
  (select message like '%Photo du rapport de mesure manquante%' from public.notifications where type = 'intervention_returned'));
update public.interventions set work_performed = 'Roulements remplacés, photo jointe';
select pg_temp.check('le technicien peut de nouveau compléter son rapport',
  (select work_performed like '%photo jointe' from public.interventions));
select public.change_intervention_status(:'itv', 'submitted');

\echo '--- Admin : validation, verrou, réouverture'
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.change_intervention_status(:'itv', 'done');
select pg_temp.check('validée : done, completed_at posé',
  (select status = 'done' and completed_at is not null from public.interventions));
select pg_temp.fails('admin : lier un document à une intervention terminée',
  format('insert into public.document_interventions (document_id, intervention_id) values (%L, %L)', :'doc', :'itv'));
select pg_temp.fails('admin : réouverture sans motif',
  format('select public.change_intervention_status(%L, ''in_progress'', '' '')', :'itv'));
select public.change_intervention_status(:'itv', 'in_progress', 'Mesure axe Y erronée');
select pg_temp.check('rouverte : in_progress, completed_at effacé',
  (select status = 'in_progress' and completed_at is null from public.interventions));
select pg_temp.check('historique complet et motivé',
  (select string_agg(to_status::text || coalesce('(' || reason || ')', ''), ' > ' order by id)
   from public.intervention_status_history)
  = 'todo > in_progress > submitted > in_progress(Photo du rapport de mesure manquante) > submitted > done > in_progress(Mesure axe Y erronée)');
select pg_temp.fails('admin : annulation sans motif',
  format('select public.change_intervention_status(%L, ''cancelled'')', :'itv'));
select public.change_intervention_status(:'itv', 'cancelled', 'Machine remplacée');
select pg_temp.check('annulée avec motif',
  (select status = 'cancelled' from public.interventions));

\echo '--- Divers'
select pg_temp.fails('un admin ne change pas son propre rôle',
  'update public.memberships set role = ''technician'' where user_id = auth.uid()');
update public.memberships set role = 'admin' where user_id = '00000000-0000-0000-0000-00000000000c';
select pg_temp.check('un admin peut promouvoir un membre',
  (select role::text from public.memberships where user_id = '00000000-0000-0000-0000-00000000000c') = 'admin');
select pg_temp.fails('chemin de document hors organisation',
  format('insert into public.documents (category_id, name, storage_path, mime_type, size_bytes) values (%L, ''x'', %L, ''application/pdf'', 1)',
         :'cat', :'org2_create_organization' || '/d/x.pdf'));
select pg_temp.fails('upload Storage dans une autre organisation',
  format('insert into storage.objects (bucket_id, name) values (''documents'', %L)', :'org2_create_organization' || '/x/f.pdf'));
